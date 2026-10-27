import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckSquare,
  Edit3,
  Info,
  RotateCcw,
  ShieldAlert,
  Square,
  Truck,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import type {
  HouseholdMember,
  PendingAction,
  ReturnDetail,
} from '../../types/domain';
import {
  evaluateDeadline,
  formatDisplayDate,
  formatINRMinor,
} from '../../lib/dates';
import { ProductIcon } from '../../components/ProductIcon';
import { StatusBadge, UrgencyBadge } from '../../components/StatusBadge';

interface ReturnDetailPanelProps {
  item: ReturnDetail;
  members: HouseholdMember[];
  todayDateStr: string;
  pendingCheckIds: ReadonlySet<string>;
  actionBusy: boolean;
  pendingAction: PendingAction | null;
  statusMessage: { type: 'success' | 'error'; text: string } | null;
  onClose: () => void;
  onToggleCheck: (checkId: string, nextChecked: boolean) => Promise<void>;
  onProposeAssign: (item: ReturnDetail, member: HouseholdMember) => void;
  onProposeDropoff: (item: ReturnDetail) => void;
  onProposeReopen: (item: ReturnDetail) => void;
  onConfirmPendingAction: () => Promise<void>;
  onCancelPendingAction: () => void;
  onOpenEditPurchase: (item: ReturnDetail) => void;
  onOpenAddMember: () => void;
}

export const ReturnDetailPanel: React.FC<ReturnDetailPanelProps> = ({
  item,
  members,
  todayDateStr,
  pendingCheckIds,
  actionBusy,
  pendingAction,
  statusMessage,
  onClose,
  onToggleCheck,
  onProposeAssign,
  onProposeDropoff,
  onProposeReopen,
  onConfirmPendingAction,
  onCancelPendingAction,
  onOpenEditPurchase,
  onOpenAddMember,
}) => {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    item.assignee_id ?? (members[0]?.id ?? '')
  );

  useEffect(() => {
    setSelectedMemberId(item.assignee_id ?? (members[0]?.id ?? ''));
  }, [item.id, item.assignee_id, members]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const isDroppedOff = item.status === 'dropped_off';
  const urgency = evaluateDeadline(item.return_deadline, todayDateStr, isDroppedOff);
  const incompleteChecks = item.total_checks - item.completed_checks;
  const isItemPendingAction = pendingAction && pendingAction.itemId === item.id;

  const handleRequestAssign = () => {
    const member = members.find((m) => m.id === selectedMemberId);
    if (member) {
      onProposeAssign(item, member);
    }
  };

  return (
    <aside
      className="rr-detail-panel"
      aria-label={`Return details for ${item.name}`}
      data-testid="return-detail-panel"
    >
      <div className="rr-detail-header">
        <div className="rr-detail-title-row">
          <ProductIcon name={item.name} />
          <div className="rr-detail-heading-group">
            <div className="rr-detail-eyebrow">
              <span>{item.merchant}</span>
              {item.is_sample && <span className="rr-pill-tag">Sample record</span>}
            </div>
            <h2 className="rr-detail-title">{item.name}</h2>
          </div>
        </div>
        <div className="rr-detail-header-actions">
          <button
            type="button"
            className="rr-btn rr-btn-ghost rr-btn-icon"
            onClick={() => onOpenEditPurchase(item)}
            title="Edit return details"
            aria-label={`Edit ${item.name}`}
          >
            <Edit3 size={18} />
          </button>
          <button
            ref={closeButtonRef}
            type="button"
            className="rr-btn rr-btn-ghost rr-btn-icon"
            onClick={onClose}
            aria-label="Close item details"
            data-testid="close-detail-btn"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Status & Urgency Row */}
      <div className="rr-detail-badges">
        <StatusBadge
          status={item.derived_status}
          completedChecks={item.completed_checks}
          totalChecks={item.total_checks}
        />
        <UrgencyBadge urgency={urgency} />
      </div>

      {/* Persistent feedback banner */}
      {statusMessage && (
        <div
          role={statusMessage.type === 'error' ? 'alert' : 'status'}
          className={`rr-inline-banner ${
            statusMessage.type === 'error' ? 'rr-banner-error' : 'rr-banner-success'
          }`}
          data-testid="detail-status-banner"
        >
          {statusMessage.type === 'error' ? (
            <AlertCircle size={16} aria-hidden="true" />
          ) : (
            <Check size={16} aria-hidden="true" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Pending Action Confirmation Box */}
      {isItemPendingAction && pendingAction && (
        <div
          className="rr-confirmation-box"
          role="region"
          aria-label="Confirm pending change"
          data-testid="detail-confirmation-box"
        >
          <div className="rr-confirmation-header">
            <ShieldAlert size={18} aria-hidden="true" />
            <strong>Confirm change</strong>
          </div>
          {pendingAction.kind === 'assign' && (
            <p className="rr-confirmation-copy">
              Assign <strong>{pendingAction.itemName}</strong> to{' '}
              <strong>{pendingAction.memberName}</strong>? This updates your household workspace in
              ReturnReady (no external notification is sent).
            </p>
          )}
          {pendingAction.kind === 'dropoff' && (
            <p className="rr-confirmation-copy">
              Mark <strong>{pendingAction.itemName}</strong> as dropped off?{' '}
              {pendingAction.incompleteCount > 0 ? (
                <span className="rr-warning-inline">
                  <strong>
                    {pendingAction.incompleteCount} of {pendingAction.totalCount} preparation check
                    {pendingAction.incompleteCount === 1 ? ' is' : 's are'} still incomplete.
                  </strong>{' '}
                </span>
              ) : (
                <span>All {pendingAction.totalCount} preparation steps are checked. </span>
              )}
              “Dropped off” records your household handover and does not verify retailer acceptance
              or a refund.
            </p>
          )}
          {pendingAction.kind === 'reopen' && (
            <p className="rr-confirmation-copy">
              Reopen <strong>{pendingAction.itemName}</strong>? This clears the dropped-off
              timestamp and unlocks the preparation checklist.
            </p>
          )}
          <div className="rr-confirmation-actions">
            <button
              type="button"
              className="rr-btn rr-btn-primary"
              disabled={actionBusy}
              onClick={onConfirmPendingAction}
              data-testid="detail-confirm-btn"
            >
              {actionBusy ? 'Saving…' : 'Confirm'}
            </button>
            <button
              type="button"
              className="rr-btn rr-btn-secondary"
              disabled={actionBusy}
              onClick={onCancelPendingAction}
              data-testid="detail-cancel-btn"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Metadata Grid */}
      <div className="rr-detail-meta-grid">
        <div className="rr-meta-cell">
          <span className="rr-meta-label">Purchase value</span>
          <strong className="rr-meta-value rr-mono">{formatINRMinor(item.amount_minor)}</strong>
        </div>
        <div className="rr-meta-cell">
          <span className="rr-meta-label">Purchase date</span>
          <strong className="rr-meta-value">{formatDisplayDate(item.purchase_date)}</strong>
        </div>
        <div className="rr-meta-cell">
          <span className="rr-meta-label">Recorded deadline</span>
          <strong className="rr-meta-value">{formatDisplayDate(item.return_deadline)}</strong>
        </div>
        <div className="rr-meta-cell">
          <span className="rr-meta-label">Assigned owner</span>
          <strong className="rr-meta-value" data-testid="detail-assignee-value">
            {item.assignee_name ?? 'Unassigned'}
          </strong>
        </div>
      </div>

      {item.deadline_note && (
        <div className="rr-detail-note">
          <span className="rr-detail-note-label">Recorded note:</span> {item.deadline_note}
        </div>
      )}

      <div className="rr-policy-disclaimer">
        <Info size={15} aria-hidden="true" />
        <span>User-entered deadline; retailer eligibility has not been verified.</span>
      </div>

      {/* Checklist Section (FR-03 & FR-04) */}
      <section className="rr-detail-section" aria-labelledby="checklist-heading">
        <div className="rr-section-header">
          <div>
            <h3 id="checklist-heading" className="rr-section-title">
              Preparation checklist
            </h3>
            <p className="rr-section-subtitle">
              Suggested preparation steps, not retailer requirements.
            </p>
          </div>
          <span className="rr-checklist-counter rr-mono" data-testid="checklist-counter">
            {item.completed_checks} / {item.total_checks} complete
          </span>
        </div>

        {isDroppedOff && (
          <div className="rr-locked-notice">
            Checklist editing is locked while this item is marked dropped off. Reopen the item below
            to modify steps.
          </div>
        )}

        <ul className="rr-checklist-list">
          {item.checklist.map((step) => {
            const isSavingThisStep = pendingCheckIds.has(step.id);
            const disabled = isDroppedOff || isSavingThisStep || actionBusy;
            return (
              <li key={step.id} className="rr-checklist-row">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={step.checked}
                  disabled={disabled}
                  onClick={() => onToggleCheck(step.id, !step.checked)}
                  className={`rr-checklist-toggle ${step.checked ? 'is-checked' : ''}`}
                  data-testid={`checklist-item-${step.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                >
                  <span className="rr-check-icon" aria-hidden="true">
                    {step.checked ? <CheckSquare size={20} /> : <Square size={20} />}
                  </span>
                  <span className="rr-check-label">{step.label}</span>
                  {isSavingThisStep && <span className="rr-saving-pill">Saving…</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Household Assignment Section (FR-05) */}
      <section className="rr-detail-section" aria-labelledby="assignment-heading">
        <div className="rr-section-header">
          <div>
            <h3 id="assignment-heading" className="rr-section-title">
              Household responsibility
            </h3>
            <p className="rr-section-subtitle">
              Assign a member name in this workspace. No messages or notifications are sent.
            </p>
          </div>
          <button
            type="button"
            className="rr-btn rr-btn-ghost rr-btn-sm"
            onClick={onOpenAddMember}
          >
            <UserPlus size={15} aria-hidden="true" />
            <span>Add name</span>
          </button>
        </div>

        <div className="rr-assign-controls">
          <label htmlFor="detail-member-select" className="rr-sr-only">
            Select household member
          </label>
          <select
            id="detail-member-select"
            className="rr-select"
            value={selectedMemberId}
            onChange={(e) => setSelectedMemberId(e.target.value)}
            disabled={actionBusy}
            data-testid="detail-member-select"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rr-btn rr-btn-secondary"
            disabled={actionBusy || !selectedMemberId}
            onClick={handleRequestAssign}
            data-testid="propose-assign-btn"
          >
            <UserCheck size={16} aria-hidden="true" />
            <span>Assign</span>
          </button>
        </div>
      </section>

      {/* Drop-off / Reopen Action Section (FR-04) */}
      <section className="rr-detail-section rr-dropoff-section" aria-labelledby="dropoff-heading">
        <h3 id="dropoff-heading" className="rr-section-title">
          Handover status
        </h3>
        <p className="rr-section-subtitle">
          “Dropped off” means a user-recorded handover, not refund received or retailer acceptance.
        </p>

        {!isDroppedOff ? (
          <button
            type="button"
            className="rr-btn rr-btn-primary rr-btn-full"
            disabled={actionBusy}
            onClick={() => onProposeDropoff(item)}
            data-testid="propose-dropoff-btn"
          >
            <Truck size={17} aria-hidden="true" />
            <span>
              Mark dropped off
              {incompleteChecks > 0
                ? ` (${incompleteChecks} step${incompleteChecks === 1 ? '' : 's'} unchecked)`
                : ' (Ready)'}
            </span>
          </button>
        ) : (
          <div className="rr-dropped-summary">
            <p className="rr-dropped-timestamp">
              Recorded dropped off
              {item.dropped_off_at
                ? ` on ${new Date(item.dropped_off_at).toLocaleString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}`
                : ''}
              .
            </p>
            <button
              type="button"
              className="rr-btn rr-btn-secondary rr-btn-full"
              disabled={actionBusy}
              onClick={() => onProposeReopen(item)}
              data-testid="propose-reopen-btn"
            >
              <RotateCcw size={16} aria-hidden="true" />
              <span>Reopen return for preparation</span>
            </button>
          </div>
        )}
      </section>
    </aside>
  );
};
