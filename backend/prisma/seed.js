import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function userCode(prefix, number) {
  return `${prefix}${String(number).padStart(4, "0")}`;
}

function bookingCode(number) {
  return `BNPL-${String(number).padStart(4, "0")}`;
}

function invoiceNo(number) {
  return `INV-${String(number).padStart(4, "0")}`;
}

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.receipt.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.bNPLConfig.deleteMany();
  await prisma.user.deleteMany();
  await prisma.operator.deleteMany();

  const password = await bcrypt.hash("password123", 10);

  const operator = await prisma.operator.create({
    data: {
      operatorCode: userCode("OPR", 1),
      companyName: "GoCar Scootbooking",
      email: "operator@gocar.test",
      phone: "0123456789",
      status: "ACTIVE",
    },
  });

  const master = await prisma.user.create({
    data: {
      userCode: userCode("ADN", 1),
      name: "Admin Super",
      email: "admin@bnpl.test",
      password,
      role: "MASTER_SELLER",
      operatorId: null,
      operatorAccessLevel: null,
    },
  });

  const seller = await prisma.user.create({
    data: {
      userCode: userCode("OPR", 1),
      name: "GoCar Owner",
      email: "seller@bnpl.test",
      password,
      role: "NORMAL_SELLER",
      operatorId: operator.id,
      operatorAccessLevel: "OWNER",
    },
  });

  const staff = await prisma.user.create({
  data: {
    userCode: userCode("OPR", 2),
    name: "GoCar Staff",
    email: "staff@bnpl.test",
    password,
    role: "NORMAL_SELLER",
    operatorId: operator.id,
    operatorAccessLevel: "STAFF",
    },
  });

  const customer1 = await prisma.user.create({
    data: {
      userCode: userCode("CUS", 1),
      name: "Ahmad Razif",
      email: "ahmad@test.com",
      password,
      role: "CUSTOMER",
    },
  });

  const customer2 = await prisma.user.create({
    data: {
      userCode: userCode("CUS", 2),
      name: "Siti Nurhaliza",
      email: "siti@test.com",
      password,
      role: "CUSTOMER",
    },
  });

  await prisma.bNPLConfig.create({
    data: {
      operatorId: operator.id,
      paymentDeadlineDays: 3,
      allowReceiptUpload: true,
      autoCancelOverdue: true,
      invoiceLogoUrl: "https://placehold.co/160x60?text=GoCar",
      invoiceFooterText: "Thank you for choosing GoCar Scootbooking.",
      manualPaymentNote:
        "Please upload your DuitNow/SPay receipt after completing payment.",
    },
  });

  const booking1 = await prisma.booking.create({
    data: {
      bookingCode: bookingCode(1),
      customerId: customer1.id,
      operatorId: operator.id,
      serviceName: "GoCar Perodua Myvi",
      serviceType: "Car Rental",
      bookingDate: new Date("2026-04-28T10:00:00"),
      pickupDate: new Date("2026-04-30T09:00:00"),
      returnDate: new Date("2026-05-02T09:00:00"),
      location: "Kuching",
      totalAmount: 420.0,
      status: "PENDING",
      paymentDeadline: new Date("2026-04-29T23:59:00"),
    },
  });

  const booking2 = await prisma.booking.create({
    data: {
      bookingCode: bookingCode(2),
      customerId: customer2.id,
      operatorId: operator.id,
      serviceName: "GoCar Honda City",
      serviceType: "Car Rental",
      bookingDate: new Date("2026-04-25T14:00:00"),
      pickupDate: new Date("2026-04-27T09:00:00"),
      returnDate: new Date("2026-04-29T09:00:00"),
      location: "Kuching",
      totalAmount: 680.0,
      status: "PAID",
      paymentDeadline: new Date("2026-04-26T23:59:00"),
    },
  });

  const booking3 = await prisma.booking.create({
    data: {
      bookingCode: bookingCode(3),
      customerId: customer1.id,
      operatorId: operator.id,
      serviceName: "GoCar Toyota Veloz",
      serviceType: "Car Rental",
      bookingDate: new Date("2026-05-02T11:30:00"),
      pickupDate: new Date("2026-05-24T10:00:00"),
      returnDate: new Date("2026-05-26T10:00:00"),
      location: "Kuching International Airport",
      totalAmount: 350.0,
      status: "PENDING_PAYMENT",
      paymentDeadline: new Date("2026-05-22T23:59:00"),
    },
  });

  const booking4 = await prisma.booking.create({
    data: {
      bookingCode: bookingCode(4),
      customerId: customer2.id,
      operatorId: operator.id,
      serviceName: "GoCar Perodua Ativa",
      serviceType: "Car Rental",
      bookingDate: new Date("2026-05-03T08:45:00"),
      pickupDate: new Date("2026-05-20T10:00:00"),
      returnDate: new Date("2026-05-21T10:00:00"),
      location: "Kuching Sentral",
      totalAmount: 280.0,
      status: "ALTERNATIVE_SUGGESTED",
      paymentDeadline: new Date("2026-05-18T23:59:00"),
      alternativeServiceName: "GoCar Honda City",
      alternativePrice: 300.0,
      alternativePickupDate: new Date("2026-05-20T12:00:00"),
      alternativeReturnDate: new Date("2026-05-21T12:00:00"),
      alternativeReason:
        "The selected vehicle is unavailable. Honda City is available for the same date.",
      alternativeSuggestedAt: new Date("2026-05-03T09:30:00"),
      alternativeUsed: true,
    },
  });

  await prisma.payment.create({
    data: {
      bookingId: booking2.id,
      amount: 680.0,
      method: "DUITNOW",
      status: "PAID",
      paidAt: new Date("2026-04-25T16:00:00"),
      transactionId: "TXN-DEMO-001",
    },
  });

  await prisma.payment.create({
    data: {
      bookingId: booking3.id,
      amount: 350.0,
      method: "PENDING",
      status: "UNPAID",
    },
  });

  await prisma.receipt.create({
    data: {
      bookingId: booking2.id,
      imageUrl: "https://placehold.co/600x800?text=DuitNow+Receipt",
      status: "APPROVED",
      verifiedAt: new Date("2026-04-25T16:10:00"),
    },
  });

  await prisma.invoice.create({
    data: {
      bookingId: booking2.id,
      invoiceNo: invoiceNo(1),
      amount: 680.0,
      status: "SENT",
      sentAt: new Date("2026-04-25T16:15:00"),
    },
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: customer1.id,
        title: "Booking request submitted",
        message: `Your booking ${booking1.bookingCode} has been submitted and is pending operator review.`,
        type: "BOOKING_CREATED",
      },
      {
        userId: customer2.id,
        title: "Payment confirmed",
        message: `Your payment for ${booking2.bookingCode} has been confirmed.`,
        type: "PAYMENT_CONFIRMED",
      },
      {
        userId: customer1.id,
        title: "Payment required",
        message: `Please complete payment for ${booking3.bookingCode} before the deadline.`,
        type: "PAYMENT_REQUIRED",
      },
      {
        userId: customer2.id,
        title: "Alternative booking suggested",
        message: `An alternative option has been suggested for ${booking4.bookingCode}.`,
        type: "ALTERNATIVE_SUGGESTED",
      },
      {
        userId: seller.id,
        title: "New booking request",
        message: `${booking1.bookingCode} requires operator review.`,
        type: "BOOKING_CREATED",
      },
      {
        userId: seller.id,
        title: "Payment pending",
        message: `${booking3.bookingCode} is waiting for customer payment.`,
        type: "PAYMENT_PENDING",
      },
    ],
  });

  await prisma.auditLog.createMany({
    data: [
      {
        userId: master.id,
        action: "SYSTEM_SEEDED",
        entityType: "System",
      },
      {
        userId: seller.id,
        action: "BOOKING_CREATED",
        entityType: "Booking",
        entityId: String(booking1.id),
      },
      {
        userId: seller.id,
        action: "PAYMENT_CONFIRMED",
        entityType: "Payment",
        entityId: String(booking2.id),
      },
      {
        userId: seller.id,
        action: "ALTERNATIVE_SUGGESTED",
        entityType: "Booking",
        entityId: String(booking4.id),
        details: {
          alternativeServiceName: "GoCar Honda City",
          alternativePrice: 300.0,
          reason:
            "The selected vehicle is unavailable. Honda City is available for the same date.",
        },
      },
    ],
  });

  console.log("Seed completed successfully.");
  console.log("");
  console.log("Login accounts:");
  console.log("Master Seller: admin@bnpl.test / password123");
  console.log("Normal Seller: seller@bnpl.test / password123");
  console.log("Customer 1: ahmad@test.com / password123");
  console.log("Customer 2: siti@test.com / password123");
}

main()
  .catch((e) => {
    console.error("Seed failed:");
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });