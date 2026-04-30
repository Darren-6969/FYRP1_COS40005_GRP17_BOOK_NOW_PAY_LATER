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

/**
 * Notify:
 * - Normal seller users under this booking's operator
 * - All master seller/admin users
 *
 * This is what makes the admin notification bell actually receive updates.
 */
export async function notifyOperatorUsersByBooking({
  booking,
  title,
  message,
  type,
  emailSubject,
  emailHtml,
  emailText,
  notifyMaster = true,
}) {
  const operatorUsers = await prisma.user.findMany({
    where: {
      OR: [
        {
          operatorId: booking.operatorId,
          role: "NORMAL_SELLER",
        },
        ...(notifyMaster
          ? [
              {
                role: "MASTER_SELLER",
              },
            ]
          : []),
      ],
    },
    select: {
      id: true,
      email: true,
      role: true,
    },
  });

  const notifiedUserIds = new Set();

  for (const user of operatorUsers) {
    if (notifiedUserIds.has(user.id)) continue;
    notifiedUserIds.add(user.id);

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

  /**
   * Send to merchant/operator email only if it is different from existing user emails.
   * This prevents duplicate emails when the operator user email and operator company email are the same.
   */
  if (booking.operator?.email && emailSubject && emailHtml) {
    const alreadySentToOperatorEmail = operatorUsers.some(
      (user) =>
        user.email?.toLowerCase() === booking.operator.email.toLowerCase()
    );

    if (!alreadySentToOperatorEmail) {
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
}

/**
 * General master/admin system notification.
 * Use this for events not tied to one booking, such as operator creation,
 * email failure, cron result, system setting update, etc.
 */
export async function notifyMasterUsers({
  title,
  message,
  type = "SYSTEM",
  emailSubject,
  emailHtml,
  emailText,
  relatedEntityType = "System",
  relatedEntityId = null,
}) {
  const masterUsers = await prisma.user.findMany({
    where: {
      role: "MASTER_SELLER",
    },
    select: {
      id: true,
      email: true,
    },
  });

  for (const user of masterUsers) {
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
        relatedEntityType,
        relatedEntityId,
        userId: user.id,
      });
    }
  }
}