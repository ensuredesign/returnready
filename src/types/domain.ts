export type StoredReturnStatus = 'planning' | 'preparing' | 'dropped_off';

export type VisibleReturnStatus = 'planning' | 'preparing' | 'ready' | 'dropped_off';

export type ReturnFilter = 'all' | 'due_soon' | 'overdue' | 'ready' | 'dropped_off';

export interface Workspace {
  id: string;
  owner_user_id: string;
  name: string;
  timezone: string;
  seed_version: number;
  created_at: string;
}

export interface HouseholdMember {
  id: string;
  workspace_id: string;
  name: string;
  created_at: string;
}

export interface ChecklistItem {
  id: string;
  workspace_id: string;
  return_id: string;
  label: string;
  checked: boolean;
  sort_order: number;
  updated_at: string;
}

export interface ReturnItem {
  id: string;
  workspace_id: string;
  name: string;
  merchant: string;
  amount_minor: number;
  currency: 'INR';
  purchase_date: string; // YYYY-MM-DD
  return_deadline: string; // YYYY-MM-DD
  deadline_note: string;
  status: StoredReturnStatus;
  assignee_id: string | null;
  assignee_name: string | null;
  is_sample: boolean;
  version: number;
  dropped_off_at: string | null;
  created_at: string;
  updated_at: string;
  checklist: ChecklistItem[];
  derived_status: VisibleReturnStatus;
  is_ready: boolean;
  completed_checks: number;
  total_checks: number;
}

export type ReturnDetail = ReturnItem;

export type PendingAction =
  | {
      kind: 'assign';
      itemId: string;
      itemName: string;
      memberId: string;
      memberName: string;
      expectedVersion: number;
      createdAtMs: number;
    }
  | {
      kind: 'dropoff';
      itemId: string;
      itemName: string;
      incompleteCount: number;
      totalCount: number;
      expectedVersion: number;
      createdAtMs: number;
    }
  | {
      kind: 'reopen';
      itemId: string;
      itemName: string;
      expectedVersion: number;
      createdAtMs: number;
    };

export type AppErrorCategory =
  | 'unauthenticated'
  | 'validation'
  | 'conflict'
  | 'network'
  | 'forbidden'
  | 'configuration';

export class AppServiceError extends Error {
  public readonly category: AppErrorCategory;
  public readonly code?: string;

  constructor(category: AppErrorCategory, message: string, code?: string) {
    super(message);
    this.name = 'AppServiceError';
    this.category = category;
    this.code = code;
  }
}

export interface NewPurchaseInput {
  name: string;
  merchant: string;
  amountRupees: string;
  purchaseDate: string;
  returnDeadline: string;
  deadlineNote?: string;
}

export interface UpdatePurchaseInput extends NewPurchaseInput {
  id: string;
}
