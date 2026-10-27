import React, { useEffect, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import type { NewPurchaseInput, ReturnDetail, UpdatePurchaseInput } from '../../types/domain';
import { addCalendarDays } from '../../lib/dates';

interface PurchaseFormModalProps {
  mode: 'create' | 'edit';
  initialItem?: ReturnDetail | null;
  todayDateStr: string;
  busy: boolean;
  onClose: () => void;
  onSubmitCreate: (input: NewPurchaseInput) => Promise<void>;
  onSubmitEdit: (input: UpdatePurchaseInput) => Promise<void>;
}

export const PurchaseFormModal: React.FC<PurchaseFormModalProps> = ({
  mode,
  initialItem,
  todayDateStr,
  busy,
  onClose,
  onSubmitCreate,
  onSubmitEdit,
}) => {
  const defaultPurchaseDate = initialItem?.purchase_date ?? addCalendarDays(todayDateStr, -3);
  const defaultDeadline = initialItem?.return_deadline ?? addCalendarDays(todayDateStr, 5);
  const defaultAmount =
    initialItem !== undefined && initialItem !== null
      ? (initialItem.amount_minor / 100).toString()
      : '';

  const [name, setName] = useState(initialItem?.name ?? '');
  const [merchant, setMerchant] = useState(initialItem?.merchant ?? '');
  const [amountRupees, setAmountRupees] = useState(defaultAmount);
  const [purchaseDate, setPurchaseDate] = useState(defaultPurchaseDate);
  const [returnDeadline, setReturnDeadline] = useState(defaultDeadline);
  const [deadlineNote, setDeadlineNote] = useState(initialItem?.deadline_note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const isDirty =
    name !== (initialItem?.name ?? '') ||
    merchant !== (initialItem?.merchant ?? '') ||
    amountRupees !== defaultAmount ||
    purchaseDate !== defaultPurchaseDate ||
    returnDeadline !== defaultDeadline ||
    deadlineNote !== (initialItem?.deadline_note ?? '');

  const handleRequestClose = () => {
    if (isDirty && !confirmDiscard) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (isDirty && !confirmDiscard) {
          setConfirmDiscard(true);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDirty, confirmDiscard, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (mode === 'edit' && initialItem) {
        await onSubmitEdit({
          id: initialItem.id,
          name,
          merchant,
          amountRupees,
          purchaseDate,
          returnDeadline,
          deadlineNote,
        });
      } else {
        await onSubmitCreate({
          name,
          merchant,
          amountRupees,
          purchaseDate,
          returnDeadline,
          deadlineNote,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save purchase.');
    }
  };

  return (
    <div className="rr-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="purchase-modal-title">
      <div className="rr-modal-card">
        <div className="rr-modal-header">
          <h2 id="purchase-modal-title" className="rr-modal-title">
            {mode === 'edit' ? `Edit ${initialItem?.name ?? 'return'}` : 'Add household return'}
          </h2>
          <button
            type="button"
            className="rr-btn rr-btn-ghost rr-btn-icon"
            onClick={handleRequestClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <p className="rr-modal-subtitle">
          Enter your recorded dates and INR value. Editing dates updates your household plan and does
          not modify retailer eligibility.
        </p>

        {error && (
          <div className="rr-inline-banner rr-banner-error" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {confirmDiscard && (
          <div className="rr-confirmation-box" role="alertdialog" aria-label="Discard unsaved changes">
            <p className="rr-confirmation-copy">
              You have unsaved changes. Discard them and close this form?
            </p>
            <div className="rr-confirmation-actions">
              <button type="button" className="rr-btn rr-btn-danger" onClick={onClose}>
                Discard changes
              </button>
              <button
                type="button"
                className="rr-btn rr-btn-secondary"
                onClick={() => setConfirmDiscard(false)}
              >
                Keep editing
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="rr-form">
          <div className="rr-form-field">
            <label htmlFor="purchase-name">Product name (1–100 chars)</label>
            <input
              id="purchase-name"
              type="text"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Blender Pitcher"
              className="rr-input"
            />
          </div>

          <div className="rr-form-row">
            <div className="rr-form-field">
              <label htmlFor="purchase-merchant">Merchant label (1–100 chars)</label>
              <input
                id="purchase-merchant"
                type="text"
                required
                maxLength={100}
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                placeholder="e.g., Demo Appliances"
                className="rr-input"
              />
            </div>

            <div className="rr-form-field">
              <label htmlFor="purchase-amount">Amount (INR ₹)</label>
              <input
                id="purchase-amount"
                type="text"
                inputMode="decimal"
                required
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value)}
                placeholder="e.g., 2499.00"
                className="rr-input rr-mono"
              />
            </div>
          </div>

          <div className="rr-form-row">
            <div className="rr-form-field">
              <label htmlFor="purchase-date">Purchase date</label>
              <input
                id="purchase-date"
                type="date"
                required
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="rr-input"
              />
            </div>

            <div className="rr-form-field">
              <label htmlFor="return-deadline">Recorded return deadline</label>
              <input
                id="return-deadline"
                type="date"
                required
                value={returnDeadline}
                onChange={(e) => setReturnDeadline(e.target.value)}
                className="rr-input"
              />
            </div>
          </div>

          <div className="rr-form-field">
            <label htmlFor="deadline-note">Deadline & packing note (optional, max 500 chars)</label>
            <textarea
              id="deadline-note"
              rows={2}
              maxLength={500}
              value={deadlineNote}
              onChange={(e) => setDeadlineNote(e.target.value)}
              placeholder="User-entered note, e.g., include original manual and box insert."
              className="rr-textarea"
            />
          </div>

          <div className="rr-modal-footer">
            <button
              type="button"
              className="rr-btn rr-btn-secondary"
              disabled={busy}
              onClick={handleRequestClose}
            >
              Cancel
            </button>
            <button type="submit" className="rr-btn rr-btn-primary" disabled={busy}>
              {busy ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Add return'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface AddMemberModalProps {
  busy: boolean;
  onClose: () => void;
  onAddMember: (name: string) => Promise<void>;
}

export const AddMemberModal: React.FC<AddMemberModalProps> = ({ busy, onClose, onAddMember }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await onAddMember(name);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add member name.');
    }
  };

  return (
    <div className="rr-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="member-modal-title">
      <div className="rr-modal-card rr-modal-sm">
        <div className="rr-modal-header">
          <h2 id="member-modal-title" className="rr-modal-title">
            Add household member name
          </h2>
          <button
            type="button"
            className="rr-btn rr-btn-ghost rr-btn-icon"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <p className="rr-modal-subtitle">
          Household members are assignable names within your workspace, not separate logged-in
          accounts.
        </p>

        {error && (
          <div className="rr-inline-banner rr-banner-error" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="rr-form">
          <div className="rr-form-field">
            <label htmlFor="member-name-input">Member name</label>
            <input
              id="member-name-input"
              type="text"
              required
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Rohan"
              className="rr-input"
              autoFocus
            />
          </div>

          <div className="rr-modal-footer">
            <button type="button" className="rr-btn rr-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="rr-btn rr-btn-primary" disabled={busy}>
              {busy ? 'Adding…' : 'Add member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
