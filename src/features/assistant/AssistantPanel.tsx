import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  HelpCircle,
  MessageSquare,
  Send,
  ShieldAlert,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type {
  HouseholdMember,
  PendingAction,
  ReturnItem,
} from '../../types/domain';
import type { AssistantActionCard } from './intentRouter';
import { formatDisplayDate } from '../../lib/dates';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  notice?: string | null;
  card?: AssistantActionCard;
  timestamp: string;
}

interface AssistantPanelProps {
  messages: ChatMessage[];
  suggestedPrompts: string[];
  pendingAction: PendingAction | null;
  selectedItem: ReturnItem | null;
  busy: boolean;
  ttsEnabled: boolean;
  onToggleTts: () => void;
  onSendPrompt: (text: string) => Promise<void>;
  onSelectItemFromCard: (item: ReturnItem) => void;
  onProposeAssignFromCard: (item: ReturnItem, member: HouseholdMember) => void;
  onConfirmPending: () => Promise<void>;
  onCancelPending: () => void;
}

export const AssistantPanel: React.FC<AssistantPanelProps> = ({
  messages,
  suggestedPrompts,
  pendingAction,
  selectedItem,
  busy,
  ttsEnabled,
  onToggleTts,
  onSendPrompt,
  onSelectItemFromCard,
  onProposeAssignFromCard,
  onConfirmPending,
  onCancelPending,
}) => {
  const [input, setInput] = useState('');
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (
      transcriptEndRef.current &&
      typeof transcriptEndRef.current.scrollIntoView === 'function'
    ) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [messages.length, pendingAction]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || busy) {
      return;
    }
    setInput('');
    await onSendPrompt(trimmed);
  };

  const supportsSpeech =
    typeof window !== 'undefined' && 'speechSynthesis' in window;

  return (
    <section
      className="rr-assistant-panel"
      aria-label="Alexa+ experience simulation conversation"
      data-testid="assistant-panel"
    >
      <div className="rr-assistant-header">
        <div className="rr-assistant-title-group">
          <div className="rr-assistant-orb" aria-hidden="true">
            <Sparkles size={17} />
          </div>
          <div>
            <div className="rr-assistant-title-row">
              <h2 className="rr-assistant-title">ReturnReady Assistant</h2>
              <span className="rr-sim-pill">Alexa+ simulation</span>
            </div>
            <p className="rr-assistant-subtitle">
              Rule-based household return coordinator · Confirmed writes to Supabase
            </p>
          </div>
        </div>

        {supportsSpeech && (
          <button
            type="button"
            className="rr-btn rr-btn-ghost rr-btn-sm"
            onClick={onToggleTts}
            aria-pressed={ttsEnabled}
            title={ttsEnabled ? 'Mute browser speech output' : 'Enable browser speech output'}
          >
            {ttsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            <span className="rr-hide-xs">{ttsEnabled ? 'Voice On' : 'Voice Off'}</span>
          </button>
        )}
      </div>

      {/* Contextual bar showing active selection */}
      <div className="rr-assistant-context-bar" data-testid="assistant-context-bar">
        <span className="rr-context-label">Active context:</span>
        {selectedItem ? (
          <span className="rr-context-item">
            <strong>{selectedItem.name}</strong> ({selectedItem.completed_checks}/
            {selectedItem.total_checks} checks ·{' '}
            {selectedItem.assignee_name ? `Assigned to ${selectedItem.assignee_name}` : 'Unassigned'})
          </span>
        ) : (
          <span className="rr-context-empty">No item selected — ask to prepare an item</span>
        )}
      </div>

      {/* Message Transcript */}
      <div className="rr-assistant-transcript" role="log" aria-live="polite">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`rr-chat-turn ${msg.sender === 'user' ? 'is-user' : 'is-assistant'}`}
            data-testid={`chat-turn-${msg.sender}`}
          >
            <div className="rr-chat-bubble">
              {msg.notice && (
                <div className="rr-chat-cancelled-notice">{msg.notice}</div>
              )}
              <p className="rr-chat-text">{msg.text}</p>

              {/* Structured Card Attachment */}
              {msg.card && msg.card.type === 'items_summary' && msg.card.items && (
                <div className="rr-chat-card">
                  <ul className="rr-chat-item-list">
                    {msg.card.items.map((item) => (
                      <li key={item.id} className="rr-chat-item-row">
                        <div className="rr-chat-item-info">
                          <strong>{item.name}</strong>
                          <span>
                            Due {formatDisplayDate(item.return_deadline)} ·{' '}
                            {item.is_ready
                              ? 'Ready'
                              : `${item.completed_checks}/${item.total_checks} steps`}
                            {item.assignee_name ? ` · ${item.assignee_name}` : ''}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="rr-btn rr-btn-secondary rr-btn-xs"
                          onClick={() => onSelectItemFromCard(item)}
                        >
                          Prepare
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {msg.card && msg.card.type === 'checklist_preview' && msg.card.targetItem && (
                <div className="rr-chat-card">
                  <div className="rr-chat-card-header">
                    <strong>{msg.card.targetItem.name} checklist</strong>
                    <span className="rr-mono">
                      {msg.card.targetItem.completed_checks}/{msg.card.targetItem.total_checks}
                    </span>
                  </div>
                  <ul className="rr-chat-checklist-preview">
                    {msg.card.targetItem.checklist.map((step) => (
                      <li
                        key={step.id}
                        className={step.checked ? 'is-done' : 'is-missing'}
                      >
                        {step.checked ? (
                          <CheckCircle2 size={14} aria-hidden="true" />
                        ) : (
                          <Square size={14} aria-hidden="true" />
                        )}
                        <span>{step.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {msg.card && msg.card.type === 'disambiguation' && (
                <div className="rr-chat-card">
                  {msg.card.candidateItems && msg.card.candidateItems.length > 0 && (
                    <div className="rr-disambiguation-group">
                      <span className="rr-disambiguation-label">Select an item:</span>
                      <div className="rr-pill-group">
                        {msg.card.candidateItems.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="rr-prompt-pill"
                            onClick={() => onSelectItemFromCard(item)}
                          >
                            {item.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {msg.card.candidateMembers &&
                    msg.card.candidateMembers.length > 0 &&
                    msg.card.targetItem && (
                      <div className="rr-disambiguation-group">
                        <span className="rr-disambiguation-label">
                          Choose who will handle {msg.card.targetItem.name}:
                        </span>
                        <div className="rr-pill-group">
                          {msg.card.candidateMembers.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              className="rr-prompt-pill"
                              onClick={() =>
                                onProposeAssignFromCard(msg.card!.targetItem!, m)
                              }
                            >
                              Assign to {m.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              )}

              {msg.card && msg.card.type === 'help_card' && (
                <div className="rr-chat-card rr-help-card">
                  <div className="rr-chat-card-header">
                    <HelpCircle size={15} aria-hidden="true" />
                    <strong>Supported voice & text requests</strong>
                  </div>
                  <ul className="rr-help-list">
                    <li>“What needs returning this week?”</li>
                    <li>“Show overdue items” or “Show all returns”</li>
                    <li>“Prepare the headphones”</li>
                    <li>“What is missing?”</li>
                    <li>“Assign this to Priya” → Confirm / Cancel</li>
                    <li>“Mark the headphones dropped off” → Confirm / Cancel</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Active Pending Confirmation Action Card */}
        {pendingAction && (
          <div
            className="rr-chat-pending-card"
            role="region"
            aria-label="Pending action confirmation"
            data-testid="assistant-pending-card"
          >
            <div className="rr-chat-pending-header">
              <ShieldAlert size={16} aria-hidden="true" />
              <strong>Confirmation required</strong>
            </div>
            <p className="rr-chat-pending-copy">
              {pendingAction.kind === 'assign' && (
                <>
                  Assign <strong>{pendingAction.itemName}</strong> to{' '}
                  <strong>{pendingAction.memberName}</strong>?
                </>
              )}
              {pendingAction.kind === 'dropoff' && (
                <>
                  Record <strong>{pendingAction.itemName}</strong> as dropped off?{' '}
                  {pendingAction.incompleteCount > 0
                    ? `(${pendingAction.incompleteCount} of ${pendingAction.totalCount} steps still unchecked)`
                    : `(All ${pendingAction.totalCount} steps checked)`}
                </>
              )}
              {pendingAction.kind === 'reopen' && (
                <>
                  Reopen <strong>{pendingAction.itemName}</strong> for preparation?
                </>
              )}
            </p>
            <div className="rr-chat-pending-actions">
              <button
                type="button"
                className="rr-btn rr-btn-primary rr-btn-sm"
                disabled={busy}
                onClick={onConfirmPending}
                data-testid="assistant-confirm-btn"
              >
                {busy ? 'Saving…' : 'Confirm'}
              </button>
              <button
                type="button"
                className="rr-btn rr-btn-secondary rr-btn-sm"
                disabled={busy}
                onClick={onCancelPending}
                data-testid="assistant-cancel-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div ref={transcriptEndRef} />
      </div>

      {/* Suggested Prompts */}
      <div className="rr-assistant-suggestions" aria-label="Suggested prompts">
        {suggestedPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className="rr-prompt-pill"
            disabled={busy}
            onClick={() => onSendPrompt(prompt)}
          >
            <MessageSquare size={13} aria-hidden="true" />
            <span>{prompt}</span>
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="rr-assistant-input-bar">
        <label htmlFor="assistant-chat-input" className="rr-sr-only">
          Ask ReturnReady about your returns
        </label>
        <input
          id="assistant-chat-input"
          type="text"
          className="rr-assistant-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='Ask "What needs returning this week?" or "Prepare the headphones"…'
          disabled={busy}
          data-testid="assistant-input"
        />
        <button
          type="submit"
          className="rr-btn rr-btn-primary rr-send-btn"
          disabled={busy || !input.trim()}
          aria-label="Send request"
          data-testid="assistant-send-btn"
        >
          <Send size={17} aria-hidden="true" />
          <span className="rr-hide-xs">Ask</span>
        </button>
      </form>
    </section>
  );
};
