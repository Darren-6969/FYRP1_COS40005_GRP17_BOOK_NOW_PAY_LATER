// TEST-ITEM-MISC: delete this file when testing is finished (see
// backend/TEST_ITEM_MISCELLANEOUS.md).
import api from "./api";

export const getTestItems = () => api.get("/test-items");
export const createTestItemBooking = (listingId) => api.post("/test-items/bookings", { listingId });
