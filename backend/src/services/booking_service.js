const prisma = require('../config/db');

exports.createReservation = async (customer_id, company_id, service_id, dynamicDetails) => {
  
  // Calculate 24-hour expiry deadline for BNPL
  const paymentDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // Clean, single database call using Prisma's nested writes
  const createdBooking = await prisma.booking.create({
    data: {
      customer_id: customer_id,
      company_id: company_id,
      service_id: service_id,
      status: 'PENDING',
      payment_status: 'UNPAID',
      payment_deadline: paymentDeadline,
      booking_details: dynamicDetails, 
      has_suggested_alternative: false,
      logs: {
        create: {
          performed_by: customer_id,
          action: 'Created Reservation'
        }
      }
    }
  });

  return createdBooking;
};

exports.suggestAlternativeRoom = async (originalBookingId, operator_id, new_service_id) => {
    // 1. Fetch the original booking to check the rule
    const originalBooking = await prisma.booking.findUnique({
        where: { id: originalBookingId }
    });

    if (!originalBooking) throw new Error("Original booking not found");
    if (originalBooking.has_suggested_alternative) {
        throw new Error("Business Rule Violation: An alternative has already been suggested for this booking.");
    }

    // 2. Execute the update and creation in a single transaction
    const [updatedOldBooking, newBooking] = await prisma.$transaction([
        // Reject the old one, lock it from future suggestions, and log the action
        prisma.booking.update({
            where: { id: originalBookingId },
            data: { 
                status: 'REJECTED', 
                has_suggested_alternative: true,
                operator_id: operator_id,
                logs: {
                    create: {
                        performed_by: operator_id,
                        action: 'Operator suggested alternative - Booking Rejected'
                    }
                }
            }
        }),
        // Create the new one tied to the original ID, and log the action
        prisma.booking.create({
            data: {
                customer_id: originalBooking.customer_id,
                company_id: originalBooking.company_id,
                operator_id: operator_id,
                service_id: new_service_id,
                status: 'PENDING',
                payment_status: 'UNPAID',
                booking_details: originalBooking.booking_details,
                original_booking_id: originalBookingId, // Links back to the rejected one!
                logs: {
                    create: {
                        performed_by: operator_id,
                        action: 'Alternative Booking Created'
                    }
                }
            }
        })
    ]);

    // Note: You would normally fetch the customer's email and room names here 
    // and call emailService.sendSuggestionEmail()

    return newBooking;
};