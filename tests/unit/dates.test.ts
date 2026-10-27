import { describe, expect, it } from 'vitest';
import {
  addCalendarDays,
  diffCalendarDays,
  evaluateDeadline,
  formatINRMinor,
  getTodayInTimezone,
  parseCalendarDate,
  parseINRToMinor,
} from '../../src/lib/dates';

describe('Date and Asia/Kolkata deadline window utilities (A05, A06)', () => {
  it('computes today in Asia/Kolkata across UTC midnight rollover', () => {
    // 2026-10-23T20:00:00Z is 2026-10-24T01:30:00+05:30 in Asia/Kolkata
    const utcEvening = new Date('2026-10-23T20:00:00.000Z');
    expect(getTodayInTimezone('Asia/Kolkata', utcEvening)).toBe('2026-10-24');

    // 2026-10-23T18:29:59Z is 2026-10-23T23:59:59+05:30 in Asia/Kolkata
    const justBeforeIstMidnight = new Date('2026-10-23T18:29:59.000Z');
    expect(getTodayInTimezone('Asia/Kolkata', justBeforeIstMidnight)).toBe('2026-10-23');
  });

  it('adds and diffs calendar days accurately across month boundaries', () => {
    expect(addCalendarDays('2026-10-28', 7)).toBe('2026-11-04');
    expect(addCalendarDays('2026-10-23', -1)).toBe('2026-10-22');
    expect(diffCalendarDays('2026-10-30', '2026-10-23')).toBe(7);
    expect(diffCalendarDays('2026-10-22', '2026-10-23')).toBe(-1);
  });

  it('enforces exact overdue and due-soon boundaries (yesterday, today, today+7, today+8) (A06)', () => {
    const today = '2026-10-23';
    const yesterday = addCalendarDays(today, -1); // 2026-10-22
    const plusSeven = addCalendarDays(today, 7); // 2026-10-30
    const plusEight = addCalendarDays(today, 8); // 2026-10-31

    const evalYesterday = evaluateDeadline(yesterday, today, false);
    expect(evalYesterday.isOverdue).toBe(true);
    expect(evalYesterday.isDueSoon).toBe(false);
    expect(evalYesterday.kind).toBe('overdue');

    const evalToday = evaluateDeadline(today, today, false);
    expect(evalToday.isOverdue).toBe(false);
    expect(evalToday.isDueSoon).toBe(true);
    expect(evalToday.kind).toBe('due_today');

    const evalPlusSeven = evaluateDeadline(plusSeven, today, false);
    expect(evalPlusSeven.isOverdue).toBe(false);
    expect(evalPlusSeven.isDueSoon).toBe(true);
    expect(evalPlusSeven.kind).toBe('due_soon');

    const evalPlusEight = evaluateDeadline(plusEight, today, false);
    expect(evalPlusEight.isOverdue).toBe(false);
    expect(evalPlusEight.isDueSoon).toBe(false);
    expect(evalPlusEight.kind).toBe('scheduled');
  });

  it('never marks a dropped-off item as overdue or due soon', () => {
    const today = '2026-10-23';
    const yesterday = '2026-10-22';
    const evalDropped = evaluateDeadline(yesterday, today, true);
    expect(evalDropped.isOverdue).toBe(false);
    expect(evalDropped.isDueSoon).toBe(false);
    expect(evalDropped.kind).toBe('dropped_off');
  });

  it('rejects invalid calendar dates', () => {
    expect(() => parseCalendarDate('2026-02-30')).toThrow();
    expect(() => parseCalendarDate('23-10-2026')).toThrow();
  });

  it('parses and formats INR currency in integer paise without floating point drift', () => {
    expect(parseINRToMinor('4999')).toBe(499900);
    expect(parseINRToMinor('4,999.50')).toBe(499950);
    expect(parseINRToMinor('0.05')).toBe(5);
    expect(() => parseINRToMinor('-10')).toThrow();
    expect(() => parseINRToMinor('19.999')).toThrow();
    expect(formatINRMinor(499900)).toContain('4,999');
  });
});
