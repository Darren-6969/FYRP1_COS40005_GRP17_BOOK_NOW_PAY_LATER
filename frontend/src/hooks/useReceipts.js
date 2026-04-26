import { uploadCustomerReceipt } from "../services/customer_service";

export async function submitCustomerReceipt(bookingId, payload) {
  const res = await uploadCustomerReceipt(bookingId, payload);
  return res.data;
}
