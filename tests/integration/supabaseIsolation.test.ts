import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  assignReturn,
  bootstrapDemo,
  fetchAllWorkspaceReturns,
  getReturn,
  listMembers,
  markDroppedOff,
  reopenReturn,
  resetOwnDemo,
  setChecklistItem,
} from '../../src/services/returns';

function loadDotEnv(): Record<string, string> {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    return {};
  }
  const raw = fs.readFileSync(envPath, 'utf-8');
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    out[key] = val;
  }
  return out;
}

const fileEnv = loadDotEnv();

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  fileEnv.VITE_SUPABASE_URL ||
  fileEnv.NEXT_PUBLIC_SUPABASE_URL ||
  '';

const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  fileEnv.VITE_SUPABASE_PUBLISHABLE_KEY ||
  fileEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

function createIsolatedTestClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env');
  }
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

describe('Live Supabase Integration & Two-Session RLS Isolation (A01, A02, A03, A04, A09, A11, A12, A13, A15, A16, A18)', () => {
  it('blocks unauthenticated (anon) queries from reading any rr_* rows (A04)', async () => {
    const anonClient = createIsolatedTestClient();
    const { data, error } = await anonClient.from('rr_returns').select('*');
    if (!error) {
      expect(data).toEqual([]);
    } else {
      expect(error).toBeTruthy();
    }
  });

  it('bootstraps idempotently (A01, A02), enforces two-session RLS & cross-workspace constraints (A03, A16), and persists mutations & reset isolation (A09, A11, A12, A13, A15, A18)', async () => {
    const clientA = createIsolatedTestClient();
    const clientB = createIsolatedTestClient();

    // A01: Bootstrap Session A and Session B
    const wsA1 = await bootstrapDemo(clientA);
    const wsA2 = await bootstrapDemo(clientA); // A02: Idempotent repeat call
    expect(wsA1.id).toBe(wsA2.id);

    const wsB = await bootstrapDemo(clientB);
    expect(wsB.id).not.toBe(wsA1.id);

    const returnsA = await fetchAllWorkspaceReturns(clientA);
    const membersA = await listMembers(clientA);
    expect(returnsA).toHaveLength(5);
    expect(membersA).toHaveLength(3);

    const returnsB = await fetchAllWorkspaceReturns(clientB);
    const membersB = await listMembers(clientB);
    expect(returnsB).toHaveLength(5);
    expect(membersB).toHaveLength(3);

    // A03: Session A cannot read or update Session B's return IDs
    await expect(getReturn(returnsB[0].id, clientA)).rejects.toThrow();

    // A16: Session A cannot assign Session B's member ID to Session A's return
    const headphonesA = returnsA.find((r) => r.name === 'Wireless Headphones')!;
    const priyaB = membersB.find((m) => m.name === 'Priya')!;
    await expect(
      assignReturn(headphonesA.id, priyaB.id, headphonesA.version, clientA)
    ).rejects.toThrow();

    // A11 & A12: Complete unchecked steps on Session A's Wireless Headphones -> Ready appears, then uncheck -> Ready disappears
    const uncheckedA = headphonesA.checklist.filter((c) => !c.checked);
    expect(uncheckedA.length).toBeGreaterThan(0);

    let latestHeadphonesA = headphonesA;
    for (const step of uncheckedA) {
      latestHeadphonesA = await setChecklistItem(step.id, true, clientA);
    }
    expect(latestHeadphonesA.is_ready).toBe(true);
    expect(latestHeadphonesA.derived_status).toBe('ready');

    // Uncheck one step -> Ready disappears (A12)
    latestHeadphonesA = await setChecklistItem(
      latestHeadphonesA.checklist[0].id,
      false,
      clientA
    );
    expect(latestHeadphonesA.is_ready).toBe(false);

    // Re-check step -> Ready again
    latestHeadphonesA = await setChecklistItem(
      latestHeadphonesA.checklist[0].id,
      true,
      clientA
    );
    expect(latestHeadphonesA.is_ready).toBe(true);

    // A09: Assign Priya in Session A and verify persistence
    const priyaA = membersA.find((m) => m.name === 'Priya')!;
    const assignedA = await assignReturn(
      latestHeadphonesA.id,
      priyaA.id,
      latestHeadphonesA.version,
      clientA
    );
    expect(assignedA.assignee_id).toBe(priyaA.id);
    expect(assignedA.assignee_name).toBe('Priya');

    // A15: Stale version on confirm is rejected with conflict
    await expect(
      assignReturn(latestHeadphonesA.id, priyaA.id, latestHeadphonesA.version, clientA)
    ).rejects.toThrow();

    // A13: Mark dropped off, then reopen
    const droppedA = await markDroppedOff(assignedA.id, assignedA.version, clientA);
    expect(droppedA.status).toBe('dropped_off');
    expect(droppedA.dropped_off_at).toBeTruthy();

    const reopenedA = await reopenReturn(droppedA.id, droppedA.version, clientA);
    expect(reopenedA.status).toBe('preparing');
    expect(reopenedA.dropped_off_at).toBeNull();

    // Modify Session B's headphones so we can verify Session A's reset does not touch Session B (A18)
    const headphonesB = returnsB.find((r) => r.name === 'Wireless Headphones')!;
    const assignedB = await assignReturn(
      headphonesB.id,
      priyaB.id,
      headphonesB.version,
      clientB
    );
    expect(assignedB.assignee_name).toBe('Priya');

    // A18: Reset Session A's demo workspace
    await resetOwnDemo(clientA);
    const returnsAAfterReset = await fetchAllWorkspaceReturns(clientA);
    const headphonesAAfterReset = returnsAAfterReset.find(
      (r) => r.name === 'Wireless Headphones'
    )!;
    expect(headphonesAAfterReset.assignee_id).toBeNull();
    expect(headphonesAAfterReset.is_ready).toBe(false);

    // Verify Session B's assignment is still intact!
    const refreshedB = await getReturn(headphonesB.id, clientB);
    expect(refreshedB.assignee_id).toBe(priyaB.id);
    expect(refreshedB.assignee_name).toBe('Priya');
  }, 90000);
});
