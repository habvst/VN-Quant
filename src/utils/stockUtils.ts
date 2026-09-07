/**
 * Utilities for Vietnamese Stock Market Price Action Formatting
 * Standards (HOSE / HNX / UPCoM):
 * - Ceiling (Trần): Purple (text-purple-400)
 * - Floor (Sàn): Cyan (text-cyan-400)
 * - Reference (Tham chiếu / Đứng giá): Yellow/Amber (text-amber-400)
 * - Gain (Tăng giá): Green (text-emerald-400)
 * - Loss (Giảm giá): Red (text-red-400)
 */

export function isPriceReference(
  changePercent: number,
  price?: number,
  referencePrice?: number
): boolean {
  if (price !== undefined && referencePrice !== undefined && referencePrice > 0) {
    if (Math.abs(price - referencePrice) < 0.001) return true;
  }
  return Math.abs(changePercent) < 0.001 || changePercent === 0;
}

export function getPriceChangeColor(
  changePercent: number,
  price?: number,
  referencePrice?: number
): string {
  if (isPriceReference(changePercent, price, referencePrice)) {
    return 'text-amber-400';
  }
  return changePercent > 0 ? 'text-emerald-400' : 'text-red-400';
}

export function formatChangePercent(
  changePercent: number,
  decimals?: number
): string {
  if (isPriceReference(changePercent)) {
    return decimals !== undefined ? `${(0).toFixed(decimals)}%` : '0%';
  }
  const prefix = changePercent > 0 ? '+' : '';
  const val = decimals !== undefined ? changePercent.toFixed(decimals) : String(changePercent);
  return `${prefix}${val}%`;
}
