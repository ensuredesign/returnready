import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  AppServiceError,
  type ChecklistItem,
  type HouseholdMember,
  type NewPurchaseInput,
  type ReturnDetail,
  type ReturnFilter,
  type ReturnItem,
  type StoredReturnStatus,
  type UpdatePurchaseInput,
  type VisibleReturnStatus,
  type Workspace,
} from '../types/domain';
import {
  DEFAULT_TIMEZONE,
  evaluateDeadline,
  getTodayInTimezone,
  parseCalendarDate,
  parseINRToMinor,
} from '../lib/dates';
import { ensureDemoSession, getSupabaseClient } from '../lib/supabase';

interface RawReturnRow {
  id: string;
  workspace_id: string;
  name: string;
  merchant: string;
  amount_minor: number | string;
  currency: 'INR';
  purchase_date: string;
  return_deadline: string;
  deadline_note: string | null;
  status: StoredReturnStatus;
  assignee_id: string | null;
  is_sample: boolean;
  version: number;
  dropped_off_at: string | null;
  created_at: string;
  updated_at: string;
  rr_checklist_items?: ChecklistItem[];
  rr_members?: { id: string; name: string } | null;
}

export const PurchaseFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Product name is required (1–100 characters).')
      .max(100, 'Product name cannot exceed 100 characters.'),
    merchant: z
      .string()
      .trim()
      .min(1, 'Merchant name is required (1–100 characters).')
      .max(100, 'Merchant name cannot exceed 100 characters.'),
    amountRupees: z.string().trim().min(1, 'Purchase amount in INR is required.'),
    purchaseDate: z.string().trim().min(1, 'Purchase date is required.'),
    returnDeadline: z.string().trim().min(1, 'Recorded return deadline is required.'),
    deadlineNote: z
      .string()
      .max(500, 'Deadline note cannot exceed 500 characters.')
      .optional()
      .default(''),
  })
  .superRefine((val, ctx) => {
    try {
      parseINRToMinor(val.amountRupees);
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['amountRupees'],
        message: err instanceof Error ? err.message : 'Invalid INR amount.',
      });
    }

    try {
      parseCalendarDate(val.purchaseDate);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['purchaseDate'],
        message: 'Enter a valid purchase date (YYYY-MM-DD).',
      });
    }

    try {
      parseCalendarDate(val.returnDeadline);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['returnDeadline'],
        message: 'Enter a valid return deadline (YYYY-MM-DD).',
      });
    }

    if (
      /^\d{4}-\d{2}-\d{2}$/.test(val.purchaseDate) &&
      /^\d{4}-\d{2}-\d{2}$/.test(val.returnDeadline) &&
      val.returnDeadline < val.purchaseDate
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['returnDeadline'],
        message: 'Return deadline must be on or after the purchase date.',
      });
    }
  });

/**
 * Pure function to derive visible status ("Ready") per FR-04:
 * - Stored statuses: 'planning', 'preparing', 'dropped_off'.
 * - Derive visible 'ready' when all checklist items are checked, checklist has >= 1 item,
 *   and stored status is not 'dropped_off'.
 */
export function deriveReturnStatus(
  storedStatus: StoredReturnStatus,
  checklist: Pick<ChecklistItem, 'checked'>[]
): {
  derivedStatus: VisibleReturnStatus;
  isReady: boolean;
  completedChecks: number;
  totalChecks: number;
} {
  const totalChecks = checklist.length;
  const completedChecks = checklist.filter((c) => c.checked).length;

  if (storedStatus === 'dropped_off') {
    return {
      derivedStatus: 'dropped_off',
      isReady: false,
      completedChecks,
      totalChecks,
    };
  }

  const isReady = totalChecks > 0 && completedChecks === totalChecks;
  if (isReady) {
    return {
      derivedStatus: 'ready',
      isReady: true,
      completedChecks,
      totalChecks,
    };
  }

  if (completedChecks > 0 && storedStatus === 'planning') {
    return {
      derivedStatus: 'preparing',
      isReady: false,
      completedChecks,
      totalChecks,
    };
  }

  return {
    derivedStatus: storedStatus,
    isReady: false,
    completedChecks,
    totalChecks,
  };
}

export function hydrateReturnRow(
  row: RawReturnRow,
  membersById?: Map<string, string>
): ReturnItem {
  const checklist = [...(row.rr_checklist_items ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)
  );
  const { derivedStatus, isReady, completedChecks, totalChecks } = deriveReturnStatus(
    row.status,
    checklist
  );
  const assigneeName =
    row.rr_members?.name ??
    (row.assignee_id && membersById ? membersById.get(row.assignee_id) ?? null : null);

  return {
    id: row.id,
    workspace_id: row.workspace_id,
    name: row.name,
    merchant: row.merchant,
    amount_minor: Number(row.amount_minor),
    currency: 'INR',
    purchase_date: row.purchase_date,
    return_deadline: row.return_deadline,
    deadline_note: row.deadline_note ?? '',
    status: row.status,
    assignee_id: row.assignee_id,
    assignee_name: assigneeName,
    is_sample: Boolean(row.is_sample),
    version: Number(row.version),
    dropped_off_at: row.dropped_off_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    checklist,
    derived_status: derivedStatus,
    is_ready: isReady,
    completed_checks: completedChecks,
    total_checks: totalChecks,
  };
}

/**
 * Pure filtering and sorting per FR-02:
 * - Default ('all') shows active items (not dropped_off) sorted by earliest recorded deadline, then name.
 * - 'due_soon' shows active items with deadline in [today, today + 7] inclusive.
 * - 'overdue' shows active items with deadline < today.
 * - 'ready' shows active items where is_ready is true.
 * - 'dropped_off' shows dropped_off items.
 * - Search matches product name or merchant label case-insensitively.
 */
export function filterAndSortReturns(
  items: ReturnItem[],
  filter: ReturnFilter,
  todayDateStr: string,
  searchQuery: string = ''
): ReturnItem[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return items
    .filter((item) => {
      if (normalizedQuery) {
        const matchesName = item.name.toLowerCase().includes(normalizedQuery);
        const matchesMerchant = item.merchant.toLowerCase().includes(normalizedQuery);
        if (!matchesName && !matchesMerchant) {
          return false;
        }
      }

      const isDroppedOff = item.status === 'dropped_off';
      const urgency = evaluateDeadline(item.return_deadline, todayDateStr, isDroppedOff);

      switch (filter) {
        case 'all':
          return !isDroppedOff;
        case 'due_soon':
          return !isDroppedOff && urgency.isDueSoon;
        case 'overdue':
          return !isDroppedOff && urgency.isOverdue;
        case 'ready':
          return !isDroppedOff && item.is_ready;
        case 'dropped_off':
          return isDroppedOff;
        default:
          return !isDroppedOff;
      }
    })
    .sort((a, b) => {
      const dateCmp = a.return_deadline.localeCompare(b.return_deadline);
      if (dateCmp !== 0) {
        return dateCmp;
      }
      return a.name.localeCompare(b.name);
    });
}

export function mapDatabaseError(err: unknown): AppServiceError {
  if (err instanceof AppServiceError) {
    return err;
  }

  const rawObj = typeof err === 'object' && err !== null ? (err as Record<string, unknown>) : {};
  const message =
    typeof rawObj.message === 'string'
      ? rawObj.message
      : err instanceof Error
        ? err.message
        : 'An unexpected error occurred while communicating with Supabase.';
  const code = typeof rawObj.code === 'string' ? rawObj.code : undefined;

  if (
    code === 'PGRST202' ||
    code === 'PGRST205' ||
    message.includes('schema cache') ||
    message.includes('rr_bootstrap_demo')
  ) {
    return new AppServiceError(
      'configuration',
      'Database tables or RPC functions were not found on the Supabase instance. Apply supabase/migrations/20261023000001_returnready_schema.sql in the Supabase Studio SQL Editor and retry.',
      code
    );
  }

  if (code === '40001' || message.includes('CONFLICT:')) {
    return new AppServiceError(
      'conflict',
      message.replace(/^CONFLICT:\s*/i, ''),
      code ?? '40001'
    );
  }

  if (code === '42501' || message.includes('FORBIDDEN:') || message.includes('row-level security')) {
    return new AppServiceError(
      'forbidden',
      message.replace(/^FORBIDDEN:\s*/i, '') ||
        'Access denied by workspace security policy.',
      code ?? '42501'
    );
  }

  if (code === '28000' || code === 'PGRST301' || message.includes('UNAUTHENTICATED:')) {
    return new AppServiceError(
      'unauthenticated',
      message.replace(/^UNAUTHENTICATED:\s*/i, '') ||
        'Your session expired or is unauthenticated. Reconnect to continue.',
      code ?? '28000'
    );
  }

  if (
    code === '23514' ||
    code === '22023' ||
    code === '23503' ||
    code === '23505' ||
    message.includes('VALIDATION:')
  ) {
    return new AppServiceError(
      'validation',
      message.replace(/^VALIDATION:\s*/i, ''),
      code
    );
  }

  if (
    message.toLowerCase().includes('failed to fetch') ||
    message.toLowerCase().includes('networkerror') ||
    message.toLowerCase().includes('network request failed')
  ) {
    return new AppServiceError(
      'network',
      'Network error while reaching Supabase. Check your connection and retry.',
      code
    );
  }

  return new AppServiceError('network', message, code);
}

const RETURN_SELECT_QUERY =
  '*, rr_checklist_items(*), rr_members!rr_returns_workspace_assignee_fk(id, name)';

let activeBootstrapCall: Promise<Workspace> | null = null;

export async function bootstrapDemo(client?: SupabaseClient): Promise<Workspace> {
  if (!client && activeBootstrapCall) {
    return activeBootstrapCall;
  }

  const run = async (): Promise<Workspace> => {
    try {
      const supabase = client ?? getSupabaseClient();
      await ensureDemoSession(supabase);

      const { data, error } = await supabase.rpc('rr_bootstrap_demo');
      if (error) {
        throw mapDatabaseError(error);
      }
      if (!data || !data.id) {
        throw new AppServiceError(
          'configuration',
          'rr_bootstrap_demo returned an empty workspace response.'
        );
      }
      return data as Workspace;
    } catch (err) {
      throw mapDatabaseError(err);
    }
  };

  if (client) {
    return run();
  }

  activeBootstrapCall = run();
  try {
    return await activeBootstrapCall;
  } finally {
    activeBootstrapCall = null;
  }
}

export async function listMembers(client?: SupabaseClient): Promise<HouseholdMember[]> {
  try {
    const supabase = client ?? getSupabaseClient();
    const { data, error } = await supabase
      .from('rr_members')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      throw mapDatabaseError(error);
    }
    return (data ?? []) as HouseholdMember[];
  } catch (err) {
    throw mapDatabaseError(err);
  }
}

export async function fetchAllWorkspaceReturns(client?: SupabaseClient): Promise<ReturnItem[]> {
  try {
    const supabase = client ?? getSupabaseClient();
    const { data, error } = await supabase
      .from('rr_returns')
      .select(RETURN_SELECT_QUERY)
      .order('return_deadline', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      throw mapDatabaseError(error);
    }

    const rows = (data ?? []) as unknown as RawReturnRow[];
    return rows.map((r) => hydrateReturnRow(r));
  } catch (err) {
    throw mapDatabaseError(err);
  }
}

export async function listReturns(
  filter: ReturnFilter = 'all',
  searchQuery: string = '',
  todayOverride?: string,
  client?: SupabaseClient
): Promise<ReturnItem[]> {
  const allItems = await fetchAllWorkspaceReturns(client);
  const todayStr = todayOverride ?? getTodayInTimezone(DEFAULT_TIMEZONE);
  return filterAndSortReturns(allItems, filter, todayStr, searchQuery);
}

export async function getReturn(
  itemId: string,
  client?: SupabaseClient
): Promise<ReturnDetail> {
  try {
    const supabase = client ?? getSupabaseClient();
    const { data, error } = await supabase
      .from('rr_returns')
      .select(RETURN_SELECT_QUERY)
      .eq('id', itemId)
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }
    if (!data) {
      throw new AppServiceError(
        'forbidden',
        'Return record was not found or belongs to another workspace.'
      );
    }

    return hydrateReturnRow(data as unknown as RawReturnRow);
  } catch (err) {
    throw mapDatabaseError(err);
  }
}

export async function setChecklistItem(
  checkId: string,
  checked: boolean,
  client?: SupabaseClient
): Promise<ReturnDetail> {
  try {
    const supabase = client ?? getSupabaseClient();
    const { data, error } = await supabase.rpc('rr_set_checklist', {
      check_id: checkId,
      checked,
    });

    if (error) {
      throw mapDatabaseError(error);
    }

    const updatedReturnId = (data as { id?: string } | null)?.id;
    if (!updatedReturnId) {
      throw new AppServiceError(
        'validation',
        'Checklist update did not return a parent return record.'
      );
    }

    return await getReturn(updatedReturnId, supabase);
  } catch (err) {
    throw mapDatabaseError(err);
  }
}

export async function assignReturn(
  itemId: string,
  memberId: string,
  version: number,
  client?: SupabaseClient
): Promise<ReturnDetail> {
  try {
    const supabase = client ?? getSupabaseClient();
    const { data, error } = await supabase.rpc('rr_confirm_action', {
      item_id: itemId,
      action: 'assign',
      member_id: memberId,
      expected_version: version,
    });

    if (error) {
      throw mapDatabaseError(error);
    }

    const returnId = (data as { id?: string } | null)?.id ?? itemId;
    return await getReturn(returnId, supabase);
  } catch (err) {
    throw mapDatabaseError(err);
  }
}

export async function markDroppedOff(
  itemId: string,
  version: number,
  client?: SupabaseClient
): Promise<ReturnDetail> {
  try {
    const supabase = client ?? getSupabaseClient();
    const { data, error } = await supabase.rpc('rr_confirm_action', {
      item_id: itemId,
      action: 'dropoff',
      member_id: null,
      expected_version: version,
    });

    if (error) {
      throw mapDatabaseError(error);
    }

    const returnId = (data as { id?: string } | null)?.id ?? itemId;
    return await getReturn(returnId, supabase);
  } catch (err) {
    throw mapDatabaseError(err);
  }
}

export async function reopenReturn(
  itemId: string,
  version: number,
  client?: SupabaseClient
): Promise<ReturnDetail> {
  try {
    const supabase = client ?? getSupabaseClient();
    const { data, error } = await supabase.rpc('rr_confirm_action', {
      item_id: itemId,
      action: 'reopen',
      member_id: null,
      expected_version: version,
    });

    if (error) {
      throw mapDatabaseError(error);
    }

    const returnId = (data as { id?: string } | null)?.id ?? itemId;
    return await getReturn(returnId, supabase);
  } catch (err) {
    throw mapDatabaseError(err);
  }
}

export async function resetOwnDemo(client?: SupabaseClient): Promise<Workspace> {
  try {
    const supabase = client ?? getSupabaseClient();
    const { data, error } = await supabase.rpc('rr_reset_demo');
    if (error) {
      throw mapDatabaseError(error);
    }
    if (!data || !data.id) {
      throw new AppServiceError('network', 'Reset did not return an updated workspace.');
    }
    return data as Workspace;
  } catch (err) {
    throw mapDatabaseError(err);
  }
}

/**
 * P1 (FR-06): Create a new purchase in the user's workspace with a suggested default checklist.
 */
export async function createPurchase(
  workspaceId: string,
  input: NewPurchaseInput,
  client?: SupabaseClient
): Promise<ReturnDetail> {
  const parsed = PurchaseFormSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppServiceError(
      'validation',
      parsed.error.issues[0]?.message ?? 'Invalid purchase details.'
    );
  }

  const amountMinor = parseINRToMinor(parsed.data.amountRupees);
  try {
    const supabase = client ?? getSupabaseClient();
    const { data: inserted, error: insertErr } = await supabase
      .from('rr_returns')
      .insert({
        workspace_id: workspaceId,
        name: parsed.data.name,
        merchant: parsed.data.merchant,
        amount_minor: amountMinor,
        currency: 'INR',
        purchase_date: parsed.data.purchaseDate,
        return_deadline: parsed.data.returnDeadline,
        deadline_note: parsed.data.deadlineNote ?? '',
        status: 'planning',
        is_sample: false,
      })
      .select('id')
      .single();

    if (insertErr || !inserted) {
      throw mapDatabaseError(insertErr);
    }

    const defaultSteps = [
      `${parsed.data.name} main item`,
      'Original accessories or tags',
      'Receipt or order reference',
      'Protective packaging',
    ];

    const { error: checkErr } = await supabase.from('rr_checklist_items').insert(
      defaultSteps.map((label, idx) => ({
        workspace_id: workspaceId,
        return_id: inserted.id,
        label,
        checked: false,
        sort_order: idx + 1,
      }))
    );

    if (checkErr) {
      throw mapDatabaseError(checkErr);
    }

    return await getReturn(inserted.id, supabase);
  } catch (err) {
    throw mapDatabaseError(err);
  }
}

/**
 * P1 (FR-06): Edit an existing purchase's fields.
 */
export async function updatePurchase(
  input: UpdatePurchaseInput,
  client?: SupabaseClient
): Promise<ReturnDetail> {
  const parsed = PurchaseFormSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppServiceError(
      'validation',
      parsed.error.issues[0]?.message ?? 'Invalid purchase details.'
    );
  }

  const amountMinor = parseINRToMinor(parsed.data.amountRupees);
  try {
    const supabase = client ?? getSupabaseClient();
    const { error } = await supabase
      .from('rr_returns')
      .update({
        name: parsed.data.name,
        merchant: parsed.data.merchant,
        amount_minor: amountMinor,
        purchase_date: parsed.data.purchaseDate,
        return_deadline: parsed.data.returnDeadline,
        deadline_note: parsed.data.deadlineNote ?? '',
      })
      .eq('id', input.id);

    if (error) {
      throw mapDatabaseError(error);
    }

    return await getReturn(input.id, supabase);
  } catch (err) {
    throw mapDatabaseError(err);
  }
}

/**
 * P1: Add a household member name to the workspace.
 */
export async function addHouseholdMember(
  workspaceId: string,
  rawName: string,
  client?: SupabaseClient
): Promise<HouseholdMember> {
  const trimmed = rawName.trim();
  if (trimmed.length < 1 || trimmed.length > 60) {
    throw new AppServiceError(
      'validation',
      'Member name must be between 1 and 60 characters.'
    );
  }

  try {
    const supabase = client ?? getSupabaseClient();
    const { data, error } = await supabase
      .from('rr_members')
      .insert({
        workspace_id: workspaceId,
        name: trimmed,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new AppServiceError(
          'validation',
          `"${trimmed}" is already in your household list.`,
          error.code
        );
      }
      throw mapDatabaseError(error);
    }

    return data as HouseholdMember;
  } catch (err) {
    throw mapDatabaseError(err);
  }
}
