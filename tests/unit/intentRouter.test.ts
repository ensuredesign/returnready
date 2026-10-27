import { describe, expect, it } from 'vitest';
import {
  PENDING_CONFIRMATION_TTL_MS,
  resolveConversationTurn,
} from '../../src/features/assistant/intentRouter';
import { hydrateReturnRow } from '../../src/services/returns';
import type { HouseholdMember, ReturnItem } from '../../src/types/domain';

const TODAY = '2026-10-23';

const SAMPLE_MEMBERS: HouseholdMember[] = [
  { id: 'mem-me', workspace_id: 'ws-1', name: 'Me', created_at: '2026-10-23T00:00:00Z' },
  { id: 'mem-priya', workspace_id: 'ws-1', name: 'Priya', created_at: '2026-10-23T00:00:00Z' },
  { id: 'mem-alex', workspace_id: 'ws-1', name: 'Alex', created_at: '2026-10-23T00:00:00Z' },
];

function createFixtureItems(): ReturnItem[] {
  return [
    hydrateReturnRow({
      id: 'ret-headphones',
      workspace_id: 'ws-1',
      name: 'Wireless Headphones',
      merchant: 'Demo Electronics',
      amount_minor: 499900,
      currency: 'INR',
      purchase_date: '2026-10-13',
      return_deadline: '2026-10-24', // Today + 1
      deadline_note: '',
      status: 'preparing',
      assignee_id: null,
      is_sample: true,
      version: 2,
      dropped_off_at: null,
      created_at: '2026-10-23T00:00:00Z',
      updated_at: '2026-10-23T00:00:00Z',
      rr_checklist_items: [
        {
          id: 'chk-1',
          workspace_id: 'ws-1',
          return_id: 'ret-headphones',
          label: 'Headphones',
          checked: true,
          sort_order: 1,
          updated_at: '2026-10-23T00:00:00Z',
        },
        {
          id: 'chk-2',
          workspace_id: 'ws-1',
          return_id: 'ret-headphones',
          label: 'Charging cable',
          checked: false,
          sort_order: 2,
          updated_at: '2026-10-23T00:00:00Z',
        },
        {
          id: 'chk-3',
          workspace_id: 'ws-1',
          return_id: 'ret-headphones',
          label: 'Receipt',
          checked: true,
          sort_order: 3,
          updated_at: '2026-10-23T00:00:00Z',
        },
        {
          id: 'chk-4',
          workspace_id: 'ws-1',
          return_id: 'ret-headphones',
          label: 'Protective packaging',
          checked: false,
          sort_order: 4,
          updated_at: '2026-10-23T00:00:00Z',
        },
      ],
    }),
    hydrateReturnRow({
      id: 'ret-shoes',
      workspace_id: 'ws-1',
      name: 'Running Shoes',
      merchant: 'Demo Sports',
      amount_minor: 279900,
      currency: 'INR',
      purchase_date: '2026-10-13',
      return_deadline: '2026-10-26', // Today + 3
      deadline_note: '',
      status: 'preparing',
      assignee_id: 'mem-priya',
      is_sample: true,
      version: 1,
      dropped_off_at: null,
      created_at: '2026-10-23T00:00:00Z',
      updated_at: '2026-10-23T00:00:00Z',
      rr_members: { id: 'mem-priya', name: 'Priya' },
      rr_checklist_items: [
        {
          id: 'chk-5',
          workspace_id: 'ws-1',
          return_id: 'ret-shoes',
          label: 'Both shoes',
          checked: true,
          sort_order: 1,
          updated_at: '2026-10-23T00:00:00Z',
        },
      ],
    }),
    hydrateReturnRow({
      id: 'ret-backpack',
      workspace_id: 'ws-1',
      name: 'Travel Backpack',
      merchant: 'Demo Outdoors',
      amount_minor: 199900,
      currency: 'INR',
      purchase_date: '2026-10-13',
      return_deadline: '2026-10-22', // Today - 1 (overdue)
      deadline_note: '',
      status: 'preparing',
      assignee_id: null,
      is_sample: true,
      version: 1,
      dropped_off_at: null,
      created_at: '2026-10-23T00:00:00Z',
      updated_at: '2026-10-23T00:00:00Z',
      rr_checklist_items: [
        {
          id: 'chk-6',
          workspace_id: 'ws-1',
          return_id: 'ret-backpack',
          label: 'Empty all pockets',
          checked: false,
          sort_order: 1,
          updated_at: '2026-10-23T00:00:00Z',
        },
      ],
    }),
  ];
}

describe('Conversational intent router (PRD Section 6, A05, A07, A08, A09, A10, A13, A17)', () => {
  it('lists only items due within today..today+7 inclusive on "What needs returning this week?" (A05)', () => {
    const items = createFixtureItems();
    const res = resolveConversationTurn('What needs returning this week?', {
      items,
      members: SAMPLE_MEMBERS,
      selectedItemId: null,
      pendingAction: null,
      currentFilter: 'all',
      todayDateStr: TODAY,
    });

    expect(res.intent).toBe('list_due');
    expect(res.nextFilter).toBe('due_soon');
    expect(res.card?.items?.map((i) => i.id)).toEqual(['ret-headphones', 'ret-shoes']);
    expect(res.replyText).toContain('Wireless Headphones');
    expect(res.replyText).toContain('Running Shoes');
    expect(res.replyText).not.toContain('Travel Backpack');
  });

  it('selects Wireless Headphones via name or alias ("Prepare the headphones" / "headset") and lists unchecked steps on "What is missing?" (A07)', () => {
    const items = createFixtureItems();

    const selectRes = resolveConversationTurn('Prepare the headphones', {
      items,
      members: SAMPLE_MEMBERS,
      selectedItemId: null,
      pendingAction: null,
      currentFilter: 'all',
      todayDateStr: TODAY,
    });

    expect(selectRes.intent).toBe('select_item');
    expect(selectRes.nextSelectedItemId).toBe('ret-headphones');

    const missingRes = resolveConversationTurn('What is missing?', {
      items,
      members: SAMPLE_MEMBERS,
      selectedItemId: selectRes.nextSelectedItemId!,
      pendingAction: null,
      currentFilter: 'all',
      todayDateStr: TODAY,
    });

    expect(missingRes.intent).toBe('missing_checks');
    expect(missingRes.replyText).toContain('Charging cable');
    expect(missingRes.replyText).toContain('Protective packaging');
    expect(missingRes.replyText).not.toContain('Receipt.');
  });

  it('creates a version-bound PendingAction on "Assign this to Priya" and supports Cancel (A08) and Confirm (A09)', () => {
    const items = createFixtureItems();
    const nowMs = 1_700_000_000_000;

    const proposeRes = resolveConversationTurn('Assign this to Priya', {
      items,
      members: SAMPLE_MEMBERS,
      selectedItemId: 'ret-headphones',
      pendingAction: null,
      currentFilter: 'all',
      todayDateStr: TODAY,
      nowMs,
    });

    expect(proposeRes.intent).toBe('propose_assignment');
    expect(proposeRes.nextPendingAction).toEqual({
      kind: 'assign',
      itemId: 'ret-headphones',
      itemName: 'Wireless Headphones',
      memberId: 'mem-priya',
      memberName: 'Priya',
      expectedVersion: 2,
      createdAtMs: nowMs,
    });

    // Cancel path (A08)
    const cancelRes = resolveConversationTurn('Cancel', {
      items,
      members: SAMPLE_MEMBERS,
      selectedItemId: 'ret-headphones',
      pendingAction: proposeRes.nextPendingAction,
      currentFilter: 'all',
      todayDateStr: TODAY,
      nowMs: nowMs + 1000,
    });

    expect(cancelRes.intent).toBe('cancel_pending');
    expect(cancelRes.nextPendingAction).toBeNull();
    expect(cancelRes.executeAction).toBeUndefined();

    // Confirm path (A09)
    const confirmRes = resolveConversationTurn('Yes', {
      items,
      members: SAMPLE_MEMBERS,
      selectedItemId: 'ret-headphones',
      pendingAction: proposeRes.nextPendingAction,
      currentFilter: 'all',
      todayDateStr: TODAY,
      nowMs: nowMs + 1000,
    });

    expect(confirmRes.intent).toBe('confirm_pending');
    expect(confirmRes.executeAction).toEqual(proposeRes.nextPendingAction);
  });

  it('does not mutate and explains clearly when "Yes" is sent without a pending action (A10)', () => {
    const items = createFixtureItems();
    const res = resolveConversationTurn('Yes', {
      items,
      members: SAMPLE_MEMBERS,
      selectedItemId: 'ret-headphones',
      pendingAction: null,
      currentFilter: 'all',
      todayDateStr: TODAY,
    });

    expect(res.intent).toBe('confirm_pending');
    expect(res.executeAction).toBeUndefined();
    expect(res.replyText).toContain('no pending action');
  });

  it('expires pending confirmations after 5 minutes', () => {
    const items = createFixtureItems();
    const startMs = 1_700_000_000_000;
    const proposeRes = resolveConversationTurn('Assign this to Priya', {
      items,
      members: SAMPLE_MEMBERS,
      selectedItemId: 'ret-headphones',
      pendingAction: null,
      currentFilter: 'all',
      todayDateStr: TODAY,
      nowMs: startMs,
    });

    const expiredConfirm = resolveConversationTurn('Confirm', {
      items,
      members: SAMPLE_MEMBERS,
      selectedItemId: 'ret-headphones',
      pendingAction: proposeRes.nextPendingAction,
      currentFilter: 'all',
      todayDateStr: TODAY,
      nowMs: startMs + PENDING_CONFIRMATION_TTL_MS + 1000,
    });

    expect(expiredConfirm.executeAction).toBeUndefined();
    expect(expiredConfirm.replyText).toContain('expired');
  });

  it('cancels an active pending action with a brief notice when an unrelated command arrives', () => {
    const items = createFixtureItems();
    const proposeRes = resolveConversationTurn('Assign this to Priya', {
      items,
      members: SAMPLE_MEMBERS,
      selectedItemId: 'ret-headphones',
      pendingAction: null,
      currentFilter: 'all',
      todayDateStr: TODAY,
    });

    const nextRes = resolveConversationTurn('Show overdue items', {
      items,
      members: SAMPLE_MEMBERS,
      selectedItemId: 'ret-headphones',
      pendingAction: proposeRes.nextPendingAction,
      currentFilter: 'all',
      todayDateStr: TODAY,
    });

    expect(nextRes.intent).toBe('list_overdue');
    expect(nextRes.nextPendingAction).toBeNull();
    expect(nextRes.cancelledPendingNotice).toContain('Cancelled unconfirmed');
  });

  it('blocks batch mutations ("Mark these as dropped off") and asks which single item', () => {
    const items = createFixtureItems();
    const res = resolveConversationTurn('Mark these as dropped off', {
      items,
      members: SAMPLE_MEMBERS,
      selectedItemId: null,
      pendingAction: null,
      currentFilter: 'all',
      todayDateStr: TODAY,
    });

    expect(res.intent).toBe('ambiguous_mutation');
    expect(res.nextPendingAction).toBeNull();
    expect(res.replyText).toContain('one return at a time');
  });

  it('states incomplete checklist counts honestly when proposing drop-off (A13)', () => {
    const items = createFixtureItems();
    const res = resolveConversationTurn('Mark the headphones dropped off', {
      items,
      members: SAMPLE_MEMBERS,
      selectedItemId: null,
      pendingAction: null,
      currentFilter: 'all',
      todayDateStr: TODAY,
    });

    expect(res.intent).toBe('propose_dropoff');
    expect(res.nextPendingAction?.kind).toBe('dropoff');
    expect(res.replyText).toContain('2 of 4 preparation steps are still unchecked');
    expect(res.replyText).toContain('does not verify retailer acceptance or refund');
  });

  it('produces helpful guidance without fabricating actions on unknown or out-of-scope requests (A17)', () => {
    const items = createFixtureItems();
    const unknownRes = resolveConversationTurn('Sing me a pirate song', {
      items,
      members: SAMPLE_MEMBERS,
      selectedItemId: null,
      pendingAction: null,
      currentFilter: 'all',
      todayDateStr: TODAY,
    });

    expect(unknownRes.intent).toBe('unknown');
    expect(unknownRes.nextPendingAction).toBeNull();
    expect(unknownRes.card?.type).toBe('help_card');

    const refundRes = resolveConversationTurn('When will Amazon refund my credit card?', {
      items,
      members: SAMPLE_MEMBERS,
      selectedItemId: null,
      pendingAction: null,
      currentFilter: 'all',
      todayDateStr: TODAY,
    });

    expect(refundRes.intent).toBe('unsupported_out_of_scope');
    expect(refundRes.replyText).toContain('does not connect to retailers');
  });
});
