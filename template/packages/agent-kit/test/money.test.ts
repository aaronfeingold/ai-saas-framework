import { describe, expect, it } from 'vitest';
import { microToUsd, pctOf, usdToMicro } from '../src/budget/money.js';

describe('money', () => {
  it('converts dollars to micro-dollars and back', () => {
    expect(usdToMicro(10)).toBe(10_000_000n);
    expect(usdToMicro(0.000001)).toBe(1n);
    expect(microToUsd(4_000_000n)).toBe(4);
  });

  it('takes a percentage of an amount', () => {
    expect(pctOf(usdToMicro(10), 40)).toBe(4_000_000n);
  });

  it('floors a fractional result', () => {
    expect(pctOf(10n, 35)).toBe(3n);
  });
});
