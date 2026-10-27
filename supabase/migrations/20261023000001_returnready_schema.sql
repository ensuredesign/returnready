-- ReturnReady — Household Returns Assistant
-- Migration: 20261023000001_returnready_schema.sql
-- Scope: Dedicated ReturnReady tables (rr_*), constraints, triggers, RLS policies, and transactional RPCs.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. TABLES & CONSTRAINTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rr_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Sample Household' CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
  timezone text NOT NULL DEFAULT 'Asia/Kolkata' CHECK (char_length(btrim(timezone)) BETWEEN 1 AND 64),
  seed_version integer NOT NULL DEFAULT 1 CHECK (seed_version >= 1),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rr_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.rr_workspaces(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rr_members_workspace_name_key UNIQUE (workspace_id, name),
  CONSTRAINT rr_members_workspace_id_key UNIQUE (workspace_id, id)
);

CREATE TABLE IF NOT EXISTS public.rr_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.rr_workspaces(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
  merchant text NOT NULL CHECK (char_length(btrim(merchant)) BETWEEN 1 AND 100),
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  currency text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  purchase_date date NOT NULL,
  return_deadline date NOT NULL,
  deadline_note text NOT NULL DEFAULT '' CHECK (char_length(deadline_note) <= 500),
  status text NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'preparing', 'dropped_off')),
  assignee_id uuid NULL,
  is_sample boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  dropped_off_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rr_returns_workspace_id_key UNIQUE (workspace_id, id),
  CONSTRAINT rr_returns_deadline_after_purchase CHECK (return_deadline >= purchase_date),
  CONSTRAINT rr_returns_dropped_off_consistency CHECK (
    (status = 'dropped_off' AND dropped_off_at IS NOT NULL)
    OR (status <> 'dropped_off' AND dropped_off_at IS NULL)
  ),
  CONSTRAINT rr_returns_workspace_assignee_fk
    FOREIGN KEY (workspace_id, assignee_id)
    REFERENCES public.rr_members(workspace_id, id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.rr_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.rr_workspaces(id) ON DELETE CASCADE,
  return_id uuid NOT NULL,
  label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 200),
  checked boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rr_checklist_workspace_return_fk
    FOREIGN KEY (workspace_id, return_id)
    REFERENCES public.rr_returns(workspace_id, id)
    ON DELETE CASCADE
);

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_rr_members_workspace_id
  ON public.rr_members(workspace_id);

CREATE INDEX IF NOT EXISTS idx_rr_returns_workspace_deadline
  ON public.rr_returns(workspace_id, return_deadline);

CREATE INDEX IF NOT EXISTS idx_rr_returns_workspace_assignee
  ON public.rr_returns(workspace_id, assignee_id);

CREATE INDEX IF NOT EXISTS idx_rr_checklist_workspace_id
  ON public.rr_checklist_items(workspace_id);

CREATE INDEX IF NOT EXISTS idx_rr_checklist_return_sort
  ON public.rr_checklist_items(return_id, sort_order);

-- ============================================================================
-- 3. TRIGGERS (VERSIONING & CONSISTENCY)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rr_trg_returns_before_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rr_returns_before_update ON public.rr_returns;
CREATE TRIGGER trg_rr_returns_before_update
  BEFORE UPDATE ON public.rr_returns
  FOR EACH ROW
  EXECUTE FUNCTION public.rr_trg_returns_before_update();

CREATE OR REPLACE FUNCTION public.rr_trg_checklist_before_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_parent_status text;
BEGIN
  SELECT r.status INTO v_parent_status
  FROM public.rr_returns r
  WHERE r.id = NEW.return_id
    AND r.workspace_id = NEW.workspace_id
  FOR UPDATE;

  IF v_parent_status IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND: Parent return record not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_parent_status = 'dropped_off' THEN
    RAISE EXCEPTION 'VALIDATION: Checklist cannot be modified while return is marked dropped off. Reopen the return first.'
      USING ERRCODE = '23514';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rr_checklist_before_update ON public.rr_checklist_items;
CREATE TRIGGER trg_rr_checklist_before_update
  BEFORE UPDATE ON public.rr_checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION public.rr_trg_checklist_before_update();

CREATE OR REPLACE FUNCTION public.rr_trg_checklist_after_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Touch parent return to increment its version and move planning -> preparing when a step is checked
  UPDATE public.rr_returns r
  SET status = CASE
      WHEN r.status = 'planning' AND NEW.checked = true THEN 'preparing'
      ELSE r.status
    END,
    updated_at = now()
  WHERE r.id = NEW.return_id
    AND r.workspace_id = NEW.workspace_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rr_checklist_after_update ON public.rr_checklist_items;
CREATE TRIGGER trg_rr_checklist_after_update
  AFTER UPDATE ON public.rr_checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION public.rr_trg_checklist_after_update();

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) & GRANTS
-- ============================================================================

ALTER TABLE public.rr_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rr_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rr_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rr_checklist_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.rr_workspaces FROM PUBLIC, anon;
REVOKE ALL ON public.rr_members FROM PUBLIC, anon;
REVOKE ALL ON public.rr_returns FROM PUBLIC, anon;
REVOKE ALL ON public.rr_checklist_items FROM PUBLIC, anon;

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rr_workspaces TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rr_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rr_returns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rr_checklist_items TO authenticated;

-- rr_workspaces policies
DROP POLICY IF EXISTS rr_workspaces_select_own ON public.rr_workspaces;
CREATE POLICY rr_workspaces_select_own
  ON public.rr_workspaces
  FOR SELECT
  TO authenticated
  USING (owner_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS rr_workspaces_insert_own ON public.rr_workspaces;
CREATE POLICY rr_workspaces_insert_own
  ON public.rr_workspaces
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS rr_workspaces_update_own ON public.rr_workspaces;
CREATE POLICY rr_workspaces_update_own
  ON public.rr_workspaces
  FOR UPDATE
  TO authenticated
  USING (owner_user_id = (SELECT auth.uid()))
  WITH CHECK (owner_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS rr_workspaces_delete_own ON public.rr_workspaces;
CREATE POLICY rr_workspaces_delete_own
  ON public.rr_workspaces
  FOR DELETE
  TO authenticated
  USING (owner_user_id = (SELECT auth.uid()));

-- rr_members policies
DROP POLICY IF EXISTS rr_members_select_own ON public.rr_members;
CREATE POLICY rr_members_select_own
  ON public.rr_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rr_workspaces w
      WHERE w.id = rr_members.workspace_id
        AND w.owner_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS rr_members_insert_own ON public.rr_members;
CREATE POLICY rr_members_insert_own
  ON public.rr_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rr_workspaces w
      WHERE w.id = rr_members.workspace_id
        AND w.owner_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS rr_members_update_own ON public.rr_members;
CREATE POLICY rr_members_update_own
  ON public.rr_members
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rr_workspaces w
      WHERE w.id = rr_members.workspace_id
        AND w.owner_user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rr_workspaces w
      WHERE w.id = rr_members.workspace_id
        AND w.owner_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS rr_members_delete_own ON public.rr_members;
CREATE POLICY rr_members_delete_own
  ON public.rr_members
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rr_workspaces w
      WHERE w.id = rr_members.workspace_id
        AND w.owner_user_id = (SELECT auth.uid())
    )
  );

-- rr_returns policies
DROP POLICY IF EXISTS rr_returns_select_own ON public.rr_returns;
CREATE POLICY rr_returns_select_own
  ON public.rr_returns
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rr_workspaces w
      WHERE w.id = rr_returns.workspace_id
        AND w.owner_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS rr_returns_insert_own ON public.rr_returns;
CREATE POLICY rr_returns_insert_own
  ON public.rr_returns
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rr_workspaces w
      WHERE w.id = rr_returns.workspace_id
        AND w.owner_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS rr_returns_update_own ON public.rr_returns;
CREATE POLICY rr_returns_update_own
  ON public.rr_returns
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rr_workspaces w
      WHERE w.id = rr_returns.workspace_id
        AND w.owner_user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rr_workspaces w
      WHERE w.id = rr_returns.workspace_id
        AND w.owner_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS rr_returns_delete_own ON public.rr_returns;
CREATE POLICY rr_returns_delete_own
  ON public.rr_returns
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rr_workspaces w
      WHERE w.id = rr_returns.workspace_id
        AND w.owner_user_id = (SELECT auth.uid())
    )
  );

-- rr_checklist_items policies
DROP POLICY IF EXISTS rr_checklist_select_own ON public.rr_checklist_items;
CREATE POLICY rr_checklist_select_own
  ON public.rr_checklist_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rr_workspaces w
      WHERE w.id = rr_checklist_items.workspace_id
        AND w.owner_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS rr_checklist_insert_own ON public.rr_checklist_items;
CREATE POLICY rr_checklist_insert_own
  ON public.rr_checklist_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rr_workspaces w
      WHERE w.id = rr_checklist_items.workspace_id
        AND w.owner_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS rr_checklist_update_own ON public.rr_checklist_items;
CREATE POLICY rr_checklist_update_own
  ON public.rr_checklist_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rr_workspaces w
      WHERE w.id = rr_checklist_items.workspace_id
        AND w.owner_user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rr_workspaces w
      WHERE w.id = rr_checklist_items.workspace_id
        AND w.owner_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS rr_checklist_delete_own ON public.rr_checklist_items;
CREATE POLICY rr_checklist_delete_own
  ON public.rr_checklist_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rr_workspaces w
      WHERE w.id = rr_checklist_items.workspace_id
        AND w.owner_user_id = (SELECT auth.uid())
    )
  );

-- ============================================================================
-- 5. INTERNAL SEED HELPER & TRANSACTIONAL RPCs (SECURITY INVOKER)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rr_seed_workspace_data(p_workspace_id uuid, p_timezone text DEFAULT 'Asia/Kolkata')
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today date;
  v_purchase_date date;
  v_member_me uuid;
  v_member_priya uuid;
  v_member_alex uuid;
  v_ret_headphones uuid;
  v_ret_shoes uuid;
  v_ret_lamp uuid;
  v_ret_backpack uuid;
  v_ret_grinder uuid;
BEGIN
  v_today := (now() AT TIME ZONE COALESCE(NULLIF(btrim(p_timezone), ''), 'Asia/Kolkata'))::date;
  v_purchase_date := v_today - 10;

  -- Seed 3 assignable household member names
  INSERT INTO public.rr_members (workspace_id, name)
  VALUES (p_workspace_id, 'Me')
  RETURNING id INTO v_member_me;

  INSERT INTO public.rr_members (workspace_id, name)
  VALUES (p_workspace_id, 'Priya')
  RETURNING id INTO v_member_priya;

  INSERT INTO public.rr_members (workspace_id, name)
  VALUES (p_workspace_id, 'Alex')
  RETURNING id INTO v_member_alex;

  -- 1. Wireless Headphones (Today + 1, partially prepared, unassigned for demo flow)
  INSERT INTO public.rr_returns (
    workspace_id, name, merchant, amount_minor, currency,
    purchase_date, return_deadline, deadline_note, status, assignee_id, is_sample
  ) VALUES (
    p_workspace_id,
    'Wireless Headphones',
    'Demo Electronics',
    499900,
    'INR',
    v_purchase_date,
    v_today + 1,
    'User-entered deadline; keep charging cable and inner tray together.',
    'preparing',
    NULL,
    true
  ) RETURNING id INTO v_ret_headphones;

  INSERT INTO public.rr_checklist_items (workspace_id, return_id, label, checked, sort_order) VALUES
    (p_workspace_id, v_ret_headphones, 'Headphones', true, 1),
    (p_workspace_id, v_ret_headphones, 'Charging cable', false, 2),
    (p_workspace_id, v_ret_headphones, 'Receipt', true, 3),
    (p_workspace_id, v_ret_headphones, 'Protective packaging', false, 4);

  -- 2. Running Shoes (Today + 3, all steps checked -> Ready state demonstrated)
  INSERT INTO public.rr_returns (
    workspace_id, name, merchant, amount_minor, currency,
    purchase_date, return_deadline, deadline_note, status, assignee_id, is_sample
  ) VALUES (
    p_workspace_id,
    'Running Shoes',
    'Demo Sports',
    279900,
    'INR',
    v_purchase_date,
    v_today + 3,
    'User-entered deadline; boxed near front entrance.',
    'preparing',
    v_member_priya,
    true
  ) RETURNING id INTO v_ret_shoes;

  INSERT INTO public.rr_checklist_items (workspace_id, return_id, label, checked, sort_order) VALUES
    (p_workspace_id, v_ret_shoes, 'Both shoes', true, 1),
    (p_workspace_id, v_ret_shoes, 'Original box', true, 2),
    (p_workspace_id, v_ret_shoes, 'Receipt', true, 3);

  -- 3. Desk Lamp (Today + 7, planning state, inclusive end of due-soon window)
  INSERT INTO public.rr_returns (
    workspace_id, name, merchant, amount_minor, currency,
    purchase_date, return_deadline, deadline_note, status, assignee_id, is_sample
  ) VALUES (
    p_workspace_id,
    'Desk Lamp',
    'Demo Home',
    149900,
    'INR',
    v_purchase_date,
    v_today + 7,
    'User-entered deadline; detach power adapter before boxing.',
    'planning',
    NULL,
    true
  ) RETURNING id INTO v_ret_lamp;

  INSERT INTO public.rr_checklist_items (workspace_id, return_id, label, checked, sort_order) VALUES
    (p_workspace_id, v_ret_lamp, 'Lamp', false, 1),
    (p_workspace_id, v_ret_lamp, 'Power adapter', false, 2),
    (p_workspace_id, v_ret_lamp, 'Receipt', false, 3),
    (p_workspace_id, v_ret_lamp, 'Protective packaging', false, 4);

  -- 4. Travel Backpack (Today - 1, overdue recorded deadline, assigned to Alex)
  INSERT INTO public.rr_returns (
    workspace_id, name, merchant, amount_minor, currency,
    purchase_date, return_deadline, deadline_note, status, assignee_id, is_sample
  ) VALUES (
    p_workspace_id,
    'Travel Backpack',
    'Demo Outdoors',
    199900,
    'INR',
    v_purchase_date,
    v_today - 1,
    'User-entered deadline has passed; verify retailer options before drop-off.',
    'preparing',
    v_member_alex,
    true
  ) RETURNING id INTO v_ret_backpack;

  INSERT INTO public.rr_checklist_items (workspace_id, return_id, label, checked, sort_order) VALUES
    (p_workspace_id, v_ret_backpack, 'Empty all pockets', true, 1),
    (p_workspace_id, v_ret_backpack, 'Receipt', false, 2),
    (p_workspace_id, v_ret_backpack, 'Packaging', false, 3);

  -- 5. Coffee Grinder (Today + 12, outside 7-day due-soon window, planning state)
  INSERT INTO public.rr_returns (
    workspace_id, name, merchant, amount_minor, currency,
    purchase_date, return_deadline, deadline_note, status, assignee_id, is_sample
  ) VALUES (
    p_workspace_id,
    'Coffee Grinder',
    'Demo Kitchen',
    349900,
    'INR',
    v_purchase_date,
    v_today + 12,
    'User-entered deadline; include cleaning brush and lid.',
    'planning',
    NULL,
    true
  ) RETURNING id INTO v_ret_grinder;

  INSERT INTO public.rr_checklist_items (workspace_id, return_id, label, checked, sort_order) VALUES
    (p_workspace_id, v_ret_grinder, 'Grinder', false, 1),
    (p_workspace_id, v_ret_grinder, 'Accessories', false, 2),
    (p_workspace_id, v_ret_grinder, 'Receipt', false, 3),
    (p_workspace_id, v_ret_grinder, 'Protective packaging', false, 4);
END;
$$;

-- RPC 1: rr_bootstrap_demo()
CREATE OR REPLACE FUNCTION public.rr_bootstrap_demo()
RETURNS public.rr_workspaces
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_workspace public.rr_workspaces;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Active authenticated session required'
      USING ERRCODE = '28000';
  END IF;

  -- Transaction-scoped advisory lock per user to prevent duplicate seed race conditions
  PERFORM pg_advisory_xact_lock(hashtext('rr_bootstrap_' || v_user_id::text));

  SELECT * INTO v_workspace
  FROM public.rr_workspaces w
  WHERE w.owner_user_id = v_user_id;

  IF FOUND THEN
    RETURN v_workspace;
  END IF;

  INSERT INTO public.rr_workspaces (owner_user_id, name, timezone, seed_version)
  VALUES (v_user_id, 'Sample Household', 'Asia/Kolkata', 1)
  RETURNING * INTO v_workspace;

  PERFORM public.rr_seed_workspace_data(v_workspace.id, v_workspace.timezone);

  RETURN v_workspace;
END;
$$;

-- RPC 2: rr_reset_demo()
CREATE OR REPLACE FUNCTION public.rr_reset_demo()
RETURNS public.rr_workspaces
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_workspace public.rr_workspaces;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Active authenticated session required'
      USING ERRCODE = '28000';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('rr_bootstrap_' || v_user_id::text));

  SELECT * INTO v_workspace
  FROM public.rr_workspaces w
  WHERE w.owner_user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.rr_workspaces (owner_user_id, name, timezone, seed_version)
    VALUES (v_user_id, 'Sample Household', 'Asia/Kolkata', 1)
    RETURNING * INTO v_workspace;
  ELSE
    -- Delete returns first (cascades to checklist items), then members
    DELETE FROM public.rr_returns WHERE workspace_id = v_workspace.id;
    DELETE FROM public.rr_members WHERE workspace_id = v_workspace.id;
  END IF;

  PERFORM public.rr_seed_workspace_data(v_workspace.id, v_workspace.timezone);

  RETURN v_workspace;
END;
$$;

-- RPC 3: rr_set_checklist(check_id, checked)
CREATE OR REPLACE FUNCTION public.rr_set_checklist(
  check_id uuid,
  checked boolean
)
RETURNS public.rr_returns
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_item public.rr_checklist_items;
  v_return public.rr_returns;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Active authenticated session required'
      USING ERRCODE = '28000';
  END IF;

  SELECT c.* INTO v_item
  FROM public.rr_checklist_items c
  JOIN public.rr_workspaces w ON w.id = c.workspace_id
  WHERE c.id = rr_set_checklist.check_id
    AND w.owner_user_id = v_user_id
  FOR UPDATE OF c;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FORBIDDEN: Checklist item not found or access denied'
      USING ERRCODE = '42501';
  END IF;

  SELECT r.* INTO v_return
  FROM public.rr_returns r
  WHERE r.id = v_item.return_id
    AND r.workspace_id = v_item.workspace_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Parent return not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_return.status = 'dropped_off' THEN
    RAISE EXCEPTION 'VALIDATION: Cannot edit checklist after return is marked dropped off. Reopen the item first.'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.rr_checklist_items c
  SET checked = rr_set_checklist.checked
  WHERE c.id = v_item.id;

  -- Reload updated parent return (updated via trigger trg_rr_checklist_after_update)
  SELECT r.* INTO v_return
  FROM public.rr_returns r
  WHERE r.id = v_item.return_id
    AND r.workspace_id = v_item.workspace_id;

  RETURN v_return;
END;
$$;

-- RPC 4: rr_confirm_action(item_id, action, member_id, expected_version)
CREATE OR REPLACE FUNCTION public.rr_confirm_action(
  item_id uuid,
  action text,
  member_id uuid DEFAULT NULL,
  expected_version integer DEFAULT NULL
)
RETURNS public.rr_returns
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_return public.rr_returns;
  v_member_exists boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Active authenticated session required'
      USING ERRCODE = '28000';
  END IF;

  IF action IS NULL OR action NOT IN ('assign', 'dropoff', 'reopen') THEN
    RAISE EXCEPTION 'VALIDATION: Unsupported action "%". Allowed actions: assign, dropoff, reopen.', COALESCE(action, 'null')
      USING ERRCODE = '22023';
  END IF;

  IF expected_version IS NULL THEN
    RAISE EXCEPTION 'VALIDATION: expected_version is required to confirm an action'
      USING ERRCODE = '22023';
  END IF;

  SELECT r.* INTO v_return
  FROM public.rr_returns r
  JOIN public.rr_workspaces w ON w.id = r.workspace_id
  WHERE r.id = rr_confirm_action.item_id
    AND w.owner_user_id = v_user_id
  FOR UPDATE OF r;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FORBIDDEN: Return item not found or access denied'
      USING ERRCODE = '42501';
  END IF;

  IF v_return.version <> expected_version THEN
    RAISE EXCEPTION 'CONFLICT: Return item has changed (expected version %, current version %). Please review and confirm again.',
      expected_version, v_return.version
      USING ERRCODE = '40001';
  END IF;

  IF action = 'assign' THEN
    IF member_id IS NULL THEN
      RAISE EXCEPTION 'VALIDATION: member_id is required for assign action'
        USING ERRCODE = '22023';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.rr_members m
      WHERE m.id = rr_confirm_action.member_id
        AND m.workspace_id = v_return.workspace_id
    ) INTO v_member_exists;

    IF NOT v_member_exists THEN
      RAISE EXCEPTION 'FORBIDDEN: Assignee does not belong to this workspace'
        USING ERRCODE = '42501';
    END IF;

    UPDATE public.rr_returns r
    SET assignee_id = rr_confirm_action.member_id
    WHERE r.id = v_return.id
    RETURNING * INTO v_return;

  ELSIF action = 'dropoff' THEN
    IF v_return.status = 'dropped_off' THEN
      RAISE EXCEPTION 'CONFLICT: Return item is already marked dropped off'
        USING ERRCODE = '40001';
    END IF;

    UPDATE public.rr_returns r
    SET status = 'dropped_off',
        dropped_off_at = now()
    WHERE r.id = v_return.id
    RETURNING * INTO v_return;

  ELSIF action = 'reopen' THEN
    IF v_return.status <> 'dropped_off' THEN
      RAISE EXCEPTION 'CONFLICT: Return item is not marked dropped off'
        USING ERRCODE = '40001';
    END IF;

    UPDATE public.rr_returns r
    SET status = 'preparing',
        dropped_off_at = NULL
    WHERE r.id = v_return.id
    RETURNING * INTO v_return;
  END IF;

  RETURN v_return;
END;
$$;

-- Restrict RPC execution to authenticated users only
REVOKE ALL ON FUNCTION public.rr_seed_workspace_data(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rr_bootstrap_demo() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rr_reset_demo() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rr_set_checklist(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rr_confirm_action(uuid, text, uuid, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.rr_seed_workspace_data(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rr_bootstrap_demo() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rr_reset_demo() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rr_set_checklist(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rr_confirm_action(uuid, text, uuid, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
