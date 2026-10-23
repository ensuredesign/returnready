import type {
  HouseholdMember,
  PendingAction,
  ReturnFilter,
  ReturnItem,
} from '../../types/domain';
import { evaluateDeadline, formatDisplayDate, formatINRMinor } from '../../lib/dates';

export const PENDING_CONFIRMATION_TTL_MS = 5 * 60 * 1000; // 5 minutes

export type ParsedIntentKind =
  | 'list_due'
  | 'list_overdue'
  | 'list_ready'
  | 'list_dropped_off'
  | 'list_all'
  | 'select_item'
  | 'missing_checks'
  | 'propose_assignment'
  | 'propose_dropoff'
  | 'propose_reopen'
  | 'confirm_pending'
  | 'cancel_pending'
  | 'ambiguous_mutation'
  | 'help'
  | 'unsupported_out_of_scope'
  | 'unknown';

export interface ConversationContext {
  items: ReturnItem[];
  members: HouseholdMember[];
  selectedItemId: string | null;
  pendingAction: PendingAction | null;
  currentFilter: ReturnFilter;
  todayDateStr: string;
  nowMs?: number;
}

export interface AssistantActionCard {
  type: 'items_summary' | 'checklist_preview' | 'confirmation' | 'disambiguation' | 'help_card';
  items?: ReturnItem[];
  targetItem?: ReturnItem;
  pendingAction?: PendingAction;
  candidateItems?: ReturnItem[];
  candidateMembers?: HouseholdMember[];
}

export interface IntentResolution {
  intent: ParsedIntentKind;
  replyText: string;
  cancelledPendingNotice: string | null;
  nextFilter?: ReturnFilter;
  nextSelectedItemId?: string | null;
  nextPendingAction: PendingAction | null;
  executeAction?: PendingAction;
  card?: AssistantActionCard;
  suggestedPrompts: string[];
}

const PRODUCT_SYNONYMS: Record<string, string[]> = {
  'wireless headphones': ['headphones', 'headphone', 'headset', 'earphones', 'earbuds', 'audio'],
  'running shoes': ['shoes', 'shoe', 'trainers', 'trainer', 'sneakers', 'sneaker', 'footwear'],
  'desk lamp': ['lamp', 'light', 'desk light', 'reading light', 'study lamp'],
  'travel backpack': ['backpack', 'rucksack', 'travel bag', 'daypack', 'knapsack', 'pack'],
  'coffee grinder': ['grinder', 'coffee', 'coffee mill', 'burr grinder', 'bean grinder'],
};

export function normalizeUtterance(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isPendingActionExpired(
  pending: PendingAction,
  nowMs: number = Date.now()
): boolean {
  return nowMs - pending.createdAtMs > PENDING_CONFIRMATION_TTL_MS;
}

/**
 * Finds matching ReturnItem records by name or known alias tokens.
 */
export function matchItemsInText(text: string, items: ReturnItem[]): ReturnItem[] {
  const norm = normalizeUtterance(text);
  if (!norm) {
    return [];
  }

  const words = new Set(norm.split(' '));
  const exactOrAliasMatches: ReturnItem[] = [];

  for (const item of items) {
    const itemNorm = normalizeUtterance(item.name);
    if (norm.includes(itemNorm)) {
      exactOrAliasMatches.push(item);
      continue;
    }

    // Check individual meaningful words of item name (length >= 4)
    const itemTokens = itemNorm.split(' ').filter((w) => w.length >= 4 && w !== 'demo');
    if (itemTokens.some((tok) => words.has(tok) || norm.includes(tok))) {
      exactOrAliasMatches.push(item);
      continue;
    }

    // Check product aliases
    const aliases = PRODUCT_SYNONYMS[itemNorm] ?? [];
    if (
      aliases.some((alias) => {
        const aliasNorm = normalizeUtterance(alias);
        return aliasNorm.includes(' ') ? norm.includes(aliasNorm) : words.has(aliasNorm);
      })
    ) {
      exactOrAliasMatches.push(item);
    }
  }

  return exactOrAliasMatches;
}

/**
 * Finds matching HouseholdMember records mentioned in normalized text.
 */
export function matchMembersInText(text: string, members: HouseholdMember[]): HouseholdMember[] {
  const norm = normalizeUtterance(text);
  if (!norm) {
    return [];
  }
  const words = new Set(norm.split(' '));

  return members.filter((member) => {
    const memberNorm = normalizeUtterance(member.name);
    if (!memberNorm) {
      return false;
    }
    if (memberNorm === 'me' && (words.has('me') || words.has('myself'))) {
      return true;
    }
    return memberNorm.includes(' ') ? norm.includes(memberNorm) : words.has(memberNorm);
  });
}

function getSelectedItem(ctx: ConversationContext): ReturnItem | undefined {
  if (!ctx.selectedItemId) {
    return undefined;
  }
  return ctx.items.find((i) => i.id === ctx.selectedItemId);
}

const DEFAULT_SUGGESTIONS = [
  'What needs returning this week?',
  'Prepare the headphones',
  'What is missing?',
  'Assign this to Priya',
  'Show overdue items',
];

/**
 * Deterministic rule-based intent router implementing PRD Section 6.
 */
export function resolveConversationTurn(
  rawInput: string,
  ctx: ConversationContext
): IntentResolution {
  const nowMs = ctx.nowMs ?? Date.now();
  const norm = normalizeUtterance(rawInput);

  // Check if existing pending action expired
  let activePending = ctx.pendingAction;
  let expiredNotice: string | null = null;
  if (activePending && isPendingActionExpired(activePending, nowMs)) {
    expiredNotice = `The previous pending confirmation for "${activePending.itemName}" expired after 5 minutes without changes.`;
    activePending = null;
  }

  // 1. Check for confirm_pending
  const isConfirmText =
    /^(yes|yep|yeah|confirm|confirmed|do it|proceed|go ahead|sure|ok|okay|approve)$/.test(norm) ||
    norm === 'yes confirm' ||
    norm === 'confirm action';

  if (isConfirmText) {
    if (!activePending) {
      return {
        intent: 'confirm_pending',
        replyText:
          expiredNotice ??
          'There is no pending action waiting for confirmation. You can ask to assign an item (for example, "Assign this to Priya") or record a drop-off ("Mark the headphones dropped off").',
        cancelledPendingNotice: null,
        nextPendingAction: null,
        suggestedPrompts: DEFAULT_SUGGESTIONS,
      };
    }

    return {
      intent: 'confirm_pending',
      replyText: `Confirming ${activePending.kind} for ${activePending.itemName}…`,
      cancelledPendingNotice: null,
      nextPendingAction: null,
      executeAction: activePending,
      suggestedPrompts: DEFAULT_SUGGESTIONS,
    };
  }

  // 2. Check for cancel_pending
  const isCancelText =
    /^(no|nope|cancel|stop|nevermind|never mind|abort|dismiss|dont|do not)$/.test(norm) ||
    norm === 'cancel action' ||
    norm === 'no cancel';

  if (isCancelText) {
    if (!activePending) {
      return {
        intent: 'cancel_pending',
        replyText:
          expiredNotice ??
          'There is no pending confirmation to cancel. No changes were made.',
        cancelledPendingNotice: null,
        nextPendingAction: null,
        suggestedPrompts: DEFAULT_SUGGESTIONS,
      };
    }

    return {
      intent: 'cancel_pending',
      replyText: `Cancelled the pending ${activePending.kind === 'assign' ? 'assignment' : activePending.kind === 'dropoff' ? 'drop-off' : 'reopen'} for ${activePending.itemName}. No changes were saved.`,
      cancelledPendingNotice: null,
      nextPendingAction: null,
      suggestedPrompts: DEFAULT_SUGGESTIONS,
    };
  }

  // Any other command cancels an active pending action with a brief notice per PRD Section 6
  const cancelledPendingNotice = activePending
    ? `Cancelled unconfirmed ${activePending.kind === 'assign' ? `assignment of ${activePending.itemName}` : `action on ${activePending.itemName}`} because a new request was started.`
    : expiredNotice;

  // 3. Help intent
  if (
    /^(help|commands|options|what can you do|what do you support|how does this work|menu)$/.test(
      norm
    ) ||
    norm.includes('what can i ask') ||
    norm.includes('supported requests')
  ) {
    return {
      intent: 'help',
      replyText:
        'I can help you review return deadlines, inspect preparation checklists, assign a return to a household member, or record a drop-off.',
      cancelledPendingNotice,
      nextPendingAction: null,
      card: { type: 'help_card' },
      suggestedPrompts: DEFAULT_SUGGESTIONS,
    };
  }

  // 4. Out-of-scope / retailer / refund / courier queries (honest guardrails per PRD)
  if (
    /\b(refund|money back|bank|credit card|amazon|courier|pickup|label|qr code|print label|sms|whatsapp|email|notify|notification|policy|eligible|eligibility)\b/.test(
      norm
    )
  ) {
    return {
      intent: 'unsupported_out_of_scope',
      replyText:
        'ReturnReady is a household preparation simulation and does not connect to retailers, verify return policy eligibility, book couriers, track refunds, or send external notifications. I can show your recorded deadlines, check off packing steps, or record who is handling a return.',
      cancelledPendingNotice,
      nextPendingAction: null,
      card: { type: 'help_card' },
      suggestedPrompts: DEFAULT_SUGGESTIONS,
    };
  }

  // 5. Ambiguous batch mutations ("Mark these as dropped off", "Drop off all", "Assign everything to Priya")
  if (
    /\b(these|them|all|everything|both|every item|all items|all returns)\b/.test(norm) &&
    /\b(drop off|dropped off|dropoff|assign|mark|complete|handover)\b/.test(norm)
  ) {
    const activeItems = ctx.items.filter((i) => i.status !== 'dropped_off');
    return {
      intent: 'ambiguous_mutation',
      replyText:
        'To avoid accidental changes, I can only update one return at a time. Which single item would you like to update?',
      cancelledPendingNotice,
      nextPendingAction: null,
      card: {
        type: 'disambiguation',
        candidateItems: activeItems,
      },
      suggestedPrompts: activeItems.slice(0, 3).map((i) => `Mark ${i.name} dropped off`),
    };
  }

  // 6. List overdue items
  if (
    /\b(overdue|past due|late|expired|missed deadline|past deadline)\b/.test(norm) &&
    !/\b(assign|drop off|dropped off|prepare)\b/.test(norm)
  ) {
    const overdueItems = ctx.items
      .filter((item) => {
        if (item.status === 'dropped_off') return false;
        return evaluateDeadline(item.return_deadline, ctx.todayDateStr, false).isOverdue;
      })
      .sort((a, b) => a.return_deadline.localeCompare(b.return_deadline));

    if (overdueItems.length === 0) {
      return {
        intent: 'list_overdue',
        replyText: 'You have 0 active returns past their user-recorded deadline.',
        cancelledPendingNotice,
        nextFilter: 'overdue',
        nextPendingAction: null,
        suggestedPrompts: ['What needs returning this week?', 'Show all returns'],
      };
    }

    const summaryLines = overdueItems
      .map(
        (i) =>
          `• ${i.name} (${i.merchant}, ${formatINRMinor(i.amount_minor)}) — recorded deadline ${formatDisplayDate(i.return_deadline)}`
      )
      .join('\n');

    return {
      intent: 'list_overdue',
      replyText: `You have ${overdueItems.length} item${overdueItems.length === 1 ? '' : 's'} past the user-recorded deadline (retailer eligibility is not verified):\n${summaryLines}`,
      cancelledPendingNotice,
      nextFilter: 'overdue',
      nextPendingAction: null,
      card: {
        type: 'items_summary',
        items: overdueItems,
      },
      suggestedPrompts: [
        `Prepare ${overdueItems[0].name}`,
        'What needs returning this week?',
        'Show all returns',
      ],
    };
  }

  // 7. List due this week / due soon
  if (
    /\b(due|returning this week|this week|due soon|next 7 days|seven days|upcoming|what needs returning|whats due)\b/.test(
      norm
    ) &&
    !/\b(assign|drop off|dropped off)\b/.test(norm)
  ) {
    const dueSoonItems = ctx.items
      .filter((item) => {
        if (item.status === 'dropped_off') return false;
        return evaluateDeadline(item.return_deadline, ctx.todayDateStr, false).isDueSoon;
      })
      .sort((a, b) => a.return_deadline.localeCompare(b.return_deadline));

    if (dueSoonItems.length === 0) {
      return {
        intent: 'list_due',
        replyText:
          'No active returns have a recorded deadline within the next 7 days (today through today + 7 days).',
        cancelledPendingNotice,
        nextFilter: 'due_soon',
        nextPendingAction: null,
        suggestedPrompts: ['Show all returns', 'Show overdue items'],
      };
    }

    const readyCount = dueSoonItems.filter((i) => i.is_ready).length;
    const summaryLines = dueSoonItems
      .map((i) => {
        const urg = evaluateDeadline(i.return_deadline, ctx.todayDateStr, false);
        const ownerLabel = i.assignee_name ? `Assigned to ${i.assignee_name}` : 'Unassigned';
        const stateLabel = i.is_ready
          ? 'Ready'
          : `${i.completed_checks}/${i.total_checks} packed`;
        return `• ${i.name} (${urg.badgeLabel}, ${formatDisplayDate(i.return_deadline)}) — ${stateLabel} · ${ownerLabel}`;
      })
      .join('\n');

    return {
      intent: 'list_due',
      replyText: `${dueSoonItems.length} return${dueSoonItems.length === 1 ? ' is' : 's are'} due within 7 days (${readyCount} ready to drop off):\n${summaryLines}`,
      cancelledPendingNotice,
      nextFilter: 'due_soon',
      nextPendingAction: null,
      card: {
        type: 'items_summary',
        items: dueSoonItems,
      },
      suggestedPrompts: [
        'Prepare the headphones',
        'What is missing?',
        'Assign this to Priya',
      ],
    };
  }

  // 8. List Ready items
  if (
    /\b(show ready|what is ready|whats ready|ready to drop off|ready items|ready returns)\b/.test(
      norm
    )
  ) {
    const readyItems = ctx.items
      .filter((i) => i.status !== 'dropped_off' && i.is_ready)
      .sort((a, b) => a.return_deadline.localeCompare(b.return_deadline));

    return {
      intent: 'list_ready',
      replyText:
        readyItems.length > 0
          ? `${readyItems.length} return${readyItems.length === 1 ? ' has' : 's have'} all checklist steps complete and ${readyItems.length === 1 ? 'is' : 'are'} Ready to drop off.`
          : 'No active returns have all checklist steps completed yet.',
      cancelledPendingNotice,
      nextFilter: 'ready',
      nextPendingAction: null,
      card: readyItems.length > 0 ? { type: 'items_summary', items: readyItems } : undefined,
      suggestedPrompts:
        readyItems.length > 0
          ? [`Mark ${readyItems[0].name} dropped off`, 'What needs returning this week?']
          : ['Prepare the headphones', 'What needs returning this week?'],
    };
  }

  // 9. List Dropped Off items
  if (/\b(show dropped off|dropped off items|completed returns|what was dropped off)\b/.test(norm)) {
    const droppedItems = ctx.items.filter((i) => i.status === 'dropped_off');
    return {
      intent: 'list_dropped_off',
      replyText:
        droppedItems.length > 0
          ? `Showing ${droppedItems.length} user-recorded dropped-off return${droppedItems.length === 1 ? '' : 's'}.`
          : 'No returns have been marked dropped off yet.',
      cancelledPendingNotice,
      nextFilter: 'dropped_off',
      nextPendingAction: null,
      card: droppedItems.length > 0 ? { type: 'items_summary', items: droppedItems } : undefined,
      suggestedPrompts: ['Show all returns', 'What needs returning this week?'],
    };
  }

  // 10. List all active returns
  if (
    /\b(show all|all returns|list all|list returns|show everything|active returns|show returns)\b/.test(
      norm
    )
  ) {
    const activeItems = ctx.items
      .filter((i) => i.status !== 'dropped_off')
      .sort((a, b) => a.return_deadline.localeCompare(b.return_deadline));

    return {
      intent: 'list_all',
      replyText: `Showing all ${activeItems.length} active return${activeItems.length === 1 ? '' : 's'} sorted by earliest recorded deadline.`,
      cancelledPendingNotice,
      nextFilter: 'all',
      nextPendingAction: null,
      card: {
        type: 'items_summary',
        items: activeItems,
      },
      suggestedPrompts: ['What needs returning this week?', 'Prepare the headphones'],
    };
  }

  // 11. Propose assignment ("Assign this to Priya", "Assign headphones to Alex")
  if (/\b(assign|give|hand over|delegate)\b/.test(norm)) {
    const matchedItems = matchItemsInText(norm, ctx.items);
    const matchedMembers = matchMembersInText(norm, ctx.members);
    const usesPronoun = /\b(this|it|that|selected|current)\b/.test(norm);

    let targetItem: ReturnItem | undefined;
    if (matchedItems.length > 1) {
      return {
        intent: 'propose_assignment',
        replyText: `Multiple returns matched your request (${matchedItems.map((i) => i.name).join(', ')}). Which item do you want to assign?`,
        cancelledPendingNotice,
        nextPendingAction: null,
        card: {
          type: 'disambiguation',
          candidateItems: matchedItems,
        },
        suggestedPrompts: matchedItems.map((i) => `Prepare ${i.name}`),
      };
    } else if (matchedItems.length === 1) {
      targetItem = matchedItems[0];
    } else if (usesPronoun || matchedItems.length === 0) {
      targetItem = getSelectedItem(ctx);
    }

    if (!targetItem) {
      const activeItems = ctx.items.filter((i) => i.status !== 'dropped_off');
      return {
        intent: 'propose_assignment',
        replyText:
          'No return is currently selected. Please select an item first or specify its name (for example, "Assign Wireless Headphones to Priya").',
        cancelledPendingNotice,
        nextPendingAction: null,
        card: {
          type: 'disambiguation',
          candidateItems: activeItems,
        },
        suggestedPrompts: [
          'Prepare the headphones',
          'Assign Wireless Headphones to Priya',
        ],
      };
    }

    if (matchedMembers.length === 0) {
      return {
        intent: 'propose_assignment',
        replyText: `Who in your household should handle ${targetItem.name}? Available members: ${ctx.members.map((m) => m.name).join(', ')}.`,
        cancelledPendingNotice,
        nextSelectedItemId: targetItem.id,
        nextPendingAction: null,
        card: {
          type: 'disambiguation',
          targetItem,
          candidateMembers: ctx.members,
        },
        suggestedPrompts: ctx.members.map((m) => `Assign ${targetItem.name} to ${m.name}`),
      };
    }

    if (matchedMembers.length > 1) {
      return {
        intent: 'propose_assignment',
        replyText: `More than one household member matched (${matchedMembers.map((m) => m.name).join(', ')}). Please choose one person to assign ${targetItem.name}.`,
        cancelledPendingNotice,
        nextSelectedItemId: targetItem.id,
        nextPendingAction: null,
        card: {
          type: 'disambiguation',
          targetItem,
          candidateMembers: matchedMembers,
        },
        suggestedPrompts: matchedMembers.map((m) => `Assign ${targetItem.name} to ${m.name}`),
      };
    }

    const member = matchedMembers[0];
    const pending: PendingAction = {
      kind: 'assign',
      itemId: targetItem.id,
      itemName: targetItem.name,
      memberId: member.id,
      memberName: member.name,
      expectedVersion: targetItem.version,
      createdAtMs: nowMs,
    };

    return {
      intent: 'propose_assignment',
      replyText: `Assign ${targetItem.name} to ${member.name}? Please confirm to save this assignment in ReturnReady (no external notification is sent).`,
      cancelledPendingNotice,
      nextSelectedItemId: targetItem.id,
      nextPendingAction: pending,
      card: {
        type: 'confirmation',
        targetItem,
        pendingAction: pending,
      },
      suggestedPrompts: ['Confirm', 'Cancel'],
    };
  }

  // 12. Propose reopen ("Reopen the headphones")
  if (/\b(reopen|undo drop off|undo dropoff|move back to preparing)\b/.test(norm)) {
    const matchedItems = matchItemsInText(norm, ctx.items);
    const targetItem =
      matchedItems.length === 1
        ? matchedItems[0]
        : matchedItems.length === 0
          ? getSelectedItem(ctx)
          : undefined;

    if (matchedItems.length > 1) {
      return {
        intent: 'propose_reopen',
        replyText: `Multiple items matched (${matchedItems.map((i) => i.name).join(', ')}). Which one would you like to reopen?`,
        cancelledPendingNotice,
        nextPendingAction: null,
        card: { type: 'disambiguation', candidateItems: matchedItems },
        suggestedPrompts: matchedItems.map((i) => `Reopen ${i.name}`),
      };
    }

    if (!targetItem) {
      return {
        intent: 'propose_reopen',
        replyText: 'Please select or name the dropped-off return you want to reopen.',
        cancelledPendingNotice,
        nextPendingAction: null,
        suggestedPrompts: ['Show dropped off items', 'Show all returns'],
      };
    }

    if (targetItem.status !== 'dropped_off') {
      return {
        intent: 'propose_reopen',
        replyText: `${targetItem.name} is currently active (${targetItem.is_ready ? 'Ready' : targetItem.status}), so it does not need to be reopened.`,
        cancelledPendingNotice,
        nextSelectedItemId: targetItem.id,
        nextPendingAction: null,
        suggestedPrompts: [`Prepare ${targetItem.name}`, 'What needs returning this week?'],
      };
    }

    const pending: PendingAction = {
      kind: 'reopen',
      itemId: targetItem.id,
      itemName: targetItem.name,
      expectedVersion: targetItem.version,
      createdAtMs: nowMs,
    };

    return {
      intent: 'propose_reopen',
      replyText: `Reopen ${targetItem.name} and return it to active preparation? Confirm to update its status.`,
      cancelledPendingNotice,
      nextSelectedItemId: targetItem.id,
      nextPendingAction: pending,
      card: {
        type: 'confirmation',
        targetItem,
        pendingAction: pending,
      },
      suggestedPrompts: ['Confirm', 'Cancel'],
    };
  }

  // 13. Propose drop-off ("Mark the headphones dropped off", "Drop off this item")
  if (/\b(drop off|dropped off|dropoff|handed over|mark dropped)\b/.test(norm)) {
    const matchedItems = matchItemsInText(norm, ctx.items);
    const usesPronoun = /\b(this|it|that|selected|current)\b/.test(norm);

    if (matchedItems.length > 1) {
      return {
        intent: 'propose_dropoff',
        replyText: `Multiple returns matched (${matchedItems.map((i) => i.name).join(', ')}). Which single item do you want to mark dropped off?`,
        cancelledPendingNotice,
        nextPendingAction: null,
        card: { type: 'disambiguation', candidateItems: matchedItems },
        suggestedPrompts: matchedItems.map((i) => `Mark ${i.name} dropped off`),
      };
    }

    const targetItem =
      matchedItems.length === 1
        ? matchedItems[0]
        : usesPronoun
          ? getSelectedItem(ctx)
          : undefined;

    if (!targetItem) {
      const activeItems = ctx.items.filter((i) => i.status !== 'dropped_off');
      return {
        intent: 'propose_dropoff',
        replyText:
          'Which return would you like to mark as dropped off? Select an item or mention it by name (for example, "Mark the headphones dropped off").',
        cancelledPendingNotice,
        nextPendingAction: null,
        card: { type: 'disambiguation', candidateItems: activeItems },
        suggestedPrompts: activeItems.slice(0, 3).map((i) => `Mark ${i.name} dropped off`),
      };
    }

    if (targetItem.status === 'dropped_off') {
      return {
        intent: 'propose_dropoff',
        replyText: `${targetItem.name} is already marked as dropped off.`,
        cancelledPendingNotice,
        nextSelectedItemId: targetItem.id,
        nextPendingAction: null,
        suggestedPrompts: [`Reopen ${targetItem.name}`, 'What needs returning this week?'],
      };
    }

    const incompleteCount = targetItem.total_checks - targetItem.completed_checks;
    const pending: PendingAction = {
      kind: 'dropoff',
      itemId: targetItem.id,
      itemName: targetItem.name,
      incompleteCount,
      totalCount: targetItem.total_checks,
      expectedVersion: targetItem.version,
      createdAtMs: nowMs,
    };

    const checklistWarning =
      incompleteCount > 0
        ? `Note: ${incompleteCount} of ${targetItem.total_checks} preparation step${incompleteCount === 1 ? ' is' : 's are'} still unchecked (${targetItem.checklist
            .filter((c) => !c.checked)
            .map((c) => c.label)
            .join(', ')}). `
        : `All ${targetItem.total_checks} preparation steps are checked. `;

    return {
      intent: 'propose_dropoff',
      replyText: `Mark ${targetItem.name} as dropped off? ${checklistWarning}This records your handover in ReturnReady and does not verify retailer acceptance or refund status.`,
      cancelledPendingNotice,
      nextSelectedItemId: targetItem.id,
      nextPendingAction: pending,
      card: {
        type: 'confirmation',
        targetItem,
        pendingAction: pending,
      },
      suggestedPrompts: ['Confirm', 'Cancel'],
    };
  }

  // 14. Missing checks ("What is missing?", "What's left to pack?", "Unchecked steps")
  if (
    /\b(missing|what is left|whats left|unchecked|incomplete|need to pack|remaining steps|what do i need)\b/.test(
      norm
    )
  ) {
    const matchedItems = matchItemsInText(norm, ctx.items);
    if (matchedItems.length > 1) {
      return {
        intent: 'missing_checks',
        replyText: `Which item would you like to check? Multiple items matched: ${matchedItems.map((i) => i.name).join(', ')}.`,
        cancelledPendingNotice,
        nextPendingAction: null,
        card: { type: 'disambiguation', candidateItems: matchedItems },
        suggestedPrompts: matchedItems.map((i) => `Prepare ${i.name}`),
      };
    }

    const targetItem = matchedItems.length === 1 ? matchedItems[0] : getSelectedItem(ctx);

    if (!targetItem) {
      const activeItems = ctx.items.filter((i) => i.status !== 'dropped_off');
      return {
        intent: 'missing_checks',
        replyText:
          'No return is currently selected. Select an item first (for example, "Prepare the headphones") to see which packing steps are still unchecked.',
        cancelledPendingNotice,
        nextPendingAction: null,
        card: { type: 'disambiguation', candidateItems: activeItems },
        suggestedPrompts: ['Prepare the headphones', 'Prepare the travel backpack'],
      };
    }

    const unchecked = targetItem.checklist.filter((c) => !c.checked);
    if (unchecked.length === 0) {
      return {
        intent: 'missing_checks',
        replyText: `Nothing is missing for ${targetItem.name} — all ${targetItem.total_checks} preparation steps are checked (${targetItem.status === 'dropped_off' ? 'Marked dropped off' : 'Ready to drop off'}).`,
        cancelledPendingNotice,
        nextSelectedItemId: targetItem.id,
        nextPendingAction: null,
        card: {
          type: 'checklist_preview',
          targetItem,
        },
        suggestedPrompts: [
          `Assign ${targetItem.name} to Priya`,
          `Mark ${targetItem.name} dropped off`,
        ],
      };
    }

    const missingLabels = unchecked.map((c) => c.label).join(', ');
    return {
      intent: 'missing_checks',
      replyText: `For ${targetItem.name}, ${unchecked.length} of ${targetItem.total_checks} suggested step${unchecked.length === 1 ? ' is' : 's are'} still unchecked: ${missingLabels}.`,
      cancelledPendingNotice,
      nextSelectedItemId: targetItem.id,
      nextPendingAction: null,
      card: {
        type: 'checklist_preview',
        targetItem,
      },
      suggestedPrompts: [
        `Assign ${targetItem.name} to Priya`,
        `Mark ${targetItem.name} dropped off`,
        'What needs returning this week?',
      ],
    };
  }

  // 15. Select / prepare item ("Prepare the headphones", "Open running shoes", "Check desk lamp")
  const matchedItemsForSelect = matchItemsInText(norm, ctx.items);
  if (
    /\b(prepare|select|open|inspect|view|check|pack|details|show)\b/.test(norm) ||
    matchedItemsForSelect.length > 0
  ) {
    if (matchedItemsForSelect.length > 1) {
      return {
        intent: 'select_item',
        replyText: `I found ${matchedItemsForSelect.length} matching items (${matchedItemsForSelect.map((i) => i.name).join(', ')}). Which one would you like to prepare?`,
        cancelledPendingNotice,
        nextPendingAction: null,
        card: {
          type: 'disambiguation',
          candidateItems: matchedItemsForSelect,
        },
        suggestedPrompts: matchedItemsForSelect.map((i) => `Prepare ${i.name}`),
      };
    }

    if (matchedItemsForSelect.length === 1) {
      const item = matchedItemsForSelect[0];
      const unchecked = item.checklist.filter((c) => !c.checked);
      const statusSummary =
        item.status === 'dropped_off'
          ? 'Marked dropped off'
          : item.is_ready
            ? `Ready to drop off (${item.total_checks}/${item.total_checks} steps checked)`
            : `${item.completed_checks} of ${item.total_checks} steps checked (${unchecked.length} remaining: ${unchecked.map((c) => c.label).join(', ')})`;

      return {
        intent: 'select_item',
        replyText: `Selected ${item.name} (${item.merchant}, ${formatINRMinor(item.amount_minor)}). Recorded deadline: ${formatDisplayDate(item.return_deadline)}. Status: ${statusSummary}.`,
        cancelledPendingNotice,
        nextSelectedItemId: item.id,
        nextPendingAction: null,
        card: {
          type: 'checklist_preview',
          targetItem: item,
        },
        suggestedPrompts: [
          'What is missing?',
          'Assign this to Priya',
          `Mark ${item.name} dropped off`,
        ],
      };
    }
  }

  // 16. Fallback unknown request -> helpful guidance, zero mutation
  return {
    intent: 'unknown',
    replyText:
      'I did not recognize that request. I can help you check upcoming return deadlines, prepare an item’s packing checklist, assign a household member, or record a drop-off.',
    cancelledPendingNotice,
    nextPendingAction: null,
    card: { type: 'help_card' },
    suggestedPrompts: DEFAULT_SUGGESTIONS,
  };
}
