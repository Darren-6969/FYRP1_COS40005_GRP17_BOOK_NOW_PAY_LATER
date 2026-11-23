// Car listing fields behind the public filters and the car detail page:
// powertrain and drivetrain (Powertrain and Drivetrain filters), fuel policy,
// mileage policy (the "Unlimited mileage" badge) and travel area. Pure: the
// listing controller calls it on create and on edit.

const ENUMS = {
  powertrain: ["PETROL", "DIESEL", "HYBRID", "EV"],
  drivetrain: ["TWO_WD", "FOUR_WD", "AWD"],
  fuelPolicy: ["FULL_TO_FULL", "SAME_TO_SAME"],
};

const LABELS = {
  powertrain: "Powertrain",
  drivetrain: "Drivetrain",
  fuelPolicy: "Fuel policy",
};

const MAX_TRAVEL_AREA = 500;

function blank(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

/**
 * @param body     the request body (create) or the changed fields (edit)
 * @param options  { partial: true } on edit: only fields present are read,
 *                 and `current` is the saved listing for the mileage rule.
 * @returns {{ data: object, error: string|null }}
 */
export function normaliseVehicleFields(body = {}, { partial = false, current = {} } = {}) {
  const data = {};
  const has = (key) => !partial || Object.prototype.hasOwnProperty.call(body, key);

  for (const [key, allowed] of Object.entries(ENUMS)) {
    if (!has(key)) continue;
    if (blank(body[key])) {
      data[key] = null;
      continue;
    }
    const value = String(body[key]).trim().toUpperCase();
    if (!allowed.includes(value)) return { data: {}, error: `${LABELS[key]} is not a valid option.` };
    data[key] = value;
  }

  if (has("travelArea")) {
    const text = blank(body.travelArea) ? null : String(body.travelArea).trim();
    if (text && text.length > MAX_TRAVEL_AREA) {
      return { data: {}, error: `Keep the travel area under ${MAX_TRAVEL_AREA} characters.` };
    }
    data.travelArea = text;
  }

  // Mileage: unlimited (the default) or limited with a daily km allowance.
  const touchesMileage = ["mileagePolicy", "mileageLimitKm", "mileageExcessRate"].some(has);
  if (touchesMileage) {
    const policy = String(
      (has("mileagePolicy") && !blank(body.mileagePolicy) ? body.mileagePolicy : current.mileagePolicy) || "UNLIMITED"
    ).toUpperCase();
    if (!["UNLIMITED", "LIMITED"].includes(policy)) return { data: {}, error: "Mileage policy is not a valid option." };

    data.mileagePolicy = policy;
    if (policy === "UNLIMITED") {
      data.mileageLimitKm = null;
      data.mileageExcessRate = null;
    } else {
      const limitRaw = has("mileageLimitKm") ? body.mileageLimitKm : current.mileageLimitKm;
      const rateRaw = has("mileageExcessRate") ? body.mileageExcessRate : current.mileageExcessRate;
      const limit = Number(limitRaw);
      if (blank(limitRaw) || !Number.isInteger(limit) || limit < 1) {
        return { data: {}, error: "Enter the daily mileage allowance in km." };
      }
      let rate = null;
      if (!blank(rateRaw)) {
        rate = Number(rateRaw);
        if (!Number.isFinite(rate) || rate < 0 || Math.round(rate * 100) !== rate * 100) {
          return { data: {}, error: "The charge per extra km must be RM with up to 2 decimals." };
        }
      }
      data.mileageLimitKm = limit;
      data.mileageExcessRate = rate;
    }
  }

  return { data, error: null };
}

// New car listings must say what they run on and which wheels drive, so the
// Powertrain and Drivetrain filters never hide them by accident.
export function missingRequiredVehicleFields(data) {
  return ["powertrain", "drivetrain"].filter((key) => !data[key]).map((key) => LABELS[key]);
}
