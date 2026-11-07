import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDynamicQr,
  buildStaticQr,
  staticQrFrom,
  crc16,
  describeAccount,
  formatQrAmount,
  parseDuitNowQr,
  parseTlv,
} from "../../src/services/duitnow_qr.js";

// Examples published by PayNet (docs.developer.paynet.my, merchant-presented mode).
const PAYNET_RETAIL =
  "00020201021126410014A000000615000101065016640209123456789520499995303458540510.005802MY5909QRCSDNBHD6005BANGI6304343F";
const PAYNET_P2P =
  "00020201021126410014A000000615000101065016640209123456789520400005303458540510.005802MY5909AUSERNAME6005BANGI63043A23";
// A static merchant QR with no amount, as a bank app shows it.
const STATIC_NO_AMOUNT = (() => {
  const body =
    "00020201021126410014A000000615000101065016640209123456789520400005303458" +
    "5802MY5909AUSERNAME6005BANGI6304";
  return body + crc16(body);
})();

test("the checksum matches PayNet's published examples", () => {
  assert.equal(crc16(PAYNET_RETAIL.slice(0, -4)), "343F");
  assert.equal(crc16(PAYNET_P2P.slice(0, -4)), "3A23");
});

test("reads the account, name and city out of a DuitNow QR", () => {
  const parsed = parseDuitNowQr(PAYNET_RETAIL);
  assert.equal(parsed.acquirerId, "501664");
  assert.equal(parsed.qrId, "123456789");
  assert.equal(parsed.merchantName, "QRCSDNBHD");
  assert.equal(parsed.merchantCity, "BANGI");
  assert.equal(parsed.merchantCategory, "9999");
  assert.equal(parsed.account, "0014A000000615000101065016640209123456789");
});

test("refuses text that is not a DuitNow QR", () => {
  assert.throws(() => parseDuitNowQr(""), /Paste the text/);
  assert.throws(() => parseDuitNowQr("https://example.com/pay"), /not a DuitNow QR/);
});

test("refuses a QR whose checksum is wrong", () => {
  const damaged = PAYNET_RETAIL.replace("QRCSDNBHD", "QRCSDNBHE");
  assert.throws(() => parseDuitNowQr(damaged), /checksum does not match/);
});

test("refuses a QR from another payment scheme", () => {
  const body = "000201010211261800 0AA0000000041010 02051234".replace(/ /g, "");
  const other = body + "6304";
  assert.throws(() => parseDuitNowQr(other + crc16(other)), /not a DuitNow QR|incomplete|expected format/);
});

test("the dynamic QR is marked dynamic and carries the amount and reference", () => {
  const stored = parseDuitNowQr(STATIC_NO_AMOUNT);
  const payload = buildDynamicQr({ account: stored, amount: 180, reference: "BK0001" });
  const fields = parseTlv(payload);
  const get = (id) => fields.find((item) => item.id === id)?.value;

  assert.equal(get("00"), "02");
  assert.equal(get("01"), "12");
  assert.equal(get("26"), stored.account);
  assert.equal(get("53"), "458");
  assert.equal(get("54"), "180.00");
  assert.equal(get("58"), "MY");
  assert.equal(get("59"), "AUSERNAME");

  const reference = parseTlv(get("62"));
  assert.deepEqual(reference, [
    { id: "01", value: "BK0001" },
    { id: "05", value: "BK0001" },
  ]);
});

test("the dynamic QR has a valid checksum and reads back as a DuitNow QR", () => {
  const stored = parseDuitNowQr(PAYNET_RETAIL);
  const payload = buildDynamicQr({ account: stored, amount: 420.5, reference: "BK0002" });
  assert.equal(payload.slice(-8, -4), "6304");
  assert.equal(crc16(payload.slice(0, -4)), payload.slice(-4));
  assert.equal(parseDuitNowQr(payload).qrId, "123456789");
});

test("the amount is always two decimals and never zero or negative", () => {
  assert.equal(formatQrAmount(10), "10.00");
  assert.equal(formatQrAmount("0.1"), "0.10");
  assert.equal(formatQrAmount(1234.5), "1234.50");
  assert.throws(() => formatQrAmount(0), /more than zero/);
  assert.throws(() => formatQrAmount(-5), /more than zero/);
  assert.throws(() => formatQrAmount("abc"), /more than zero/);
});

test("odd characters in the reference and name are cleaned out", () => {
  const stored = { account: parseDuitNowQr(PAYNET_RETAIL).account, merchantName: "Café ☕ Rentals", merchantCity: "KL" };
  const payload = buildDynamicQr({ account: stored, amount: 10, reference: "BK-9 <script>" });
  const fields = parseTlv(payload);
  assert.equal(fields.find((item) => item.id === "59").value, "Caf Rentals");
  const reference = parseTlv(fields.find((item) => item.id === "62").value);
  assert.equal(reference[0].value, "BK-9 script");
});

test("a static QR with no amount is kept exactly as the bank app produced it", () => {
  assert.equal(staticQrFrom(STATIC_NO_AMOUNT), STATIC_NO_AMOUNT);
});

test("a QR pasted with an amount in it is made static with the amount removed", () => {
  const result = staticQrFrom(PAYNET_RETAIL);
  const fields = parseTlv(result);
  assert.equal(fields.find((item) => item.id === "01").value, "11");
  assert.equal(fields.some((item) => item.id === "54"), false);
  assert.equal(crc16(result.slice(0, -4)), result.slice(-4));
  assert.equal(parseDuitNowQr(result).qrId, "123456789");
});

test("a dynamic QR pasted as the account is turned back into a static one", () => {
  const dynamic = buildDynamicQr({ account: parseDuitNowQr(STATIC_NO_AMOUNT), amount: 50, reference: "BK1" });
  const fields = parseTlv(staticQrFrom(dynamic));
  assert.equal(fields.find((item) => item.id === "01").value, "11");
  assert.equal(fields.some((item) => item.id === "54"), false);
});

test("a static QR rebuilt from the saved account is static, has no amount or reference and a valid checksum", () => {
  const payload = buildStaticQr({ account: parseDuitNowQr(PAYNET_RETAIL) });
  const fields = parseTlv(payload);
  assert.equal(fields.find((item) => item.id === "01").value, "11");
  assert.equal(fields.some((item) => item.id === "54" || item.id === "62"), false);
  assert.equal(fields.find((item) => item.id === "26").value, parseDuitNowQr(PAYNET_RETAIL).account);
  assert.equal(crc16(payload.slice(0, -4)), payload.slice(-4));
  assert.throws(() => buildStaticQr({ account: null }), /not set up/);
});

test("no account means no QR", () => {
  assert.throws(() => buildDynamicQr({ account: null, amount: 10, reference: "BK1" }), /not set up/);
});

test("the saved account is described without printing the whole identifier", () => {
  const stored = parseDuitNowQr(PAYNET_RETAIL);
  const summary = describeAccount(stored);
  assert.equal(summary.acquirerId, "501664");
  assert.equal(summary.qrIdHint, "*****6789");
  assert.equal(summary.merchantName, "QRCSDNBHD");
  assert.equal(describeAccount(null), null);
});
