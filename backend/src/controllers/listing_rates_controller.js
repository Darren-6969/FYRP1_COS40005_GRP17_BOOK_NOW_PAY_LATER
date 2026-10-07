import { previewRates, validateRateCard } from "../services/listing_rates.js";

// POST /api/operators/listings/rate-preview
// Body: { price, hourlyRate?, weeklyRate?, monthlyRate? } in RM.
// Writes nothing. Returns the price of five sample rental lengths plus any
// rate warnings, using the same pricing engine as checkout.
export function previewListingRates(req, res) {
  const { ok, errors, card } = validateRateCard(req.body || {});

  if (!ok) {
    return res.status(400).json({
      message: "Some rates are not valid.",
      errors,
    });
  }

  return res.json(previewRates(card));
}
