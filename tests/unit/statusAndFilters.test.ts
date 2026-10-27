import { describe, expect, it } from 'vitest';
import {
  deriveReturnStatus,
  filterAndSortReturns,
  hydrateReturnRow,
} from '../../src/services/returns';
import type { ReturnItem } from '../../src/types/domain';

function makeSampleItems(today: string): ReturnItem[] {
  const rawRows = [
    {
      id: 'ret-headphones',
      workspace_id: 'ws-1',
      name: 'Wireless Headphones',
      merchant: 'Demo Electronics',
      amount_minor: 499900,
      currency: 'INR' as const,
      purchase_date: '2026-10-13',
      return_deadline: '2026-10-24', // today + 1
      deadline_note: '',
      status: 'preparing' as const,
      assignee_id: null,
      is_sample: true,
      version: 1,
      dropped_off_at: null,
      created_at: `${today}T00:00:00Z`,
      updated_at: `${today}T00:00:00Z`,
      rr_checklist_items: [
        {
          id: 'c1',
          workspace_id: 'ws-1',
          return_id: 'ret-headphones',
          label: 'Headphones',
          checked: true,
          sort_order: 1,
          updated_at: `${today}T00:00:00Z`,
        },
        {
          id: 'c2',
          workspace_id: 'ws-1',
          return_id: 'ret-headphones',
          label: 'Charging cable',
          checked: false,
          sort_order: 2,
          updated_at: `${today}T00:00:00Z`,
        },
      ],
    },
    {
      id: 'ret-shoes',
      workspace_id: 'ws-1',
      name: 'Running Shoes',
      merchant: 'Demo Sports',
      amount_minor: 279900,
      currency: 'INR' as const,
      purchase_date: '2026-10-13',
      return_deadline: '2026-10-30', // today + 7 (inclusive boundary)
      deadline_note: '',
      status: 'preparing' as const,
      assignee_id: 'mem-priya',
      is_sample: true,
      version: 2,
      dropped_off_at: null,
      created_at: `${today}T00:00:00Z`,
      updated_at: `${today}T00:00:00Z`,
      rr_members: { id: 'mem-priya', name: 'Priya' },
      rr_checklist_items: [
        {
          id: 'c3',
          workspace_id: 'ws-1',
          return_id: 'ret-shoes',
          label: 'Both shoes',
          checked: true,
          sort_order: 1,
          updated_at: `${today}T00:00:00Z`,
        },
        {
          id: 'c4',
          workspace_id: 'ws-1',
          return_id: 'ret-shoes',
          label: 'Original box',
          checked: true,
          sort_order: 2,
          updated_at: `${today}T00:00:00Z`,
        },
      ],
    },
    {
      id: 'ret-backpack',
      workspace_id: 'ws-1',
      name: 'Travel Backpack',
      merchant: 'Demo Outdoors',
      amount_minor: 199900,
      currency: 'INR' as const,
      purchase_date: '2026-10-13',
      return_deadline: '2026-10-22', // today - 1 (overdue)
      deadline_note: '',
      status: 'preparing' as const,
      assignee_id: null,
      is_sample: true,
      version: 1,
      dropped_off_at: null,
      created_at: `${today}T00:00:00Z`,
      updated_at: `${today}T00:00:00Z`,
      rr_checklist_items: [
        {
          id: 'c5',
          workspace_id: 'ws-1',
          return_id: 'ret-backpack',
          label: 'Empty all pockets',
          checked: false,
          sort_order: 1,
          updated_at: `${today}T00:00:00Z`,
        },
      ],
    },
    {
      id: 'ret-grinder',
      workspace_id: 'ws-1',
      name: 'Coffee Grinder',
      merchant: 'Demo Kitchen',
      amount_minor: 349900,
      currency: 'INR' as const,
      purchase_date: '2026-10-13',
      return_deadline: '2026-10-31', // today + 8 (outside due_soon)
      deadline_note: '',
      status: 'dropped_off' as const,
      assignee_id: null,
      is_sample: true,
      version: 3,
      dropped_off_at: `${today}T10:00:00Z`,
      created_at: `${today}T00:00:00Z`,
      updated_at: `${today}T00:00:00Z`,
      rr_checklist_items: [
        {
          id: 'c6',
          workspace_id: 'ws-1',
          return_id: 'ret-grinder',
          label: 'Grinder',
          checked: true,
          sort_order: 1,
          updated_at: `${today}T00:00:00Z`,
        },
      ],
    },
  ];

  return rawRows.map((r) => hydrateReturnRow(r));
}

describe('Derived Ready status and list filtering (FR-02, FR-04, A11, A12)', () => {
  it('derives Ready when all checklist items are checked and status is not dropped_off (A11)', () => {
    const res = deriveReturnStatus('preparing', [{ checked: true }, { checked: true }]);
    expect(res.isReady).toBe(true);
    expect(res.derivedStatus).toBe('ready');
    expect(res.completedChecks).toBe(2);
    expect(res.totalChecks).toBe(2);
  });

  it('removes derived Ready immediately when a single step is unchecked (A12)', () => {
    const res = deriveReturnStatus('preparing', [{ checked: true }, { checked: false }]);
    expect(res.isReady).toBe(false);
    expect(res.derivedStatus).toBe('preparing');
  });

  it('requires at least one checklist item for Ready to apply', () => {
    const res = deriveReturnStatus('planning', []);
    expect(res.isReady).toBe(false);
    expect(res.derivedStatus).toBe('planning');
  });

  it('keeps dropped_off status even when all checklist steps are checked', () => {
    const res = deriveReturnStatus('dropped_off', [{ checked: true }]);
    expect(res.isReady).toBe(false);
    expect(res.derivedStatus).toBe('dropped_off');
  });

  it('filters active, due_soon, overdue, ready, and dropped_off accurately', () => {
    const today = '2026-10-23';
    const items = makeSampleItems(today);

    const allActive = filterAndSortReturns(items, 'all', today);
    expect(allActive.map((i) => i.id)).toEqual([
      'ret-backpack',
      'ret-headphones',
      'ret-shoes',
    ]);

    const dueSoon = filterAndSortReturns(items, 'due_soon', today);
    expect(dueSoon.map((i) => i.id)).toEqual(['ret-headphones', 'ret-shoes']);

    const overdue = filterAndSortReturns(items, 'overdue', today);
    expect(overdue.map((i) => i.id)).toEqual(['ret-backpack']);

    const ready = filterAndSortReturns(items, 'ready', today);
    expect(ready.map((i) => i.id)).toEqual(['ret-shoes']);

    const droppedOff = filterAndSortReturns(items, 'dropped_off', today);
    expect(droppedOff.map((i) => i.id)).toEqual(['ret-grinder']);
  });

  it('matches product name and merchant case-insensitively', () => {
    const today = '2026-10-23';
    const items = makeSampleItems(today);

    expect(filterAndSortReturns(items, 'all', today, 'SPORTS').map((i) => i.id)).toEqual([
      'ret-shoes',
    ]);
    expect(filterAndSortReturns(items, 'all', today, 'wireless').map((i) => i.id)).toEqual([
      'ret-headphones',
    ]);
  });
});
