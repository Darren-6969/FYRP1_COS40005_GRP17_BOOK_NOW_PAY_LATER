const prisma = require('../config/db');
const emailService = require('./email_service');
const { getIO } = require('../utils/socket');

exports.submitManualPayment = async (booking_id, amount, receipt_url) => {
    // Creates a pending payment record waiting for operator review
    return await prisma.payment.create({
        data: {
            booking_id: booking_id,
            amount: amount,
            method: 'DUITNOW',
            status: 'PENDING',
            receipt_url: receipt_url
        }
    });
};

exports.verifyManualPayment = async (paymentId, operator_id) => {
    const payment = await prisma.payment.findUnique({ 
        where: { id: paymentId },
        include: { booking: { include: { customer: true } } } 
    });

    if (!payment) throw new Error("Payment not found");

    // 1. Update the Payment to VERIFIED
    await prisma.payment.update({
        where: { id: paymentId },
        data: {
            status: 'VERIFIED',
            approved_by: operator_id,
            approved_at: new Date(),
            paid_at: new Date()
        }
    });

    // 2. Update the actual Booking to PAID and CONFIRMED
    await prisma.booking.update({
        where: { id: payment.booking_id },
        data: {
            status: 'COMPLETED',
            payment_status: 'PAID'
        }
    });

    // 3. Send the automated email
    await emailService.sendPaymentConfirmedEmail(payment.booking.customer.email, payment.booking_id);
    
    return true;
};

exports.processPayPalWebhook = async (payload, headers) => {
    // Note: In production, you MUST verify the webhook signature using the PayPal SDK here
    // to ensure hackers aren't sending fake payment confirmations.

    // PayPal sends many event types. We only care if the payment was actually captured (completed).
    if (payload.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
        
        // PayPal allows you to pass a "custom_id" when creating a checkout session. 
        // We assume you pass your internal `paymentId` or `bookingId` here.
        const paymentId = payload.resource.custom_id; 

        if (!paymentId) throw new Error("No custom_id found in PayPal payload");

        const payment = await prisma.payment.findUnique({
            where: { id: paymentId },
            include: { booking: { include: { customer: true, operator: true } } }
        });

        if (!payment) throw new Error(`Payment record ${paymentId} not found`);

        // 1. Database Transaction: Update Payment & Booking simultaneously
        await prisma.$transaction([
            prisma.payment.update({
                where: { id: paymentId },
                data: {
                    status: 'COMPLETED',
                    paid_at: new Date()
                }
            }),
            prisma.booking.update({
                where: { id: payment.booking_id },
                data: {
                    status: 'COMPLETED',
                    payment_status: 'PAID',
                    logs: {
                        create: {
                            performed_by: 'SYSTEM_PAYPAL',
                            action: 'PayPal payment completed automatically'
                        }
                    }
                }
            })
        ]);

        // 2. Fire Real-Time WebSocket Notifications!
        const io = getIO();
        
        // Notify the specific customer
        io.to(payment.booking.customer_id).emit('payment_confirmed', {
            bookingId: payment.booking_id,
            message: "Your PayPal payment was successful!"
        });

        // Notify the specific operator
        if (payment.booking.operator_id) {
            io.to(payment.booking.operator_id).emit('booking_paid', {
                bookingId: payment.booking_id,
                message: "A customer just completed a PayPal payment."
            });
        }

        // 3. Send the automated Email
        await emailService.sendPaymentConfirmedEmail(payment.booking.customer.email, payment.booking_id);
    }
};