import { apiRequest } from "./api";

export async function getCustomerBookings() {
  return apiRequest("/customer/bookings", {
    method: "GET",
  });
}

export async function getCustomerBookingById(
  id: number | string
) {
  return apiRequest(`/customer/bookings/${id}`, {
    method: "GET",
  });
}

export async function getCustomerNotifications() {
  return apiRequest("/customer/notifications", {
    method: "GET",
  });
}

export async function markCustomerNotificationRead(
  id: number | string
) {
  return apiRequest(
    `/customer/notifications/${id}/read`,
    {
      method: "PATCH",
    }
  );
}

export async function markAllCustomerNotificationsRead() {
  return apiRequest(
    "/customer/notifications/read-all",
    {
      method: "PATCH",
    }
  );
}