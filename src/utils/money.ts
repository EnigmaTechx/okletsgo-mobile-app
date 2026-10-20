/** "CA$10.20" — the currency label the Ionic app shows riders. */
export const cad = (amount: number | null | undefined): string =>
  `CA$${(Number(amount) || 0).toFixed(2)}`;

/** Two-decimal rounding that survives float noise (10.199999 → 10.2). */
export const round2 = (n: number): number => parseFloat(n.toFixed(2));
