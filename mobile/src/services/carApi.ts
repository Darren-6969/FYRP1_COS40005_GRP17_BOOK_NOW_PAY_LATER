import { apiRequest } from "./api";

export async function getPublicCars() {
  return apiRequest("/public/cars", {
    method: "GET",
  });
}