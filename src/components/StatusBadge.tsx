import React from 'react';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ClipboardList,
  Clock,
  PackageCheck,
} from 'lucide-react';
import type { VisibleReturnStatus } from '../types/domain';
import type { DeadlineUrgency } from '../lib/dates';

interface StatusBadgeProps {
  status: VisibleReturnStatus;
  completedChecks?: number;
  totalChecks?: number;
}

/**
 * Accessible status badge using both distinct icons and text labels (never color alone).
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  completedChecks,
  totalChecks,
}) => {
  switch (status) {
    case 'ready':
      return (
        <span className="rr-badge rr-badge-ready" data-testid="status-badge-ready">
          <CheckCircle2 size={14} aria-hidden="true" />
          <span>Ready to drop off</span>
        </span>
      );
    case 'dropped_off':
      return (
        <span className="rr-badge rr-badge-dropped" data-testid="status-badge-dropped_off">
          <Archive size={14} aria-hidden="true" />
          <span>Dropped off</span>
        </span>
      );
    case 'preparing':
      return (
        <span className="rr-badge rr-badge-preparing" data-testid="status-badge-preparing">
          <PackageCheck size={14} aria-hidden="true" />
          <span>
            Preparing
            {typeof completedChecks === 'number' && typeof totalChecks === 'number'
              ? ` (${completedChecks}/${totalChecks})`
              : ''}
          </span>
        </span>
      );
    case 'planning':
    default:
      return (
        <span className="rr-badge rr-badge-planning" data-testid="status-badge-planning">
          <ClipboardList size={14} aria-hidden="true" />
          <span>
            Planning
            {typeof completedChecks === 'number' && typeof totalChecks === 'number'
              ? ` (${completedChecks}/${totalChecks})`
              : ''}
          </span>
        </span>
      );
  }
};

interface UrgencyBadgeProps {
  urgency: DeadlineUrgency;
}

export const UrgencyBadge: React.FC<UrgencyBadgeProps> = ({ urgency }) => {
  if (urgency.kind === 'dropped_off') {
    return (
      <span className="rr-urgency rr-urgency-dropped">
        <Archive size={13} aria-hidden="true" />
        <span>Handover recorded</span>
      </span>
    );
  }

  if (urgency.kind === 'overdue') {
    return (
      <span className="rr-urgency rr-urgency-overdue">
        <AlertTriangle size={13} aria-hidden="true" />
        <span>{urgency.badgeLabel}</span>
      </span>
    );
  }

  if (urgency.kind === 'due_today' || urgency.kind === 'due_soon') {
    return (
      <span className="rr-urgency rr-urgency-due-soon">
        <Clock size={13} aria-hidden="true" />
        <span>{urgency.badgeLabel}</span>
      </span>
    );
  }

  return (
    <span className="rr-urgency rr-urgency-scheduled">
      <Clock size={13} aria-hidden="true" />
      <span>{urgency.badgeLabel}</span>
    </span>
  );
};
