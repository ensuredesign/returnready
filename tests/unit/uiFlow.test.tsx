import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/App';
import { hydrateReturnRow } from '../../src/services/returns';
import type { HouseholdMember, ReturnItem, Workspace } from '../../src/types/domain';

const mockWorkspace: Workspace = {
  id: 'ws-test-1',
  owner_user_id: 'user-test-1',
  name: 'Sample Household',
  timezone: 'Asia/Kolkata',
  seed_version: 1,
  created_at: '2026-10-23T00:00:00Z',
};

const mockMembers: HouseholdMember[] = [
  { id: 'mem-me', workspace_id: 'ws-test-1', name: 'Me', created_at: '2026-10-23T00:00:00Z' },
  { id: 'mem-priya', workspace_id: 'ws-test-1', name: 'Priya', created_at: '2026-10-23T00:00:00Z' },
  { id: 'mem-alex', workspace_id: 'ws-test-1', name: 'Alex', created_at: '2026-10-23T00:00:00Z' },
];

function buildMockReturns(): ReturnItem[] {
  return [
    hydrateReturnRow({
      id: 'ret-headphones',
      workspace_id: 'ws-test-1',
      name: 'Wireless Headphones',
      merchant: 'Demo Electronics',
      amount_minor: 499900,
      currency: 'INR',
      purchase_date: '2026-10-13',
      return_deadline: '2026-10-24',
      deadline_note: 'Keep charging cable together.',
      status: 'preparing',
      assignee_id: null,
      is_sample: true,
      version: 1,
      dropped_off_at: null,
      created_at: '2026-10-23T00:00:00Z',
      updated_at: '2026-10-23T00:00:00Z',
      rr_checklist_items: [
        {
          id: 'chk-1',
          workspace_id: 'ws-test-1',
          return_id: 'ret-headphones',
          label: 'Headphones',
          checked: true,
          sort_order: 1,
          updated_at: '2026-10-23T00:00:00Z',
        },
        {
          id: 'chk-2',
          workspace_id: 'ws-test-1',
          return_id: 'ret-headphones',
          label: 'Charging cable',
          checked: false,
          sort_order: 2,
          updated_at: '2026-10-23T00:00:00Z',
        },
      ],
    }),
  ];
}

const mockBootstrapDemo = vi.fn();
const mockFetchAllWorkspaceReturns = vi.fn();
const mockListMembers = vi.fn();
const mockSetChecklistItem = vi.fn();
const mockGetReturn = vi.fn();
const mockAssignReturn = vi.fn();
const mockMarkDroppedOff = vi.fn();

vi.mock('../../src/lib/supabase', () => ({
  resolveSupabaseConfig: () => ({
    url: 'https://returnready-sb.propixer.in',
    publishableKey: 'test-anon-key',
    isConfigured: true,
    missingVars: [],
  }),
  getSupabaseClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  }),
  ensureDemoSession: vi.fn(),
}));

vi.mock('../../src/services/returns', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/returns')>();
  return {
    ...actual,
    bootstrapDemo: (...args: unknown[]) => mockBootstrapDemo(...args),
    fetchAllWorkspaceReturns: (...args: unknown[]) => mockFetchAllWorkspaceReturns(...args),
    listMembers: (...args: unknown[]) => mockListMembers(...args),
    setChecklistItem: (...args: unknown[]) => mockSetChecklistItem(...args),
    getReturn: (...args: unknown[]) => mockGetReturn(...args),
    assignReturn: (...args: unknown[]) => mockAssignReturn(...args),
    markDroppedOff: (...args: unknown[]) => mockMarkDroppedOff(...args),
  };
});

describe('UI Workspace, Error Retention, Stale Confirmation & Keyboard Accessibility (A08, A09, A14, A15, A19)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBootstrapDemo.mockResolvedValue(mockWorkspace);
    mockFetchAllWorkspaceReturns.mockResolvedValue(buildMockReturns());
    mockListMembers.mockResolvedValue(mockMembers);
  });

  it('enters workspace on "Try sample household", retains state on checklist network error (A14), and transitions to Ready on success (A11)', async () => {
    const user = userEvent.setup();
    render(<App />);

    const enterBtn = await screen.findByTestId('try-sample-household-btn');
    await user.click(enterBtn);

    await screen.findByTestId('workspace-screen');
    expect(screen.getByText('Wireless Headphones')).toBeInTheDocument();

    // Open Wireless Headphones details
    await user.click(screen.getByTestId('return-card-wireless-headphones'));
    await screen.findByTestId('return-detail-panel');

    // Simulate network failure on checking "Charging cable" (A14)
    mockSetChecklistItem.mockRejectedValueOnce(
      new Error('Network error while reaching Supabase. Check your connection and retry.')
    );

    const cableCheckbox = screen.getByTestId('checklist-item-charging-cable');
    expect(cableCheckbox).toHaveAttribute('aria-checked', 'false');
    await user.click(cableCheckbox);

    // Verify no false success and old unchecked state is preserved
    const banner = await screen.findByTestId('detail-status-banner');
    expect(banner).toHaveTextContent(/Network error/i);
    expect(screen.getByTestId('checklist-item-charging-cable')).toHaveAttribute(
      'aria-checked',
      'false'
    );

    // Now simulate successful persistence (A11)
    const updatedItem = hydrateReturnRow({
      id: 'ret-headphones',
      workspace_id: 'ws-test-1',
      name: 'Wireless Headphones',
      merchant: 'Demo Electronics',
      amount_minor: 499900,
      currency: 'INR',
      purchase_date: '2026-10-13',
      return_deadline: '2026-10-24',
      deadline_note: 'Keep charging cable together.',
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
          workspace_id: 'ws-test-1',
          return_id: 'ret-headphones',
          label: 'Headphones',
          checked: true,
          sort_order: 1,
          updated_at: '2026-10-23T00:00:00Z',
        },
        {
          id: 'chk-2',
          workspace_id: 'ws-test-1',
          return_id: 'ret-headphones',
          label: 'Charging cable',
          checked: true,
          sort_order: 2,
          updated_at: '2026-10-23T00:00:00Z',
        },
      ],
    });
    mockSetChecklistItem.mockResolvedValueOnce(updatedItem);

    await user.click(screen.getByTestId('checklist-item-charging-cable'));
    await waitFor(() => {
      expect(screen.getByTestId('checklist-item-charging-cable')).toHaveAttribute(
        'aria-checked',
        'true'
      );
    });
    expect(screen.getAllByTestId('status-badge-ready').length).toBeGreaterThan(0);
  });

  it('detects stale version during confirmation and prompts for fresh confirmation without mutating (A15)', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByTestId('try-sample-household-btn'));
    await screen.findByTestId('workspace-screen');

    // Ask assistant to prepare headphones and assign to Priya
    const chatInput = screen.getByTestId('assistant-input');
    await user.type(chatInput, 'Prepare the headphones');
    await user.click(screen.getByTestId('assistant-send-btn'));

    await user.type(chatInput, 'Assign this to Priya');
    await user.click(screen.getByTestId('assistant-send-btn'));

    await screen.findByTestId('assistant-pending-card');

    // Simulate that the item version changed on the server from 1 to 3 before Confirm is clicked
    const newerServerItem = {
      ...buildMockReturns()[0],
      version: 3,
    };
    mockGetReturn.mockResolvedValueOnce(newerServerItem);

    await user.click(screen.getByTestId('assistant-confirm-btn'));

    await waitFor(() => {
      expect(mockAssignReturn).not.toHaveBeenCalled();
    });
    expect(screen.getByTestId('detail-status-banner')).toHaveTextContent(
      /updated since this confirmation was requested/i
    );
  });

  it('supports keyboard Escape to close item details and restores focus to triggering card (A19)', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByTestId('try-sample-household-btn'));
    await screen.findByTestId('workspace-screen');

    const cardBtn = screen.getByTestId('return-card-wireless-headphones');
    await user.click(cardBtn);
    await screen.findByTestId('return-detail-panel');

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByTestId('return-detail-panel')).not.toBeInTheDocument();
    });
    expect(cardBtn).toHaveFocus();
  });
});
