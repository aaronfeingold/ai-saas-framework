import { describe, expect, it } from 'vitest';
import {
  nextUtcDayStart,
  nextUtcMonthStart,
  nextUtcWeekStart,
  utcDayStart,
  utcMonthStart,
  utcWeekStart,
} from '../src/budget/time.js';

// A Saturday, late in the UTC day.
const at = new Date('2026-10-03T23:30:00Z');
const iso = (d: Date) => d.toISOString();

describe('UTC period boundaries', () => {
  it('finds the start of the UTC day', () => {
    expect(iso(utcDayStart(at))).toBe('2026-10-03T00:00:00.000Z');
    expect(iso(nextUtcDayStart(at))).toBe('2026-10-04T00:00:00.000Z');
  });

  it('starts the week on Monday', () => {
    expect(iso(utcWeekStart(at))).toBe('2026-09-28T00:00:00.000Z');
    expect(iso(nextUtcWeekStart(at))).toBe('2026-10-05T00:00:00.000Z');
  });

  it('treats Sunday as the last day of the week and Monday as the first', () => {
    expect(iso(utcWeekStart(new Date('2026-10-04T12:00:00Z')))).toBe('2026-09-28T00:00:00.000Z');
    expect(iso(utcWeekStart(new Date('2026-10-05T00:00:00Z')))).toBe('2026-10-05T00:00:00.000Z');
  });

  it('finds the start of the UTC month, across a year end', () => {
    expect(iso(utcMonthStart(at))).toBe('2026-10-01T00:00:00.000Z');
    expect(iso(nextUtcMonthStart(new Date('2026-12-31T23:59:59Z')))).toBe(
      '2027-01-01T00:00:00.000Z',
    );
  });
});
