import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Database,
  ListChecks,
  MessageSquare,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  User,
} from 'lucide-react';
import type {
  HouseholdMember,
  NewPurchaseInput,
  PendingAction,
  ReturnDetail,
  ReturnFilter,
  ReturnItem,
  UpdatePurchaseInput,
  Workspace,
} from './types/domain';
import {
  DEFAULT_TIMEZONE,
  evaluateDeadline,
  formatDisplayDate,
  formatINRMinor,
  getTodayInTimezone,
} from './lib/dates';
import { getSupabaseClient, resolveSupabaseConfig } from './lib/supabase';
import {
  addHouseholdMember,
  assignReturn,
  bootstrapDemo,
  createPurchase,
  fetchAllWorkspaceReturns,
  filterAndSortReturns,
  getReturn,
  listMembers,
  markDroppedOff,
  reopenReturn,
  resetOwnDemo,
  setChecklistItem,
  updatePurchase,
} from './services/returns';
import { BrandLogoIcon, ProductIcon } from './components/ProductIcon';
import { StatusBadge, UrgencyBadge } from './components/StatusBadge';
import { ReturnDetailPanel } from './features/returns/ReturnDetailPanel';
import {
  AddMemberModal,
  PurchaseFormModal,
} from './features/returns/PurchaseFormModal';
import {
  AssistantPanel,
  type ChatMessage,
} from './features/assistant/AssistantPanel';
import {
  isPendingActionExpired,
  resolveConversationTurn,
} from './features/assistant/intentRouter';

const INITIAL_SUGGESTIONS = [
  'What needs returning this week?',
  'Prepare the headphones',
  'What is missing?',
  'Assign this to Priya',
  'Show overdue items',
];

function createWelcomeMessage(): ChatMessage {
  return {
    id: 'welcome-msg',
    sender: 'assistant',
    text: 'Hello! I can help you review return deadlines, check packing steps, and coordinate who will drop off an item. Try asking "What needs returning this week?" or "Prepare the headphones".',
    timestamp: new Date().toISOString(),
  };
}

export const App: React.FC = () => {
  const envConfig = useMemo(() => resolveSupabaseConfig(), []);

  // View state: 'entry' (Screen A) vs 'workspace' (Screen B)
  const [screen, setScreen] = useState<'entry' | 'workspace'>('entry');
  const [initializing, setInitializing] = useState<boolean>(true);
  const [entryError, setEntryError] = useState<string | null>(null);

  // Workspace data
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [returnsList, setReturnsList] = useState<ReturnItem[]>([]);
  const [members, setMembers] = useState<HouseholdMember[]>([]);

  // UI filter, search, and selection
  const [activeFilter, setActiveFilter] = useState<ReturnFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'returns' | 'assistant'>('returns');

  // Mutation & sync feedback
  const [syncState, setSyncState] = useState<'synced' | 'saving' | 'error'>('synced');
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [detailBanner, setDetailBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [pendingCheckIds, setPendingCheckIds] = useState<Set<string>>(new Set());
  const [actionBusy, setActionBusy] = useState<boolean>(false);

  // Pending confirmation state (shared between UI and Conversation)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  // Modals (Reset, Add/Edit Purchase, Add Member)
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [purchaseModalMode, setPurchaseModalMode] = useState<'create' | 'edit' | null>(null);
  const [showAddMemberModal, setShowAddMemberModal] = useState<boolean>(false);

  // Conversational Assistant state
  const [messages, setMessages] = useState<ChatMessage[]>([createWelcomeMessage()]);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>(INITIAL_SUGGESTIONS);
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(false);

  // Focus restoration reference when closing item details
  const lastTriggerButtonRef = useRef<HTMLButtonElement | null>(null);

  const todayDateStr = useMemo(
    () => getTodayInTimezone(workspace?.timezone ?? DEFAULT_TIMEZONE),
    [workspace?.timezone]
  );

  const speakIfEnabled = useCallback(
    (text: string) => {
      if (
        !ttsEnabled ||
        typeof window === 'undefined' ||
        !('speechSynthesis' in window)
      ) {
        return;
      }
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.02;
        window.speechSynthesis.speak(utterance);
      } catch {
        // Ignore browser speech synthesis failures
      }
    },
    [ttsEnabled]
  );

  const loadWorkspaceData = useCallback(async () => {
    setSyncState('saving');
    setEntryError(null);
    setGlobalError(null);
    try {
      const ws = await bootstrapDemo();
      const [loadedReturns, loadedMembers] = await Promise.all([
        fetchAllWorkspaceReturns(),
        listMembers(),
      ]);
      setWorkspace(ws);
      setReturnsList(loadedReturns);
      setMembers(loadedMembers);
      setScreen('workspace');
      setSyncState('synced');
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to initialize the ReturnReady Supabase workspace.';
      setEntryError(message);
      setGlobalError(message);
      setSyncState('error');
      throw err;
    }
  }, []);

  // On mount, check if an authenticated session already exists; if so, resume it automatically.
  useEffect(() => {
    let mounted = true;
    if (!envConfig.isConfigured) {
      setInitializing(false);
      return;
    }

    (async () => {
      try {
        const supabase = getSupabaseClient();
        const { data } = await supabase.auth.getSession();
        if (mounted && data.session?.user) {
          await loadWorkspaceData();
        }
      } catch {
        // Stay on entry screen with error banner if resuming fails
      } finally {
        if (mounted) {
          setInitializing(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [envConfig.isConfigured, loadWorkspaceData]);

  const handleEnterDemo = async () => {
    setInitializing(true);
    setEntryError(null);
    try {
      await loadWorkspaceData();
    } catch {
      // Error state is already stored in entryError
    } finally {
      setInitializing(false);
    }
  };

  const selectedItem: ReturnDetail | null = useMemo(() => {
    if (!selectedItemId) return null;
    return returnsList.find((r) => r.id === selectedItemId) ?? null;
  }, [returnsList, selectedItemId]);

  const filteredReturns = useMemo(
    () => filterAndSortReturns(returnsList, activeFilter, todayDateStr, searchQuery),
    [returnsList, activeFilter, todayDateStr, searchQuery]
  );

  // Summary metrics (Screen B)
  const summaryStats = useMemo(() => {
    const active = returnsList.filter((r) => r.status !== 'dropped_off');
    const dueWithinSevenDays = active.filter(
      (r) => evaluateDeadline(r.return_deadline, todayDateStr, false).isDueSoon
    );
    const overdueCount = active.filter(
      (r) => evaluateDeadline(r.return_deadline, todayDateStr, false).isOverdue
    ).length;
    const readyToDropOff = active.filter((r) => r.is_ready);
    const droppedOffCount = returnsList.filter((r) => r.status === 'dropped_off').length;

    return {
      activeCount: active.length,
      dueSoonCount: dueWithinSevenDays.length,
      overdueCount,
      readyCount: readyToDropOff.length,
      droppedOffCount,
    };
  }, [returnsList, todayDateStr]);

  const replaceReturnInState = useCallback((updated: ReturnDetail) => {
    setReturnsList((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  }, []);

  const appendAssistantMessage = useCallback(
    (
      text: string,
      options?: {
        notice?: string | null;
        card?: ChatMessage['card'];
      }
    ) => {
      const msg: ChatMessage = {
        id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        sender: 'assistant',
        text,
        notice: options?.notice ?? null,
        card: options?.card,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, msg]);
      speakIfEnabled(text);
    },
    [speakIfEnabled]
  );

  // FR-03: Checklist toggle with disabled duplicate submission & rollback/error retention
  const handleToggleChecklist = async (checkId: string, nextChecked: boolean) => {
    if (pendingCheckIds.has(checkId)) {
      return;
    }

    setDetailBanner(null);
    setGlobalError(null);
    setSyncState('saving');
    setPendingCheckIds((prev) => {
      const next = new Set(prev);
      next.add(checkId);
      return next;
    });

    try {
      const updated = await setChecklistItem(checkId, nextChecked);
      replaceReturnInState(updated);
      setSyncState('synced');

      const stepObj = updated.checklist.find((c) => c.id === checkId);
      const stepName = stepObj?.label ?? 'Checklist step';
      const readySuffix = updated.is_ready ? ' All steps complete — item is Ready to drop off.' : '';
      setDetailBanner({
        type: 'success',
        text: `${nextChecked ? 'Checked' : 'Unchecked'} "${stepName}" (${updated.completed_checks}/${updated.total_checks}).${readySuffix}`,
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to save checklist change. Previous state was retained.';
      setSyncState('error');
      setDetailBanner({ type: 'error', text: message });
      setGlobalError(message);
    } finally {
      setPendingCheckIds((prev) => {
        const next = new Set(prev);
        next.delete(checkId);
        return next;
      });
    }
  };

  // Propose Assignment (shared between UI and Assistant)
  const handleProposeAssign = useCallback(
    (item: ReturnDetail, member: HouseholdMember) => {
      setDetailBanner(null);
      setSelectedItemId(item.id);
      const nextPending: PendingAction = {
        kind: 'assign',
        itemId: item.id,
        itemName: item.name,
        memberId: member.id,
        memberName: member.name,
        expectedVersion: item.version,
        createdAtMs: Date.now(),
      };
      setPendingAction(nextPending);
    },
    []
  );

  const handleProposeDropoff = useCallback((item: ReturnDetail) => {
    setDetailBanner(null);
    setSelectedItemId(item.id);
    const incompleteCount = item.total_checks - item.completed_checks;
    const nextPending: PendingAction = {
      kind: 'dropoff',
      itemId: item.id,
      itemName: item.name,
      incompleteCount,
      totalCount: item.total_checks,
      expectedVersion: item.version,
      createdAtMs: Date.now(),
    };
    setPendingAction(nextPending);
  }, []);

  const handleProposeReopen = useCallback((item: ReturnDetail) => {
    setDetailBanner(null);
    setSelectedItemId(item.id);
    const nextPending: PendingAction = {
      kind: 'reopen',
      itemId: item.id,
      itemName: item.name,
      expectedVersion: item.version,
      createdAtMs: Date.now(),
    };
    setPendingAction(nextPending);
  }, []);

  // Execute a PendingAction with fresh version & state revalidation (PRD Section 6)
  const executePendingAction = useCallback(
    async (actionToRun: PendingAction) => {
      if (isPendingActionExpired(actionToRun)) {
        setPendingAction(null);
        const expiredMsg = `Confirmation for ${actionToRun.itemName} expired after 5 minutes. Please request the action again.`;
        setDetailBanner({ type: 'error', text: expiredMsg });
        appendAssistantMessage(expiredMsg);
        return;
      }

      setActionBusy(true);
      setSyncState('saving');
      setDetailBanner(null);
      setGlobalError(null);

      try {
        // Re-read the target item from Supabase and validate version before mutating
        const latestItem = await getReturn(actionToRun.itemId);
        replaceReturnInState(latestItem);

        if (latestItem.version !== actionToRun.expectedVersion) {
          // Version changed! Issue a fresh confirmation bound to the new version
          const refreshedPending: PendingAction =
            actionToRun.kind === 'assign'
              ? { ...actionToRun, expectedVersion: latestItem.version, createdAtMs: Date.now() }
              : actionToRun.kind === 'dropoff'
                ? {
                    ...actionToRun,
                    incompleteCount: latestItem.total_checks - latestItem.completed_checks,
                    totalCount: latestItem.total_checks,
                    expectedVersion: latestItem.version,
                    createdAtMs: Date.now(),
                  }
                : { ...actionToRun, expectedVersion: latestItem.version, createdAtMs: Date.now() };

          setPendingAction(refreshedPending);
          setSyncState('synced');
          const conflictText = `${latestItem.name} was updated since this confirmation was requested. Please review the latest state and confirm again.`;
          setDetailBanner({ type: 'error', text: conflictText });
          appendAssistantMessage(conflictText);
          return;
        }

        if (actionToRun.kind === 'assign') {
          const updated = await assignReturn(
            actionToRun.itemId,
            actionToRun.memberId,
            actionToRun.expectedVersion
          );
          replaceReturnInState(updated);
          setPendingAction(null);
          setSyncState('synced');
          const successMsg = `Assigned to ${actionToRun.memberName} in ReturnReady.`;
          setDetailBanner({ type: 'success', text: successMsg });
          appendAssistantMessage(
            `${successMsg} (${updated.name} is now assigned to ${actionToRun.memberName}; no external notification is sent.)`
          );
        } else if (actionToRun.kind === 'dropoff') {
          const updated = await markDroppedOff(
            actionToRun.itemId,
            actionToRun.expectedVersion
          );
          replaceReturnInState(updated);
          setPendingAction(null);
          setSyncState('synced');
          const incompleteNote =
            actionToRun.incompleteCount > 0
              ? ` Recorded with ${actionToRun.incompleteCount} unchecked preparation step${actionToRun.incompleteCount === 1 ? '' : 's'}.`
              : '';
          const successMsg = `Marked ${updated.name} as dropped off in ReturnReady.${incompleteNote} (User-recorded handover; refund or retailer acceptance is not verified.)`;
          setDetailBanner({ type: 'success', text: successMsg });
          appendAssistantMessage(successMsg);
        } else if (actionToRun.kind === 'reopen') {
          const updated = await reopenReturn(
            actionToRun.itemId,
            actionToRun.expectedVersion
          );
          replaceReturnInState(updated);
          setPendingAction(null);
          setSyncState('synced');
          const successMsg = `Reopened ${updated.name} for preparation (${updated.is_ready ? 'Ready' : 'Preparing'}).`;
          setDetailBanner({ type: 'success', text: successMsg });
          appendAssistantMessage(successMsg);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unable to complete the confirmed action.';
        setSyncState('error');
        setDetailBanner({ type: 'error', text: message });
        setGlobalError(message);
        appendAssistantMessage(`Could not save change: ${message}`);
      } finally {
        setActionBusy(false);
      }
    },
    [appendAssistantMessage, replaceReturnInState]
  );

  const handleConfirmPending = async () => {
    if (!pendingAction) return;
    await executePendingAction(pendingAction);
  };

  const handleCancelPending = useCallback(() => {
    if (!pendingAction) return;
    const itemName = pendingAction.itemName;
    setPendingAction(null);
    const cancelMsg = `Cancelled pending change for ${itemName}. No changes were written.`;
    setDetailBanner({ type: 'success', text: cancelMsg });
    appendAssistantMessage(cancelMsg);
  }, [appendAssistantMessage, pendingAction]);

  // Conversational Prompt Handler (PRD Section 6)
  const handleSendPrompt = async (rawPrompt: string) => {
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sender: 'user',
      text: rawPrompt,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    const resolution = resolveConversationTurn(rawPrompt, {
      items: returnsList,
      members,
      selectedItemId,
      pendingAction,
      currentFilter: activeFilter,
      todayDateStr,
    });

    if (resolution.nextFilter) {
      setActiveFilter(resolution.nextFilter);
    }
    if (resolution.nextSelectedItemId !== undefined) {
      setSelectedItemId(resolution.nextSelectedItemId);
    }
    setSuggestedPrompts(resolution.suggestedPrompts);

    if (resolution.executeAction) {
      await executePendingAction(resolution.executeAction);
      return;
    }

    setPendingAction(resolution.nextPendingAction);
    appendAssistantMessage(resolution.replyText, {
      notice: resolution.cancelledPendingNotice,
      card: resolution.card,
    });
  };

  // FR-07: Reset sample data for the authenticated user's workspace only
  const handleConfirmResetDemo = async () => {
    setActionBusy(true);
    setSyncState('saving');
    setGlobalError(null);
    try {
      const ws = await resetOwnDemo();
      const [freshReturns, freshMembers] = await Promise.all([
        fetchAllWorkspaceReturns(),
        listMembers(),
      ]);
      setWorkspace(ws);
      setReturnsList(freshReturns);
      setMembers(freshMembers);
      setSelectedItemId(null);
      setPendingAction(null);
      setActiveFilter('all');
      setSearchQuery('');
      setDetailBanner(null);
      setMessages([createWelcomeMessage()]);
      setSuggestedPrompts(INITIAL_SUGGESTIONS);
      setShowResetConfirm(false);
      setSyncState('synced');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset sample data.';
      setGlobalError(message);
      setSyncState('error');
    } finally {
      setActionBusy(false);
    }
  };

  // P1: Create / Edit Purchase & Add Member handlers
  const handleCreatePurchase = async (input: NewPurchaseInput) => {
    if (!workspace) return;
    setActionBusy(true);
    setSyncState('saving');
    try {
      const created = await createPurchase(workspace.id, input);
      setReturnsList((prev) => [...prev, created]);
      setSelectedItemId(created.id);
      setPurchaseModalMode(null);
      setSyncState('synced');
      setDetailBanner({
        type: 'success',
        text: `Added "${created.name}" with a 4-step preparation checklist.`,
      });
    } catch (err) {
      setSyncState('error');
      throw err;
    } finally {
      setActionBusy(false);
    }
  };

  const handleEditPurchase = async (input: UpdatePurchaseInput) => {
    setActionBusy(true);
    setSyncState('saving');
    try {
      const updated = await updatePurchase(input);
      replaceReturnInState(updated);
      setPurchaseModalMode(null);
      setSyncState('synced');
      setDetailBanner({
        type: 'success',
        text: `Saved updated details for "${updated.name}".`,
      });
    } catch (err) {
      setSyncState('error');
      throw err;
    } finally {
      setActionBusy(false);
    }
  };

  const handleAddMember = async (memberName: string) => {
    if (!workspace) return;
    setActionBusy(true);
    setSyncState('saving');
    try {
      const created = await addHouseholdMember(workspace.id, memberName);
      setMembers((prev) => [...prev, created]);
      setSyncState('synced');
      setDetailBanner({
        type: 'success',
        text: `Added "${created.name}" to your household workspace.`,
      });
    } catch (err) {
      setSyncState('error');
      throw err;
    } finally {
      setActionBusy(false);
    }
  };

  const handleCloseDetail = useCallback(() => {
    setSelectedItemId(null);
    setDetailBanner(null);
    if (lastTriggerButtonRef.current) {
      lastTriggerButtonRef.current.focus();
    }
  }, []);

  // ==========================================================================
  // SCREEN A: ENTRY / CONFIGURATION / INITIALIZATION
  // ==========================================================================
  if (screen === 'entry') {
    return (
      <main className="rr-entry-shell" data-testid="entry-screen">
        <div className="rr-entry-card">
          <div className="rr-entry-brand">
            <BrandLogoIcon size={38} />
            <span className="rr-entry-wordmark">ReturnReady</span>
          </div>

          <h1 className="rr-entry-heading">Get your returns ready.</h1>
          <p className="rr-entry-subtext">
            Track deadlines, prepare items, and coordinate your next drop-off.
          </p>

          <div className="rr-entry-pillars">
            <div className="rr-entry-pillar">
              <strong>Know what is due</strong>
              <span>Clear 7-day deadline window in INR</span>
            </div>
            <div className="rr-entry-pillar">
              <strong>Prepare what is needed</strong>
              <span>Item-specific packing checklists</span>
            </div>
            <div className="rr-entry-pillar">
              <strong>Decide who handles it</strong>
              <span>Confirmed household assignment</span>
            </div>
          </div>

          {!envConfig.isConfigured ? (
            <div className="rr-inline-banner rr-banner-error" role="alert" data-testid="config-missing-alert">
              <AlertCircle size={18} aria-hidden="true" />
              <div>
                <strong>Supabase configuration required</strong>
                <p>
                  Missing environment variables: <code>{envConfig.missingVars.join(', ')}</code>.
                  Copy <code>.env.example</code> to <code>.env</code> and set your dedicated
                  ReturnReady Supabase URL and publishable key.
                </p>
              </div>
            </div>
          ) : (
            <div className="rr-entry-cta-group">
              <button
                type="button"
                className="rr-btn rr-btn-primary rr-btn-lg"
                disabled={initializing}
                onClick={handleEnterDemo}
                data-testid="try-sample-household-btn"
              >
                {initializing ? (
                  <>
                    <RefreshCw size={18} className="rr-spin" aria-hidden="true" />
                    <span>Preparing isolated sample household…</span>
                  </>
                ) : (
                  <span>Try sample household</span>
                )}
              </button>

              <div className="rr-entry-notice" data-testid="simulation-notice">
                <Sparkles size={14} aria-hidden="true" />
                <span>Alexa+ experience simulation · Sample data · No retailer connection</span>
              </div>
            </div>
          )}

          {entryError && (
            <div className="rr-setup-guide" role="alert" data-testid="entry-error-box">
              <div className="rr-inline-banner rr-banner-error" style={{ marginBottom: '0.75rem' }}>
                <AlertCircle size={17} aria-hidden="true" />
                <span>{entryError}</span>
              </div>
              <h3>Actionable database setup checklist</h3>
              <ol>
                <li>
                  Open your dedicated ReturnReady Supabase Studio SQL Editor (
                  <code>{envConfig.url}</code>).
                </li>
                <li>
                  Paste and run{' '}
                  <code>supabase/migrations/20261023000001_returnready_schema.sql</code> to create
                  the <code>rr_*</code> tables, RLS policies, and RPC functions.
                </li>
                <li>
                  Click <strong>Retry initialization</strong> below to bootstrap your isolated
                  sample household.
                </li>
              </ol>
              <div style={{ marginTop: '0.85rem' }}>
                <button
                  type="button"
                  className="rr-btn rr-btn-secondary rr-btn-sm"
                  disabled={initializing}
                  onClick={handleEnterDemo}
                  data-testid="retry-bootstrap-btn"
                >
                  <RefreshCw size={15} aria-hidden="true" />
                  <span>Retry initialization</span>
                </button>
              </div>
            </div>
          )}

          <p className="rr-entry-footnote">
            Each browser session gets an isolated Supabase workspace with 5 sample purchases and 3
            household member names. Clearing browser storage or switching devices starts a new
            demo session.
          </p>
        </div>
      </main>
    );
  }

  // ==========================================================================
  // SCREEN B: MAIN HOUSEHOLD WORKSPACE
  // ==========================================================================
  return (
    <div className="rr-app-shell" data-testid="workspace-screen">
      {/* Top Header */}
      <header className="rr-topbar">
        <div className="rr-topbar-inner">
          <div className="rr-topbar-brand">
            <BrandLogoIcon size={32} />
            <div>
              <span className="rr-brand-title">ReturnReady</span>
            </div>
            <div className="rr-topbar-badges">
              <span className="rr-header-pill rr-header-pill-sim" data-testid="header-sim-badge">
                <Sparkles size={13} aria-hidden="true" />
                <span>Alexa+ experience simulation · Sample data</span>
              </span>
              <span
                className={`rr-header-pill ${
                  syncState === 'saving'
                    ? 'rr-header-pill-saving'
                    : syncState === 'error'
                      ? 'rr-header-pill-error'
                      : 'rr-header-pill-sync'
                }`}
                data-testid="connection-status-pill"
              >
                <Database size={13} aria-hidden="true" />
                <span>
                  {syncState === 'saving'
                    ? 'Saving to Supabase…'
                    : syncState === 'error'
                      ? 'Save error'
                      : 'Supabase connected'}
                </span>
              </span>
            </div>
          </div>

          <div className="rr-topbar-actions">
            <button
              type="button"
              className="rr-btn rr-btn-secondary rr-btn-sm"
              onClick={() => setPurchaseModalMode('create')}
              data-testid="add-purchase-btn"
            >
              <Plus size={16} aria-hidden="true" />
              <span>Add return</span>
            </button>
            <button
              type="button"
              className="rr-btn rr-btn-ghost rr-btn-sm"
              onClick={() => setShowResetConfirm(true)}
              data-testid="reset-demo-btn"
            >
              <RotateCcw size={15} aria-hidden="true" />
              <span>Reset sample data</span>
            </button>
          </div>
        </div>
      </header>

      <main className="rr-main-container">
        {globalError && (
          <div className="rr-inline-banner rr-banner-error" role="alert" data-testid="global-error-banner">
            <AlertCircle size={17} aria-hidden="true" />
            <span style={{ flex: 1 }}>{globalError}</span>
            <button
              type="button"
              className="rr-btn rr-btn-secondary rr-btn-xs"
              onClick={() => loadWorkspaceData()}
            >
              Retry sync
            </button>
          </div>
        )}

        {/* Summary Cards Row */}
        <section className="rr-summary-grid" aria-label="Household return summary">
          <div className="rr-summary-card" data-testid="summary-active-card">
            <div>
              <span className="rr-summary-label">Active returns</span>
              <div className="rr-summary-value">{summaryStats.activeCount}</div>
              <span className="rr-summary-caption">
                {summaryStats.overdueCount > 0
                  ? `${summaryStats.overdueCount} past recorded deadline`
                  : 'All within recorded dates'}
              </span>
            </div>
            <div className="rr-summary-icon rr-summary-icon-navy" aria-hidden="true">
              <Package size={22} />
            </div>
          </div>

          <div className="rr-summary-card" data-testid="summary-due-soon-card">
            <div>
              <span className="rr-summary-label">Due within 7 days</span>
              <div className="rr-summary-value">{summaryStats.dueSoonCount}</div>
              <span className="rr-summary-caption">
                Today ({formatDisplayDate(todayDateStr)}) through +7 days
              </span>
            </div>
            <div className="rr-summary-icon rr-summary-icon-amber" aria-hidden="true">
              <CalendarClock size={22} />
            </div>
          </div>

          <div className="rr-summary-card" data-testid="summary-ready-card">
            <div>
              <span className="rr-summary-label">Ready to drop off</span>
              <div className="rr-summary-value">{summaryStats.readyCount}</div>
              <span className="rr-summary-caption">
                All packing checks complete · {summaryStats.droppedOffCount} handed over
              </span>
            </div>
            <div className="rr-summary-icon rr-summary-icon-teal" aria-hidden="true">
              <CheckCircle2 size={22} />
            </div>
          </div>
        </section>

        {/* Mobile Accessible Navigation between Returns and Assistant */}
        <nav className="rr-mobile-tabs" aria-label="Workspace panels">
          <button
            type="button"
            className={`rr-mobile-tab ${mobileTab === 'returns' ? 'is-active' : ''}`}
            onClick={() => setMobileTab('returns')}
            aria-current={mobileTab === 'returns' ? 'page' : undefined}
          >
            <ListChecks size={17} aria-hidden="true" />
            <span>Returns ({summaryStats.activeCount})</span>
          </button>
          <button
            type="button"
            className={`rr-mobile-tab ${mobileTab === 'assistant' ? 'is-active' : ''}`}
            onClick={() => setMobileTab('assistant')}
            aria-current={mobileTab === 'assistant' ? 'page' : undefined}
          >
            <MessageSquare size={17} aria-hidden="true" />
            <span>Assistant {pendingAction ? '• 1 Pending' : ''}</span>
          </button>
        </nav>

        {/* Split Workspace: Purchase List + Item Details on Left, Assistant on Right */}
        <div className="rr-workspace-grid">
          <div
            className={`rr-returns-column ${
              mobileTab === 'assistant' ? 'rr-hide-mobile-panel' : ''
            }`}
          >
            {/* Filters & Search */}
            <div className="rr-controls-bar">
              <div className="rr-filter-pills" role="group" aria-label="Filter returns">
                {(
                  [
                    { id: 'all', label: 'All active', count: summaryStats.activeCount },
                    { id: 'due_soon', label: 'Due soon', count: summaryStats.dueSoonCount },
                    { id: 'overdue', label: 'Overdue', count: summaryStats.overdueCount },
                    { id: 'ready', label: 'Ready', count: summaryStats.readyCount },
                    { id: 'dropped_off', label: 'Dropped off', count: summaryStats.droppedOffCount },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={`rr-filter-btn ${activeFilter === tab.id ? 'is-active' : ''}`}
                    onClick={() => setActiveFilter(tab.id)}
                    data-testid={`filter-btn-${tab.id}`}
                  >
                    <span>{tab.label}</span>
                    <span className="rr-filter-count">{tab.count}</span>
                  </button>
                ))}
              </div>

              <div className="rr-search-box">
                <Search size={15} className="rr-search-icon" aria-hidden="true" />
                <input
                  type="search"
                  className="rr-search-input"
                  placeholder="Search product or merchant…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search returns by product name or merchant"
                  data-testid="search-returns-input"
                />
              </div>
            </div>

            {/* Purchase List */}
            {filteredReturns.length === 0 ? (
              <div className="rr-empty-state" data-testid="empty-returns-state">
                <p>No returns match the current filter.</p>
                {activeFilter !== 'all' || searchQuery ? (
                  <button
                    type="button"
                    className="rr-btn rr-btn-secondary rr-btn-sm"
                    style={{ marginTop: '0.75rem' }}
                    onClick={() => {
                      setActiveFilter('all');
                      setSearchQuery('');
                    }}
                  >
                    Show all active returns
                  </button>
                ) : null}
              </div>
            ) : (
              <ul className="rr-returns-list" data-testid="returns-list">
                {filteredReturns.map((item) => {
                  const urgency = evaluateDeadline(
                    item.return_deadline,
                    todayDateStr,
                    item.status === 'dropped_off'
                  );
                  const isSelected = item.id === selectedItemId;

                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={`rr-return-card ${isSelected ? 'is-selected' : ''}`}
                        onClick={(e) => {
                          lastTriggerButtonRef.current = e.currentTarget;
                          setSelectedItemId(item.id);
                          setDetailBanner(null);
                        }}
                        aria-expanded={isSelected}
                        data-testid={`return-card-${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                      >
                        <div className="rr-return-card-left">
                          <ProductIcon name={item.name} />
                          <div className="rr-return-card-body">
                            <div className="rr-return-card-top">
                              <span className="rr-return-name">{item.name}</span>
                              <span className="rr-return-merchant">· {item.merchant}</span>
                            </div>

                            <div className="rr-return-meta-row">
                              <UrgencyBadge urgency={urgency} />
                              <span>Deadline {formatDisplayDate(item.return_deadline)}</span>
                              <span className="rr-return-owner">
                                <User size={13} aria-hidden="true" />
                                <span>{item.assignee_name ?? 'Unassigned'}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="rr-return-card-right">
                          <span className="rr-return-amount">
                            {formatINRMinor(item.amount_minor)}
                          </span>
                          <StatusBadge
                            status={item.derived_status}
                            completedChecks={item.completed_checks}
                            totalChecks={item.total_checks}
                          />
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Screen C: Item Details Panel */}
            {selectedItem && (
              <ReturnDetailPanel
                item={selectedItem}
                members={members}
                todayDateStr={todayDateStr}
                pendingCheckIds={pendingCheckIds}
                actionBusy={actionBusy}
                pendingAction={pendingAction}
                statusMessage={detailBanner}
                onClose={handleCloseDetail}
                onToggleCheck={handleToggleChecklist}
                onProposeAssign={handleProposeAssign}
                onProposeDropoff={handleProposeDropoff}
                onProposeReopen={handleProposeReopen}
                onConfirmPendingAction={handleConfirmPending}
                onCancelPendingAction={handleCancelPending}
                onOpenEditPurchase={() => setPurchaseModalMode('edit')}
                onOpenAddMember={() => setShowAddMemberModal(true)}
              />
            )}
          </div>

          {/* Right Column: Conversational Assistant */}
          <div className={mobileTab === 'returns' ? 'rr-hide-mobile-panel' : ''}>
            <AssistantPanel
              messages={messages}
              suggestedPrompts={suggestedPrompts}
              pendingAction={pendingAction}
              selectedItem={selectedItem}
              busy={actionBusy}
              ttsEnabled={ttsEnabled}
              onToggleTts={() => setTtsEnabled((v) => !v)}
              onSendPrompt={handleSendPrompt}
              onSelectItemFromCard={(item) => {
                setSelectedItemId(item.id);
                setMobileTab('returns');
              }}
              onProposeAssignFromCard={(item, member) => {
                handleProposeAssign(item, member);
              }}
              onConfirmPending={handleConfirmPending}
              onCancelPending={handleCancelPending}
            />
          </div>
        </div>
      </main>

      {/* Reset Demo Confirmation Modal (FR-07) */}
      {showResetConfirm && (
        <div
          className="rr-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-modal-title"
          data-testid="reset-confirm-modal"
        >
          <div className="rr-modal-card rr-modal-sm">
            <h2 id="reset-modal-title" className="rr-modal-title">
              Reset your sample household?
            </h2>
            <p className="rr-modal-subtitle">
              This resets only your current browser session’s demo workspace back to the five
              initial sample purchases anchored to today ({formatDisplayDate(todayDateStr)}). Other
              sessions are unaffected.
            </p>
            <div className="rr-modal-footer">
              <button
                type="button"
                className="rr-btn rr-btn-secondary"
                disabled={actionBusy}
                onClick={() => setShowResetConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rr-btn rr-btn-danger"
                disabled={actionBusy}
                onClick={handleConfirmResetDemo}
                data-testid="confirm-reset-btn"
              >
                {actionBusy ? 'Resetting…' : 'Reset sample data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* P1 Purchase Create/Edit Modal (FR-06) */}
      {purchaseModalMode && (
        <PurchaseFormModal
          mode={purchaseModalMode}
          initialItem={purchaseModalMode === 'edit' ? selectedItem : null}
          todayDateStr={todayDateStr}
          busy={actionBusy}
          onClose={() => setPurchaseModalMode(null)}
          onSubmitCreate={handleCreatePurchase}
          onSubmitEdit={handleEditPurchase}
        />
      )}

      {/* P1 Add Household Member Modal */}
      {showAddMemberModal && (
        <AddMemberModal
          busy={actionBusy}
          onClose={() => setShowAddMemberModal(false)}
          onAddMember={handleAddMember}
        />
      )}
    </div>
  );
};

export default App;
