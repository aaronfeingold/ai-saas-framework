/** Money is held as integer micro-USD so spend arithmetic never touches floats. */
export const MICRO_PER_USD = 1_000_000n;

export function usdToMicro(usd: number): bigint {
  return BigInt(Math.round(usd * Number(MICRO_PER_USD)));
}

export function microToUsd(micro: bigint): number {
  return Number(micro) / Number(MICRO_PER_USD);
}

/** `pct` percent of `micro`, rounded down. */
export function pctOf(micro: bigint, pct: number): bigint {
  return (micro * BigInt(pct)) / 100n;
}
