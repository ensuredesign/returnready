/**
 * Date and deadline utilities for ReturnReady.
 *
 * Per PRD Section 10:
 * - Store deadlines as PostgreSQL DATE (YYYY-MM-DD).
 * - Determine "today" using workspace timezone (fixed to Asia/Kolkata for MVP),
 *   never UTC midnight or developer machine locale.
 * - Compare calendar dates directly; never divide milliseconds by 24h to infer calendar boundaries.
 * - "Due soon" = deadline from today through today + 7 calendar days, inclusive (active items only).
 * - "Overdue" = deadline before today and not dropped off.
 */

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface CalendarParts {
  year: number;
  month: number;
  day: number;
}

export function parseCalendarDate(dateStr: string): CalendarParts {
  const match = ISO_DATE_RE.exec(dateStr.trim());
  if (!match) {
    throw new Error(`Invalid YYYY-MM-DD calendar date: "${dateStr}"`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() + 1 !== month ||
    probe.getUTCDate() !== day
  ) {
    throw new Error(`Out-of-range calendar date: "${dateStr}"`);
  }

  return { year, month, day };
}

export function formatCalendarParts({ year, month, day }: CalendarParts): string {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns today's YYYY-MM-DD calendar date in the given IANA timezone (defaults to Asia/Kolkata).
 */
export function getTodayInTimezone(
  timezone: string = DEFAULT_TIMEZONE,
  referenceNow: Date = new Date()
): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || DEFAULT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(referenceNow);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  return formatCalendarParts({ year, month, day });
}

/**
 * Adds a signed integer number of calendar days to a YYYY-MM-DD date string using UTC calendar arithmetic
 * (immune to local DST shifts).
 */
export function addCalendarDays(dateStr: string, deltaDays: number): string {
  const { year, month, day } = parseCalendarDate(dateStr);
  const d = new Date(Date.UTC(year, month - 1, day + Math.trunc(deltaDays)));
  return formatCalendarParts({
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  });
}

/**
 * Computes the exact integer calendar day difference (targetDate - baseDate)
 * using Julian day numbers / UTC calendar days.
 */
export function diffCalendarDays(targetDateStr: string, baseDateStr: string): number {
  const target = parseCalendarDate(targetDateStr);
  const base = parseCalendarDate(baseDateStr);
  const targetUtc = Date.UTC(target.year, target.month - 1, target.day);
  const baseUtc = Date.UTC(base.year, base.month - 1, base.day);
  return Math.round((targetUtc - baseUtc) / 86_400_000);
}

export type DeadlineUrgencyKind = 'dropped_off' | 'overdue' | 'due_today' | 'due_soon' | 'scheduled';

export interface DeadlineUrgency {
  kind: DeadlineUrgencyKind;
  daysFromToday: number;
  isOverdue: boolean;
  isDueSoon: boolean;
  badgeLabel: string;
  detailText: string;
}

/**
 * Evaluates deadline state against workspace "today" (YYYY-MM-DD).
 * - Due soon: today <= deadline <= today + 7 (and not dropped_off)
 * - Overdue: deadline < today (and not dropped_off)
 */
export function evaluateDeadline(
  deadlineDateStr: string,
  todayDateStr: string,
  isDroppedOff: boolean
): DeadlineUrgency {
  const daysFromToday = diffCalendarDays(deadlineDateStr, todayDateStr);

  if (isDroppedOff) {
    return {
      kind: 'dropped_off',
      daysFromToday,
      isOverdue: false,
      isDueSoon: false,
      badgeLabel: 'Dropped off',
      detailText: `Recorded deadline ${formatDisplayDate(deadlineDateStr)} · User-recorded handover`,
    };
  }

  if (daysFromToday < 0) {
    const overdueDays = Math.abs(daysFromToday);
    return {
      kind: 'overdue',
      daysFromToday,
      isOverdue: true,
      isDueSoon: false,
      badgeLabel:
        overdueDays === 1
          ? 'Past recorded deadline (1 day)'
          : `Past recorded deadline (${overdueDays} days)`,
      detailText: `Recorded deadline was ${formatDisplayDate(deadlineDateStr)} (eligibility not verified)`,
    };
  }

  if (daysFromToday === 0) {
    return {
      kind: 'due_today',
      daysFromToday: 0,
      isOverdue: false,
      isDueSoon: true,
      badgeLabel: 'Due today',
      detailText: `Recorded deadline is today (${formatDisplayDate(deadlineDateStr)})`,
    };
  }

  if (daysFromToday <= 7) {
    return {
      kind: 'due_soon',
      daysFromToday,
      isOverdue: false,
      isDueSoon: true,
      badgeLabel: daysFromToday === 1 ? 'Due tomorrow' : `Due in ${daysFromToday} days`,
      detailText: `Recorded deadline ${formatDisplayDate(deadlineDateStr)} (within 7-day window)`,
    };
  }

  return {
    kind: 'scheduled',
    daysFromToday,
    isOverdue: false,
    isDueSoon: false,
    badgeLabel: `Due in ${daysFromToday} days`,
    detailText: `Recorded deadline ${formatDisplayDate(deadlineDateStr)}`,
  };
}

export function formatDisplayDate(dateStr: string): string {
  try {
    const { year, month, day } = parseCalendarDate(dateStr);
    const utcDate = new Date(Date.UTC(year, month - 1, day));
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(utcDate);
  } catch {
    return dateStr;
  }
}

export function formatINRMinor(amountMinor: number): string {
  const rupees = amountMinor / 100;
  const hasPaise = amountMinor % 100 !== 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(rupees);
}

export function parseINRToMinor(rupeesInput: string): number {
  const cleaned = rupeesInput.trim().replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    throw new Error('Enter a valid non-negative INR amount with up to 2 decimal places.');
  }
  const [wholePart, fracPart = ''] = cleaned.split('.');
  const whole = Number(wholePart);
  const paise = Number(fracPart.padEnd(2, '0'));
  const totalMinor = whole * 100 + paise;
  if (!Number.isSafeInteger(totalMinor) || totalMinor < 0) {
    throw new Error('Amount is out of valid range.');
  }
  return totalMinor;
}
