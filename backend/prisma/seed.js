import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

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
      companyName: "GoCar Scootbooking",
      email: "admin@gocar.test",
      phone: "0123456789",
      status: "ACTIVE",
    },
  });

  const master = await prisma.user.create({
    data: {
      name: "Admin Super",
      email: "admin@bnpl.test",
      password,
      role: "MASTER_SELLER",
      operatorId: operator.id,
    },
  });

  const seller = await prisma.user.create({
    data: {
      name: "GoCar Operator",
      email: "seller@bnpl.test",
      password,
      role: "NORMAL_SELLER",
      operatorId: operator.id,
    },
  });

  const customer1 = await prisma.user.create({
    data: {
      name: "Ahmad Razif",
      email: "ahmad@test.com",
      password,
      role: "CUSTOMER",
    },
  });

  const customer2 = await prisma.user.create({
    data: {
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
    },
  });

  const booking1 = await prisma.booking.create({
    data: {
      customerId: customer1.id,
      operatorId: operator.id,
      serviceName: "GoCar Perodua Myvi",
      serviceType: "Car Rental",
      bookingDate: new Date("2026-04-28"),
      pickupDate: new Date("2026-04-30"),
      returnDate: new Date("2026-05-02"),
      location: "Kuching",
      totalAmount: 420.0,
      status: "PENDING",
    },
  });

  const booking2 = await prisma.booking.create({
    data: {
      customerId: customer2.id,
      operatorId: operator.id,
      serviceName: "GoCar Honda City",
      serviceType: "Car Rental",
      bookingDate: new Date("2026-04-25"),
      pickupDate: new Date("2026-04-27"),
      returnDate: new Date("2026-04-29"),
      location: "Kuching",
      totalAmount: 680.0,
      status: "PAID",
      paymentDeadline: new Date("2026-04-27"),
    },
  });

  await prisma.payment.create({
    data: {
      bookingId: booking2.id,
      amount: 680.0,
      method: "DUITNOW",
      status: "PAID",
      paidAt: new Date(),
      transactionId: "TXN-DEMO-001",
    },
  });

  await prisma.receipt.create({
    data: {
      bookingId: booking2.id,
      imageUrl: "https://placehold.co/600x800?text=DuitNow+Receipt",
      status: "APPROVED",
      verifiedAt: new Date(),
    },
  });

  await prisma.invoice.create({
    data: {
      bookingId: booking2.id,
      invoiceNo: "INV-202604-1001",
      amount: 680.0,
      status: "SENT",
      sentAt: new Date(),
    },
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
        entityId: booking1.id,
      },
      {
        userId: seller.id,
        action: "PAYMENT_CONFIRMED",
        entityType: "Payment",
        entityId: booking2.id,
      },
    ],
  });

  console.log("Seed completed");
  console.log("Admin login: admin@bnpl.test / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });