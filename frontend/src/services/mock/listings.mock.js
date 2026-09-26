// Mock car listings for the public pages until a public listings endpoint exists.
//
// The first block of fields mirrors the Prisma `Listing` model and its
// `images`, `branch` and `operator` relations exactly, so swapping to the real
// API is a data-source change only.
//
// Everything under `booking`, `policy` and `operatorStats` is NOT in the
// backend yet. It is shaped as the future API would return it. All money is
// integer sen.

import { klToday } from "../../utils/formatPublic";

const operators = {
  borneo: { id: 101, companyName: "Borneo Wheels Sdn. Bhd.", logoUrl: null, verified: true, activeSince: "2021-03-01", branchCount: 2, completedBookings: 412 },
  kenyalang: { id: 102, companyName: "Kenyalang Car Rental", logoUrl: null, verified: true, activeSince: "2019-07-15", branchCount: 1, completedBookings: 688 },
  miri: { id: 103, companyName: "Miri Coastline Auto", logoUrl: null, verified: true, activeSince: "2022-01-10", branchCount: 2, completedBookings: 205 },
  rajang: { id: 104, companyName: "Rajang Drive Sdn. Bhd.", logoUrl: null, verified: true, activeSince: "2020-11-02", branchCount: 1, completedBookings: 297 },
  bintulu: { id: 105, companyName: "Bintulu Motor Hire", logoUrl: null, verified: true, activeSince: "2023-05-20", branchCount: 1, completedBookings: 96 },
};

const branches = {
  kchAirport: { id: 201, name: "Kuching Intl Airport counter", address: "Arrival Hall, Kuching International Airport", city: "Kuching", state: "Sarawak" },
  kchCity: { id: 202, name: "Kuching Waterfront", address: "Jalan Tunku Abdul Rahman, 93100 Kuching", city: "Kuching", state: "Sarawak" },
  miriAirport: { id: 203, name: "Miri Airport", address: "Miri Airport, Jalan Airport, 98000 Miri", city: "Miri", state: "Sarawak" },
  sibu: { id: 204, name: "Sibu Town", address: "Jalan Kampung Nyabor, 96000 Sibu", city: "Sibu", state: "Sarawak" },
  bintulu: { id: 205, name: "Bintulu Town", address: "Jalan Abang Galau, 97000 Bintulu", city: "Bintulu", state: "Sarawak" },
};

const pickupSets = {
  Kuching: [
    { id: "kch-airport", label: "Kuching Intl Airport arrivals", note: "Meet at the arrivals hall", feeSen: 0 },
    { id: "kch-waterfront", label: "Branch counter, Kuching Waterfront", note: "Open during operator hours", feeSen: 0 },
    { id: "kch-hotel", label: "Hotel or home within Kuching city centre", note: "Operator confirms the exact spot with you", feeSen: 4000 },
  ],
  Miri: [
    { id: "miri-airport", label: "Miri Airport arrivals", note: "Meet at the arrivals hall", feeSen: 0 },
    { id: "miri-city", label: "Hotel or home within Miri city", note: "Operator confirms the exact spot with you", feeSen: 3000 },
  ],
  Sibu: [
    { id: "sibu-town", label: "Branch counter, Sibu Town", note: "Open during operator hours", feeSen: 0 },
    { id: "sibu-airport", label: "Sibu Airport arrivals", note: "Meet at the arrivals hall", feeSen: 2500 },
  ],
  Bintulu: [
    { id: "btu-town", label: "Branch counter, Bintulu Town", note: "Open during operator hours", feeSen: 0 },
    { id: "btu-airport", label: "Bintulu Airport arrivals", note: "Meet at the arrivals hall", feeSen: 2500 },
  ],
};

// maxQty > 1 shows a quantity stepper; otherwise an Add toggle.
const standardAddOns = [
  { id: "child-seat", label: "Child seat", description: "For children 9 to 18 kg, fitted on pickup", priceSen: 1000, unit: "per_day", maxQty: 3 },
  { id: "gps", label: "GPS navigation", description: "Preloaded Sarawak maps", priceSen: 800, unit: "per_day", maxQty: 1 },
  { id: "insurance-plus", label: "Additional insurance", description: "Reduces excess from RM 2,000 to RM 300", priceSen: 2500, unit: "per_day", maxQty: 1 },
];

// Generic questions until operators can write their own.
const standardFaqs = [
  { q: "Do I need an international driving permit?", a: "Drivers with a licence in English or Malay do not. Other licences need an international driving permit alongside the original, uploaded by the licence deadline." },
  { q: "Can I take the car to Brunei?", a: "Not with this operator. Cross-border travel to Brunei or Kalimantan is not covered by the insurance and voids the rental." },
  { q: "What happens with fuel on return?", a: "The car leaves full and must come back full. If it does not, the operator charges the fuel needed plus a RM 30 refuelling fee." },
  { q: "Can someone else drive?", a: "Only you are authorised by default. Additional drivers cost RM 10 / day and must meet the same age and licence rules." },
  { q: "What if I pick up late?", a: "The operator holds the car for 2 hours past your pick-up time. After that, call the branch or the booking may be treated as a no-show." },
];

const forfeit = { type: "FORFEIT" };
const partial50 = { type: "PARTIAL", refundPct: 50 };

// Weekend and peak rates rounded to the nearest RM 5.
const roundRm5 = (sen) => Math.round(sen / 500) * 500;

function car(o) {
  const city = o.branch.city;
  return {
    // ── Mirrors Prisma Listing ──────────────────────────────────────
    id: o.id,
    category: "CAR_RENTAL",
    status: "PUBLISHED",
    name: o.name,
    description: o.description,
    quantity: o.quantity ?? 3,
    vehicleMake: o.make,
    vehicleModel: o.model,
    modelYear: o.year,
    seats: o.seats,
    transmission: o.transmission,
    luggageCapacity: o.luggage,
    pickupRules: "Bring the booking reference and your original driving licence. Staff inspect the licence at handover.",
    returnRules: "Return to the same point by the agreed time. The vehicle stays held until the operator confirms it is back and ready.",
    insuranceInfo: "Third-party insurance included. Excess RM 2,000 if the car is damaged.",
    refundPolicy:
      o.refund.type === "PARTIAL"
        ? `If the balance deadline is missed, ${o.refund.refundPct}% of the deposit is refunded.`
        : "If the balance deadline is missed, the deposit is forfeited in full.",
    termsAndConditions: "Standard operator rental terms apply.",
    images: [],
    createdAt: o.createdAt,
    operator: o.operator,
    branch: o.branch,

    // ── Not in the backend yet (future API shape) ───────────────────
    vehicleType: o.type,
    fuelType: o.fuel ?? "Petrol",
    driveType: o.drive ?? "2WD",
    booking: {
      dailyRateSen: o.rateSen,
      // TODO(api): rate_rules. Weekday / weekend / peak per day.
      rateRules: {
        weekdaySen: o.rateSen,
        weekendSen: roundRm5(o.rateSen * 1.15),
        peakSen: roundRm5(o.rateSen * 1.3),
      },
      downPaymentPct: o.downPct,
      refundRule: o.refund,
      pickupPoints: pickupSets[city],
      addOns: o.addOns ?? standardAddOns,
      minDriverAge: o.minAge ?? 21,
      youngDriver: { maxAge: 24, surchargeSen: o.youngSurchargeSen ?? 2000, unit: "per_day" },
      additionalDriverSen: 1000,
      // Rolling return hold: the vehicle is still out with a customer and is
      // not bookable before this plain date (operator local time).
      availableFrom: o.availableFromDays ? klToday(o.availableFromDays) : null,
      // Plain dates with no stock left (listing_availability.remaining = 0).
      bookedDates: (o.bookedDays ?? []).map((d) => klToday(d)),
      operatorHours: o.hours ?? { open: "07:00", close: "22:00" },
      responseWindowHours: 2,
    },
    policy: {
      fuel: { value: "Full to full", note: "Return with a full tank, or pay for the fuel needed plus RM 30." },
      unlimitedMileage: o.unlimited ?? true,
      mileage:
        o.unlimited === false
          ? { value: "250 km / day", note: "RM 0.50 per km above the daily allowance." }
          : { value: "Unlimited", note: "No per-kilometre charge." },
      insurance: { value: "Third-party", note: "Excess RM 2,000 if the car is damaged." },
      roadside: { value: "24-hour", note: "Breakdown and flat-tyre help across Sarawak." },
      travelArea: "Sarawak only. Cross-border travel to Brunei or Kalimantan voids the rental.",
      latePickup: "The car is held for 2 hours past the pick-up time. After that, call the branch.",
    },
    faqs: standardFaqs,
    operatorStats: {
      responseTimeMins: "responseMins" in o ? o.responseMins : 90,
      acceptanceRate: o.acceptance ?? 96,
    },
  };
}

export const MOCK_CARS = [
  car({ id: 1, name: "Perodua Bezza 1.3 AV", make: "Perodua", model: "Bezza", year: 2023, type: "Sedan", seats: 5, transmission: "AUTOMATIC", luggage: 2, rateSen: 12000, downPct: 30, refund: forfeit, operator: operators.borneo, branch: branches.kchAirport, createdAt: "2026-08-02T02:00:00Z", description: "Economical sedan for city runs and the coastal road to Santubong.", responseMins: 60, acceptance: 98, bookedDays: [12, 13] }),
  car({ id: 2, name: "Perodua Axia 1.0 G", make: "Perodua", model: "Axia", year: 2022, type: "Compact", seats: 4, transmission: "AUTOMATIC", luggage: 1, rateSen: 9000, downPct: 25, refund: partial50, operator: operators.kenyalang, branch: branches.kchCity, createdAt: "2026-07-18T02:00:00Z", description: "Small and easy to park around the Waterfront and Carpenter Street." }),
  car({ id: 3, name: "Proton X70 1.5 TGDi", make: "Proton", model: "X70", year: 2024, type: "SUV", seats: 5, transmission: "AUTOMATIC", luggage: 3, rateSen: 22000, downPct: 30, refund: forfeit, operator: operators.borneo, branch: branches.kchAirport, createdAt: "2026-09-10T02:00:00Z", description: "Comfortable SUV for the drive to Bako, Semenggoh or Annah Rais.", minAge: 23, quantity: 2, unlimited: false, availableFromDays: 9 }),
  car({ id: 4, name: "Proton X90 1.5 TGDi 7-seater", make: "Proton", model: "X90", year: 2024, type: "SUV", seats: 7, transmission: "AUTOMATIC", luggage: 3, rateSen: 26000, downPct: 25, refund: partial50, operator: operators.miri, branch: branches.miriAirport, createdAt: "2026-09-01T02:00:00Z", description: "Seven seats for families heading to Niah or Lambir Hills.", quantity: 1 }),
  car({ id: 5, name: "Perodua Alza 1.5 AV", make: "Perodua", model: "Alza", year: 2023, type: "MPV", seats: 7, transmission: "AUTOMATIC", luggage: 2, rateSen: 16000, downPct: 20, refund: forfeit, operator: operators.miri, branch: branches.miriAirport, createdAt: "2026-06-22T02:00:00Z", description: "Practical people carrier with flexible seating.", availableFromDays: 8 }),
  car({ id: 6, name: "Toyota Hilux 2.4 4x4", make: "Toyota", model: "Hilux", year: 2022, type: "Pickup", seats: 5, transmission: "MANUAL", luggage: 4, fuel: "Diesel", drive: "4WD", rateSen: 28000, downPct: 30, refund: forfeit, operator: operators.bintulu, branch: branches.bintulu, createdAt: "2026-05-30T02:00:00Z", description: "Four-wheel drive for logging roads and longhouse visits.", minAge: 25, hours: { open: "08:00", close: "18:00" }, responseMins: null }),
  car({ id: 7, name: "Honda City 1.5 V", make: "Honda", model: "City", year: 2023, type: "Sedan", seats: 5, transmission: "AUTOMATIC", luggage: 2, rateSen: 15000, downPct: 25, refund: partial50, operator: operators.rajang, branch: branches.sibu, createdAt: "2026-08-15T02:00:00Z", description: "Quiet, roomy sedan for business trips around Sibu.", quantity: 2, unlimited: false }),
  car({ id: 8, name: "Perodua Myvi 1.5 AV", make: "Perodua", model: "Myvi", year: 2024, type: "Compact", seats: 5, transmission: "AUTOMATIC", luggage: 2, rateSen: 10000, downPct: 20, refund: forfeit, operator: operators.rajang, branch: branches.sibu, createdAt: "2026-09-18T02:00:00Z", description: "Malaysia's favourite hatchback." }),
  car({ id: 9, name: "Toyota Innova 2.0 G", make: "Toyota", model: "Innova", year: 2022, type: "MPV", seats: 7, transmission: "AUTOMATIC", luggage: 3, rateSen: 23000, downPct: 30, refund: partial50, operator: operators.kenyalang, branch: branches.kchCity, createdAt: "2026-07-05T02:00:00Z", description: "Spacious MPV for groups and airport runs.", availableFromDays: 12 }),
  car({ id: 10, name: "Proton Saga 1.3 Standard", make: "Proton", model: "Saga", year: 2021, type: "Sedan", seats: 5, transmission: "MANUAL", luggage: 2, rateSen: 8500, downPct: 20, refund: forfeit, operator: operators.bintulu, branch: branches.bintulu, createdAt: "2026-04-11T02:00:00Z", description: "No-frills sedan at the lowest daily rate in Bintulu.", responseMins: null }),
  car({ id: 11, name: "Mitsubishi Triton 2.4 4x4", make: "Mitsubishi", model: "Triton", year: 2023, type: "Pickup", seats: 5, transmission: "MANUAL", luggage: 4, fuel: "Diesel", drive: "4WD", rateSen: 27000, downPct: 30, refund: forfeit, operator: operators.miri, branch: branches.miriAirport, createdAt: "2026-08-28T02:00:00Z", description: "Rugged pickup for the road to Mulu's river jetties.", minAge: 25, unlimited: false }),
  car({ id: 12, name: "Proton X50 1.5T Premium", make: "Proton", model: "X50", year: 2024, type: "SUV", seats: 5, transmission: "AUTOMATIC", luggage: 2, rateSen: 18000, downPct: 25, refund: partial50, operator: operators.kenyalang, branch: branches.kchCity, createdAt: "2026-09-20T02:00:00Z", description: "Compact SUV with a strong turbo engine.", quantity: 1 }),
];

// Cars on the landing page ("Picked for a small deposit").
export const FEATURED_CAR_IDS = [1, 3, 4];

// Tour packages are shown on the landing page only. Tour pages are not built yet.
export const MOCK_TOURS = [
  { id: "t1", title: "Bako National Park Day Trek", meta: "Proboscis monkeys and sea stacks, Kuching", duration: "1 day", operator: "Borneo Field Co.", depositSen: 8000, balanceSen: 24000 },
  { id: "t2", title: "Semenggoh and Annah Rais Longhouse", meta: "Orangutan feeding and a Bidayuh longhouse stay", duration: "2 days", operator: "Kenyalang Trails", depositSen: 16000, balanceSen: 48000 },
  { id: "t3", title: "Mulu Caves and Canopy Walk", meta: "Deer Cave, Clearwater Cave and the canopy skywalk, Miri", duration: "4 days", operator: "Mulu Explorer", depositSen: 30000, balanceSen: 118000 },
];

export const MOCK_NEWS = [
  { id: "n1", tag: "New", title: "Deposit filter now covers tour packages", body: "Search tours by deposit amount, recalculated for your dates." },
  { id: "n2", tag: "Coverage", title: "Sarawak operators live", body: "Five operators added across Kuching, Miri, Sibu and Bintulu." },
  { id: "n3", tag: "Policy", title: "Partial refund rule opens to more listings", body: "Standard car rentals outside the peak calendar can now elect it." },
];

export const PICKUP_CITIES = ["Kuching", "Miri", "Sibu", "Bintulu"];

export const PICKUP_SHORTCUTS = [
  { label: "Kuching Intl Airport", city: "Kuching" },
  { label: "Kuching Waterfront", city: "Kuching" },
  { label: "Miri Airport", city: "Miri" },
  { label: "Sibu", city: "Sibu" },
  { label: "Bintulu", city: "Bintulu" },
];
