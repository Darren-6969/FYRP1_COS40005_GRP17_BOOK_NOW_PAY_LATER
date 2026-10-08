import {
  createPartialRefundForBooking,
  getRefundsForBooking,
} from "../services/refund_service.js";

function operatorScope(req) {
  if (
    req.user?.role ===
    "MASTER_SELLER"
  ) {
    return null;
  }

  return req.user?.operatorId || null;
}

function mapRefund(refund) {
  return {
    ...refund,

    paidAmount:
      Number(refund.paidAmount),

    amount:
      Number(refund.amount),
  };
}


export async function createBookingRefund(
  req,
  res,
  next
) {
  try {
    const result =
      await createPartialRefundForBooking({
        bookingId:
          req.params.id,

        operatorId:
          operatorScope(req),

        reason:
          req.body?.reason,
      });

    res.status(201).json({
      message:
        "Refund request created successfully.",

      booking:
        result.booking,

      refund:
        mapRefund(
          result.refund
        ),
    });
  } catch (err) {
    next(err);
  }
}


export async function getBookingRefunds(
  req,
  res,
  next
) {
  try {
    const refunds =
      await getRefundsForBooking({
        bookingId:
          req.params.id,

        operatorId:
          operatorScope(req),
      });

    res.json(
      refunds.map(mapRefund)
    );
  } catch (err) {
    next(err);
  }
}