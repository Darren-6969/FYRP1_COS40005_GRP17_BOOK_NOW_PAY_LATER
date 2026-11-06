// Dynamic DuitNow QR (SRS 4.2.5, optional scope).
//
// A DuitNow QR is an EMVCo merchant-presented payload that PayNet publishes
// (docs.developer.paynet.my, "QR Data Object"). The operator's account sits in
// tag 26. We keep it exactly as the operator's own bank app produced it, and
// build a new payload around it that is marked dynamic (tag 01 = 12) and
// carries the amount (tag 54) and the booking reference (tag 62), so the
// customer's banking app shows a fixed amount that cannot be edited.
//
// Nothing here talks to PayNet. The platform is told nothing when a payment is
// made, so the customer still uploads a receipt for the operator to verify.

const DUITNOW_AID = "A0000006150001";
const MALAYSIA_CURRENCY = "458";

function badQr(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

// ISO/IEC 13239 CRC-16: polynomial 0x1021, initial value 0xFFFF.
export function crc16(text) {
  let crc = 0xffff;
  for (const byte of Buffer.from(text, "utf8")) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

// Splits a payload (or a template inside one) into its tag/value pairs.
export function parseTlv(text) {
  const items = [];
  let position = 0;
  while (position < text.length) {
    const id = text.slice(position, position + 2);
    const lengthText = text.slice(position + 2, position + 4);
    if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(lengthText)) {
      throw badQr("This is not a DuitNow QR code. Its data is not in the expected format.");
    }
    const length = Number(lengthText);
    const value = text.slice(position + 4, position + 4 + length);
    if (value.length !== length) {
      throw badQr("This QR code is incomplete or damaged.");
    }
    items.push({ id, value });
    position += 4 + length;
  }
  return items;
}

function field(id, value) {
  const text = String(value);
  if (text.length > 99) throw badQr(`QR field ${id} is too long.`);
  return `${id}${String(text.length).padStart(2, "0")}${text}`;
}

// Printable ASCII only, as the QR text fields require, trimmed to a length.
function plain(value, max, fallback) {
  const cleaned = String(value || "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
  return cleaned || fallback;
}

/**
 * Reads the operator's own DuitNow QR text and returns the parts we keep.
 * Throws a 400 with a message the operator can act on.
 */
export function parseDuitNowQr(payload) {
  const text = String(payload || "").trim();
  if (!text) throw badQr("Paste the text of your DuitNow QR code, or upload the QR image.");
  if (text.length > 600) throw badQr("This does not look like a DuitNow QR code.");

  const crcAt = text.length - 8;
  if (crcAt < 0 || text.slice(crcAt, crcAt + 4) !== "6304") {
    throw badQr("This is not a DuitNow QR code. It does not end with the expected checksum.");
  }
  if (crc16(text.slice(0, crcAt + 4)) !== text.slice(-4).toUpperCase()) {
    throw badQr("This QR code's checksum does not match, so it was read wrongly or has been changed. Scan it again.");
  }

  const items = parseTlv(text);
  const find = (id) => items.find((item) => item.id === id)?.value;

  if (find("00") !== "02") throw badQr("This QR code is not a DuitNow QR code.");

  const account = find("26");
  if (!account) throw badQr("This QR code has no DuitNow account in it. Use the QR code from your DuitNow or banking app.");
  const accountParts = parseTlv(account);
  const part = (id) => accountParts.find((item) => item.id === id)?.value;
  if (part("00") !== DUITNOW_AID) throw badQr("This QR code is not a DuitNow QR code.");
  if (!part("01") || !part("02")) throw badQr("This DuitNow QR code is missing the account details.");

  const currency = find("53");
  if (currency && currency !== MALAYSIA_CURRENCY) throw badQr("This QR code is not in Malaysian ringgit.");
  const country = find("58");
  if (country && country !== "MY") throw badQr("This QR code is not a Malaysian DuitNow QR code.");

  return {
    account,
    acquirerId: part("01"),
    qrId: part("02"),
    merchantName: plain(find("59"), 25, null),
    merchantCity: plain(find("60"), 15, null),
    merchantCategory: /^\d{4}$/.test(find("52") || "") ? find("52") : "0000",
  };
}

// Amounts in the QR use a "." and no separators, e.g. 420.00.
export function formatQrAmount(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) throw badQr("The amount must be more than zero.");
  if (value > 99999999.99) throw badQr("The amount is too large for a QR code.");
  return value.toFixed(2);
}

/**
 * Builds the dynamic QR for one payment.
 * account: { account, merchantName, merchantCity, merchantCategory } as stored.
 */
export function buildDynamicQr({ account, amount, reference }) {
  if (!account?.account) throw badQr("The operator has not set up a DuitNow account.");
  const ref = plain(reference, 25, "").replace(/[^A-Za-z0-9 _.\-/]/g, "");

  let payload =
    field("00", "02") +
    field("01", "12") +
    field("26", account.account) +
    field("52", account.merchantCategory || "0000") +
    field("53", MALAYSIA_CURRENCY) +
    field("54", formatQrAmount(amount)) +
    field("58", "MY") +
    field("59", plain(account.merchantName, 25, "Merchant")) +
    field("60", plain(account.merchantCity, 15, "MY"));

  if (ref) {
    // 01 Bill Number and 05 Reference Label both carry the booking reference.
    payload += field("62", field("01", ref) + field("05", ref));
  }

  payload += "6304";
  return payload + crc16(payload);
}

// What the operator sees after saving: enough to recognise their account,
// without printing the whole identifier.
export function describeAccount(stored) {
  if (!stored?.account) return null;
  const accountParts = parseTlv(stored.account);
  const part = (id) => accountParts.find((item) => item.id === id)?.value || "";
  const qrId = part("02");
  return {
    acquirerId: part("01"),
    qrIdHint: qrId.length > 4 ? `${"*".repeat(Math.min(qrId.length - 4, 8))}${qrId.slice(-4)}` : qrId,
    merchantName: stored.merchantName || null,
    merchantCity: stored.merchantCity || null,
  };
}
