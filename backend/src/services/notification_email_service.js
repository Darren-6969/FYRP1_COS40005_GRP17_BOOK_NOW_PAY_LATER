import prisma from "../config/db.js";
import { sendEmail } from "./email_service.js";
import { emitToUser } from "../utils/socket.js";

function mapNotification(notification) {
  if (!notification) return null;

  return {
    ...notification,
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt,
  };
}

export async function createInAppNotification({
  userId,
  title,
  message,
  type = "INFO",
}) {
  if (!userId) return null;

  const notification = await prisma.notification.create({
    data: {
      userId,
      title,
      message,
      type,
    },
  });

  emitToUser(userId, "notification:new", mapNotification(notification));

  emitToUser(userId, "notification:refresh", {
    userId,
    reason: "new_notification",
  });

  return notification;
}

export async function notifyCustomerByBooking({
  booking,
  title,
  message,
  type,
  emailSubject,
  emailHtml,
  emailText,
}) {
  await createInAppNotification({
    userId: booking.customerId,
    title,
    message,
    type,
  });

  if (booking.customer?.email && emailSubject && emailHtml) {
    await sendEmail({
      to: booking.customer.email,
      subject: emailSubject,
      html: emailHtml,
      text: emailText || message,
      type,
      relatedEntityType: "Booking",
      relatedEntityId: booking.id,
      userId: booking.customerId,
    });
  }
}

export async function notifyOperatorUsersByBooking({
  booking,
  title,
  message,
  type,
  emailSubject,
  emailHtml,
  emailText,
}) {
  const operatorUsers = await prisma.user.findMany({
    where: {
      operatorId: booking.operatorId,
      role: {
        in: ["NORMAL_SELLER", "MASTER_SELLER"],
      },
    },
    select: {
      id: true,
      email: true,
    },
  });

  for (const user of operatorUsers) {
    await createInAppNotification({
      userId: user.id,
      title,
      message,
      type,
    });

    if (user.email && emailSubject && emailHtml) {
      await sendEmail({
        to: user.email,
        subject: emailSubject,
        html: emailHtml,
        text: emailText || message,
        type,
        relatedEntityType: "Booking",
        relatedEntityId: booking.id,
        userId: user.id,
      });
    }
  }

  if (booking.operator?.email && emailSubject && emailHtml) {
    await sendEmail({
      to: booking.operator.email,
      subject: emailSubject,
      html: emailHtml,
      text: emailText || message,
      type,
      relatedEntityType: "Booking",
      relatedEntityId: booking.id,
      userId: null,
    });
  }
}