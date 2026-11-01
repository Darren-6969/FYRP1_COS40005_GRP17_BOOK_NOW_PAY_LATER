import { apiRequest } from "./api";

export async function getPublicCars() {
  return apiRequest("/public/cars", {
    method: "GET",
  });
}

export async function getPublicCarById(
  id: number | string
) {
  return apiRequest(
    `/public/cars/${id}`,
    {
      method: "GET",
    }
  );
}

type CarQuoteInput = {
  from?: string;
  ft?: string;
  to?: string;
  tt?: string;

  pickupPointId?: string;
  dropoffPointId?: string;

  requestedLocation?: string;
  requestedDropoffLocation?: string;

  returnToRequested?: boolean;
  driverDateOfBirth?: string;

  cdw?: boolean;

  addOns?: Record<string, number>;
};

export async function quotePublicCar(
  id: number | string,
  input: CarQuoteInput
) {
  return apiRequest(
    `/public/cars/${id}/quote`,
    {
      method: "POST",
      body: JSON.stringify({
        ...input,
        addOns: input.addOns ?? {},
        cdw: Boolean(input.cdw),
      }),
    }
  );
}