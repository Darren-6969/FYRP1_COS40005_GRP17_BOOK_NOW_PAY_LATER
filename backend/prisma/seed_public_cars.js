// Demo car catalogue for the public platform: 5 operators, their branches,
// pick-up points, BNPL settings, 12 car listings and add-ons. Mirrors
// frontend/src/services/mock/listings.mock.js so the pages look the same on
// real data.
//
// ADDITIVE AND IDEMPOTENT. Unlike prisma/seed.js, this never deletes anything.
// Rows are matched on operatorCode / email / (operator, name) and updated in
// place, so running it twice changes nothing.
//
// Meant for a Neon development branch, not the shared database: the operators
// are fictional. It refuses to run without --confirm and prints the target.
//
//   node prisma/seed_public_cars.js --confirm

import bcrypt from "bcryptjs";
import prisma from "../src/config/db.js";
import { generateUserCode } from "../src/services/userCode.js";

const PASSWORD = process.env.SEED_PASSWORD || "Password123!";

const OPERATORS = [
  { code: "DEMO-BORNEO", name: "Borneo Wheels Sdn. Bhd.", email: "demo.borneo@example.com", down: 30, partial: null },
  { code: "DEMO-KENYALANG", name: "Kenyalang Car Rental", email: "demo.kenyalang@example.com", down: 25, partial: 50 },
  { code: "DEMO-MIRI", name: "Miri Coastline Auto", email: "demo.miri@example.com", down: 25, partial: 50 },
  { code: "DEMO-RAJANG", name: "Rajang Drive Sdn. Bhd.", email: "demo.rajang@example.com", down: 20, partial: null },
  { code: "DEMO-BINTULU", name: "Bintulu Motor Hire", email: "demo.bintulu@example.com", down: 30, partial: null },
];

const BRANCHES = {
  kchAirport: { op: "DEMO-BORNEO", name: "Kuching Intl Airport counter", address: "Arrival Hall, Kuching International Airport", city: "Kuching", open: "07:00", close: "22:00",
    points: [
      { label: "Kuching Intl Airport arrivals", note: "Meet at the arrivals hall", fee: "0.00" },
      { label: "Hotel or home within Kuching city centre", note: "Operator confirms the exact spot with you", fee: "40.00" },
    ] },
  kchCity: { op: "DEMO-KENYALANG", name: "Kuching Waterfront", address: "Jalan Tunku Abdul Rahman, 93100 Kuching", city: "Kuching", open: "08:00", close: "20:00",
    points: [
      { label: "Branch counter, Kuching Waterfront", note: "Open during operator hours", fee: "0.00" },
      { label: "Kuching Intl Airport arrivals", note: "Meet at the arrivals hall", fee: "25.00" },
    ] },
  miriAirport: { op: "DEMO-MIRI", name: "Miri Airport", address: "Miri Airport, Jalan Airport, 98000 Miri", city: "Miri", open: "07:00", close: "21:00",
    points: [
      { label: "Miri Airport arrivals", note: "Meet at the arrivals hall", fee: "0.00" },
      { label: "Hotel or home within Miri city", note: "Operator confirms the exact spot with you", fee: "30.00" },
    ] },
  sibu: { op: "DEMO-RAJANG", name: "Sibu Town", address: "Jalan Kampung Nyabor, 96000 Sibu", city: "Sibu", open: "08:00", close: "18:00", points: [] },
  bintulu: { op: "DEMO-BINTULU", name: "Bintulu Town", address: "Jalan Abang Galau, 97000 Bintulu", city: "Bintulu", open: "08:00", close: "18:00", points: [] },
};

const STANDARD_ADDONS = [
  { name: "Child seat", description: "For children 9 to 18 kg, fitted on pickup", price: "10.00", unit: "PER_DAY", maxQuantity: 3 },
  { name: "GPS navigation", description: "Preloaded Sarawak maps", price: "8.00", unit: "PER_DAY", maxQuantity: 1 },
  { name: "Additional driver", description: "Same age and licence rules as the main driver", price: "10.00", unit: "PER_DAY", maxQuantity: 2 },
];

const car = (o) => ({
  quantity: 3, powertrain: "PETROL", drivetrain: "TWO_WD", fuelPolicy: "FULL_TO_FULL", mileagePolicy: "UNLIMITED",
  minDriverAge: 21, youngDriverMaxAge: 24, youngDriverSurcharge: "20.00", ...o,
});

const CARS = [
  car({ branch: "kchAirport", name: "Perodua Bezza 1.3 AV", make: "Perodua", model: "Bezza", year: 2023, type: "SEDAN", seats: 5, transmission: "AUTOMATIC", luggage: 2, price: "120.00", weekend: "140.00", peak: "155.00", description: "Economical sedan for city runs and the coastal road to Santubong." }),
  car({ branch: "kchCity", name: "Perodua Axia 1.0 G", make: "Perodua", model: "Axia", year: 2022, type: "COMPACT", seats: 4, transmission: "AUTOMATIC", luggage: 1, price: "90.00", weekend: "105.00", peak: "115.00", description: "Small and easy to park around the Waterfront and Carpenter Street." }),
  car({ branch: "kchAirport", name: "Proton X70 1.5 TGDi", make: "Proton", model: "X70", year: 2024, type: "SUV", seats: 5, transmission: "AUTOMATIC", luggage: 3, price: "220.00", weekend: "255.00", peak: "285.00", quantity: 2, minDriverAge: 23, youngDriverMaxAge: 25, mileagePolicy: "LIMITED", mileageLimitKm: 250, mileageExcessRate: "0.50", description: "Comfortable SUV for the drive to Bako, Semenggoh or Annah Rais." }),
  car({ branch: "miriAirport", name: "Proton X90 1.5 TGDi 7-seater", make: "Proton", model: "X90", year: 2024, type: "SUV", seats: 7, transmission: "AUTOMATIC", luggage: 3, price: "260.00", weekend: "300.00", peak: "340.00", quantity: 1, description: "Seven seats for families heading to Niah or Lambir Hills." }),
  car({ branch: "miriAirport", name: "Perodua Alza 1.5 AV", make: "Perodua", model: "Alza", year: 2023, type: "MPV", seats: 7, transmission: "AUTOMATIC", luggage: 2, price: "160.00", weekend: "185.00", peak: "210.00", description: "Practical people carrier with flexible seating." }),
  car({ branch: "bintulu", name: "Toyota Hilux 2.4 4x4", make: "Toyota", model: "Hilux", year: 2022, type: "PICKUP", seats: 5, transmission: "MANUAL", luggage: 4, powertrain: "DIESEL", drivetrain: "FOUR_WD", price: "280.00", weekend: "320.00", peak: "365.00", minDriverAge: 25, youngDriverMaxAge: null, youngDriverSurcharge: null, description: "Four-wheel drive for logging roads and longhouse visits." }),
  car({ branch: "sibu", name: "Honda City 1.5 V", make: "Honda", model: "City", year: 2023, type: "SEDAN", seats: 5, transmission: "AUTOMATIC", luggage: 2, price: "150.00", weekend: "175.00", peak: "195.00", quantity: 2, mileagePolicy: "LIMITED", mileageLimitKm: 250, mileageExcessRate: "0.50", description: "Quiet, roomy sedan for business trips around Sibu." }),
  car({ branch: "sibu", name: "Perodua Myvi 1.5 AV", make: "Perodua", model: "Myvi", year: 2024, type: "COMPACT", seats: 5, transmission: "AUTOMATIC", luggage: 2, price: "100.00", weekend: "115.00", peak: "130.00", description: "Malaysia's favourite hatchback." }),
  car({ branch: "kchCity", name: "Toyota Innova 2.0 G", make: "Toyota", model: "Innova", year: 2022, type: "MPV", seats: 7, transmission: "AUTOMATIC", luggage: 3, price: "230.00", weekend: "265.00", peak: "300.00", description: "Spacious MPV for groups and airport runs." }),
  car({ branch: "bintulu", name: "Proton Saga 1.3 Standard", make: "Proton", model: "Saga", year: 2021, type: "SEDAN", seats: 5, transmission: "MANUAL", luggage: 2, price: "85.00", weekend: "100.00", peak: "110.00", description: "No-frills sedan at the lowest daily rate in Bintulu." }),
  car({ branch: "miriAirport", name: "Mitsubishi Triton 2.4 4x4", make: "Mitsubishi", model: "Triton", year: 2023, type: "PICKUP", seats: 5, transmission: "MANUAL", luggage: 4, powertrain: "DIESEL", drivetrain: "FOUR_WD", price: "270.00", weekend: "310.00", peak: "350.00", minDriverAge: 25, youngDriverMaxAge: null, youngDriverSurcharge: null, mileagePolicy: "LIMITED", mileageLimitKm: 300, mileageExcessRate: "0.60", description: "Rugged pickup for the road to Mulu's river jetties." }),
  car({ branch: "kchCity", name: "Proton X50 1.5T Premium", make: "Proton", model: "X50", year: 2024, type: "SUV", seats: 5, transmission: "AUTOMATIC", luggage: 2, price: "180.00", weekend: "205.00", peak: "235.00", quantity: 1, description: "Compact SUV with a strong turbo engine." }),
];

async function upsertOperator(o, passwordHash) {
  const operator = await prisma.operator.upsert({
    where: { operatorCode: o.code },
    update: { companyName: o.name, status: "ACTIVE" },
    create: { operatorCode: o.code, companyName: o.name, email: o.email, status: "ACTIVE" },
  });

  const config = await prisma.bNPLConfig.findFirst({ where: { operatorId: operator.id } });
  const settings = { downPaymentPercent: o.down, partialRefundElected: Boolean(o.partial), partialRefundPercent: o.partial };
  if (config) await prisma.bNPLConfig.update({ where: { id: config.id }, data: settings });
  else await prisma.bNPLConfig.create({ data: { operatorId: operator.id, ...settings } });

  const ownerEmail = o.email.replace("demo.", "owner.");
  const owner = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (!owner) {
    await prisma.user.create({
      data: {
        userCode: await generateUserCode("NORMAL_SELLER"),
        name: `${o.name} (owner)`,
        email: ownerEmail,
        password: passwordHash,
        role: "NORMAL_SELLER",
        operatorId: operator.id,
        operatorAccessLevel: "OWNER",
      },
    });
  }
  return operator;
}

async function upsertBranch(b, operatorId) {
  const data = { name: b.name, address: b.address, city: b.city, state: "Sarawak", openTime: b.open, closeTime: b.close, isActive: true };
  const existing = await prisma.branch.findFirst({ where: { operatorId, name: b.name } });
  const branch = existing
    ? await prisma.branch.update({ where: { id: existing.id }, data })
    : await prisma.branch.create({ data: { operatorId, ...data } });

  for (const [i, p] of b.points.entries()) {
    const point = await prisma.pickupPoint.findFirst({ where: { branchId: branch.id, label: p.label } });
    const pointData = { note: p.note, fee: p.fee, sortOrder: i, isActive: true };
    if (point) await prisma.pickupPoint.update({ where: { id: point.id }, data: pointData });
    else await prisma.pickupPoint.create({ data: { branchId: branch.id, label: p.label, ...pointData } });
  }
  return branch;
}

async function upsertListing(c, operatorId, branchId) {
  const data = {
    branchId,
    category: "CAR_RENTAL",
    status: "PUBLISHED",
    description: c.description,
    price: c.price,
    weekendPrice: c.weekend,
    peakPrice: c.peak,
    quantity: c.quantity,
    vehicleMake: c.make,
    vehicleModel: c.model,
    modelYear: c.year,
    seats: c.seats,
    transmission: c.transmission,
    luggageCapacity: c.luggage,
    vehicleType: c.type,
    powertrain: c.powertrain,
    drivetrain: c.drivetrain,
    fuelPolicy: c.fuelPolicy,
    mileagePolicy: c.mileagePolicy,
    mileageLimitKm: c.mileageLimitKm ?? null,
    mileageExcessRate: c.mileageExcessRate ?? null,
    minDriverAge: c.minDriverAge,
    youngDriverMaxAge: c.youngDriverMaxAge,
    youngDriverSurcharge: c.youngDriverSurcharge,
    travelArea: "Sarawak only. Cross-border travel to Brunei or Kalimantan voids the rental.",
    pickupRules: "Bring the booking reference and your original driving licence. Staff inspect the licence at handover.",
    returnRules: "Return to the same point by the agreed time. The vehicle stays held until the operator confirms it is back and ready.",
    insuranceInfo: "Third-party insurance included. Excess RM 2,000 if the car is damaged.",
    termsAndConditions: "Standard operator rental terms apply.",
  };
  const existing = await prisma.listing.findFirst({ where: { operatorId, name: c.name } });
  const listing = existing
    ? await prisma.listing.update({ where: { id: existing.id }, data })
    : await prisma.listing.create({ data: { operatorId, name: c.name, ...data } });

  for (const [i, a] of STANDARD_ADDONS.entries()) {
    const addon = await prisma.listingAddon.findFirst({ where: { listingId: listing.id, name: a.name } });
    const addonData = { description: a.description, price: a.price, unit: a.unit, maxQuantity: a.maxQuantity, sortOrder: i, isActive: true };
    if (addon) await prisma.listingAddon.update({ where: { id: addon.id }, data: addonData });
    else await prisma.listingAddon.create({ data: { listingId: listing.id, name: a.name, ...addonData } });
  }
  return listing;
}

async function main() {
  const host = (process.env.DATABASE_URL || "").match(/@([^/?]+)/)?.[1] || "(unknown host)";
  if (!process.argv.includes("--confirm")) {
    console.error(`Refusing to seed ${host} without --confirm. Use a development branch, not the shared database.`);
    process.exit(1);
  }
  console.log(`Seeding demo car catalogue into ${host}`);

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const operators = {};
  for (const o of OPERATORS) operators[o.code] = await upsertOperator(o, passwordHash);

  const branches = {};
  for (const [key, b] of Object.entries(BRANCHES)) branches[key] = await upsertBranch(b, operators[b.op].id);

  for (const c of CARS) {
    const branch = branches[c.branch];
    await upsertListing(c, branch.operatorId, branch.id);
  }

  const customerEmail = "demo.customer@example.com";
  if (!(await prisma.user.findUnique({ where: { email: customerEmail } }))) {
    await prisma.user.create({
      data: { userCode: await generateUserCode("CUSTOMER"), name: "Demo Customer", email: customerEmail, password: passwordHash, role: "CUSTOMER" },
    });
  }

  console.log(`Done: ${OPERATORS.length} operators, ${Object.keys(BRANCHES).length} branches, ${CARS.length} cars.`);
  console.log(`Logins use password "${PASSWORD}": owner.<name>@example.com for operators, ${customerEmail} for the customer.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
