/**
 * Malaysian phone numbers in the form the server requires (+60 then 8 to
 * 11 digits; car_booking_validator.js). Accepts what people actually type:
 * "012-345 6789", "60123456789", "+60 12 345 6789".
 * Returns null when it can't be a Malaysian number.
 */
export function normaliseMalaysianPhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, '');
  if (/^\+60\d{8,11}$/.test(digits)) return digits;
  if (/^60\d{8,11}$/.test(digits)) return `+${digits}`;
  if (/^0\d{8,11}$/.test(digits)) return `+6${digits}`;
  return null;
}
