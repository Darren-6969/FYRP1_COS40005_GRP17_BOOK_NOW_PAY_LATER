/**
 * F16: money is formatted here and never calculated in the app.
 * The server computes every amount; the app only displays what it sent.
 *
 * Booking and Payment amounts arrive as Decimal(10,2) values, usually JSON
 * strings like "340.00". Strings are formatted as text, so they never pass
 * through floating-point arithmetic. Integer sen amounts (ledger, fees) go
 * through `formatSen`.
 */

const GROUP = /\B(?=(\d{3})+(?!\d))/g;

function group(intPart: string) {
  return intPart.replace(GROUP, ',');
}

/** "340.5" -> { sign: "", int: "340", frac: "50" }; null if not a plain decimal. */
function splitDecimal(raw: string) {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(raw.trim());
  if (!match) return null;
  const [, sign, int, frac = ''] = match;
  // Display rounding to 2 places, done on digits.
  if (frac.length <= 2) {
    return { sign, int, frac: frac.padEnd(2, '0') };
  }
  const cents = BigInt(int + frac.slice(0, 2)) + (Number(frac[2]) >= 5 ? 1n : 0n);
  const digits = cents.toString().padStart(3, '0');
  return { sign, int: digits.slice(0, -2), frac: digits.slice(-2) };
}

export type MoneyInput = string | number | null | undefined;

/**
 * "RM 1,234.50". Returns `fallback` (default "—") for missing or
 * unparseable values instead of showing "RM NaN".
 */
export function formatRM(value: MoneyInput, fallback = '—'): string {
  if (value === null || value === undefined || value === '') return fallback;

  const raw =
    typeof value === 'number'
      ? Number.isFinite(value)
        ? value.toFixed(2)
        : null
      : String(value);
  if (raw === null) return fallback;

  const parts = splitDecimal(raw);
  if (!parts) return fallback;

  const isZero = /^0+$/.test(parts.int) && parts.frac === '00';
  const sign = parts.sign && !isZero ? '-' : '';
  return `${sign}RM ${group(String(BigInt(parts.int)))}.${parts.frac}`;
}

/** Integer sen -> "RM 12.30". */
export function formatSen(sen: number | null | undefined, fallback = '—'): string {
  if (sen === null || sen === undefined || !Number.isInteger(sen)) return fallback;
  const negative = sen < 0;
  const abs = String(Math.abs(sen)).padStart(3, '0');
  return `${negative ? '-' : ''}RM ${group(abs.slice(0, -2))}.${abs.slice(-2)}`;
}
