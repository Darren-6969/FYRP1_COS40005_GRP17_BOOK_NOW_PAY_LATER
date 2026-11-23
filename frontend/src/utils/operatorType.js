import { getUser } from "./session";

// The signed-in operator's type (CAR_RENTAL, TOUR_GUIDE or DRIVER). Older
// sessions saved before operator types existed have none: they are car
// rental operators.
export function getOperatorType(user = getUser()) {
  return user?.operator?.operatorType || "CAR_RENTAL";
}

// Words that change with the operator type, so the shared operator pages
// read right for guides and drivers.
const WORDING = {
  CAR_RENTAL: {
    bookingsGroup: "Rentals",
    listings: "Listings",
    branches: "Branches",
    pickupsToday: "Today's Pickups",
    pickupsTodayHint: "Number of bookings scheduled for vehicle pickup today.",
    pickupsTodaySub: "Vehicles scheduled for pickup",
    returnsToday: "Today's Returns",
    returnsTodayHint: "Number of vehicles scheduled to be returned today.",
    returnsTodaySub: "Vehicles due for return",
    awaitingReturn: "Vehicles awaiting return confirmation",
    awaitingReturnHint: "Return date has arrived but booking is not completed.",
  },
  TOUR_GUIDE: {
    bookingsGroup: "Tours",
    listings: "Tour packages",
    branches: "Base location",
    pickupsToday: "Today's Tours",
    pickupsTodayHint: "Number of tours starting today.",
    pickupsTodaySub: "Tours starting today",
    returnsToday: "Tours Ending Today",
    returnsTodayHint: "Number of tours that finish today.",
    returnsTodaySub: "Tours finishing today",
    awaitingReturn: "Tours awaiting completion",
    awaitingReturnHint: "The tour has ended but the booking is not completed.",
  },
  DRIVER: {
    bookingsGroup: "Jobs",
    listings: "Driver profile",
    branches: "Base location",
    pickupsToday: "Today's Jobs",
    pickupsTodayHint: "Number of driving jobs starting today.",
    pickupsTodaySub: "Jobs starting today",
    returnsToday: "Jobs Ending Today",
    returnsTodayHint: "Number of driving jobs that finish today.",
    returnsTodaySub: "Jobs finishing today",
    awaitingReturn: "Jobs awaiting completion",
    awaitingReturnHint: "The job has ended but the booking is not completed.",
  },
};

export function operatorWording(type = getOperatorType()) {
  return WORDING[type] || WORDING.CAR_RENTAL;
}
