// The guided Find a car flow (Layer 1): buttons for dates, then passengers,
// then budget per day, then up to five cars and a link to the results page
// with the same filters. No typing and no AI call, so it also stands in when
// the AI is unavailable. It runs the same search as the results page.

import { trackEvent } from "../analytics_service.js";
import { parseCarSearchQuery } from "../car_search_service.js";
import { searchPublicCars } from "../public_car_service.js";
import { guidedDateChoices, parseCustomDates, ringgit } from "../../utils/chat_text.js";

export const STEPS = ["dates", "seats", "budget"];
const PICKUP_TIME = "10:00";
const MAX_CARDS = 5;

const SEAT_CHOICES = [
  { value: "4", label: "1 to 4 people" },
  { value: "5", label: "5 people" },
  { value: "7", label: "6 or 7 people" },
  { value: "8", label: "8 or more" },
];

const BUDGET_CHOICES = [
  { value: "0-100", label: "Under RM 100 a day", pmin: null, pmax: 100 },
  { value: "100-150", label: "RM 100 to 150 a day", pmin: 100, pmax: 150 },
  { value: "150-250", label: "RM 150 to 250 a day", pmin: 150, pmax: 250 },
  { value: "any", label: "Any budget", pmin: null, pmax: null },
];

function stepMessage(step, text, options, extra = {}) {
  return {
    kind: "options",
    text,
    step,
    stepLabel: `Step ${STEPS.indexOf(step) + 1} of ${STEPS.length}`,
    options: options.map(({ value, label }) => ({ value, label })),
    ...extra,
  };
}

/** The first question. Also used to restart with other dates. */
export function startGuided() {
  return {
    state: { step: "dates" },
    reply: stepMessage("dates", "When do you need the car?", guidedDateChoices(), { allowCustomDates: true }),
  };
}

/** The label of the option the customer picked, stored as their message. */
export function choiceLabel(step, value) {
  if (step === "dates") {
    const preset = guidedDateChoices().find((c) => c.value === value);
    return preset ? preset.label : parseCustomDates(value)?.label || null;
  }
  if (step === "seats") return SEAT_CHOICES.find((c) => c.value === value)?.label || null;
  if (step === "budget") return BUDGET_CHOICES.find((c) => c.value === value)?.label || null;
  return null;
}

function queryFor(state, budget) {
  const query = { from: state.from, to: state.to, ft: PICKUP_TIME, tt: PICKUP_TIME, seats: state.seats };
  if (budget?.pmin !== null && budget?.pmin !== undefined) query.pmin = String(budget.pmin);
  if (budget?.pmax !== null && budget?.pmax !== undefined) query.pmax = String(budget.pmax);
  return query;
}

function resultsHref(query) {
  const params = new URLSearchParams();
  ["from", "to", "ft", "tt", "seats", "pmin", "pmax"].forEach((k) => {
    if (query[k]) params.set(k, query[k]);
  });
  return `/cars?${params.toString()}`;
}

function carCard(item, query) {
  const l = item.listing;
  const trip = new URLSearchParams({ from: query.from, to: query.to, ft: query.ft, tt: query.tt });
  return {
    id: l.id,
    name: `${l.vehicleMake} ${l.vehicleModel}`.trim(),
    operator: l.operator.companyName,
    city: l.branch.city,
    seats: l.seats,
    imageUrl: l.images?.[0]?.imageUrl || null,
    dailySen: item.rateSen,
    totalSen: item.quote?.totalSen ?? null,
    depositSen: item.quote?.depositSen ?? null,
    href: `/cars/${l.id}?${trip.toString()}`,
  };
}

async function runSearch(query) {
  const result = await searchPublicCars(parseCarSearchQuery(query));
  const items = result.groups.flatMap((g) => g.items);
  return { total: result.total, items };
}

function filtersApplied(query) {
  return ["from", "seats", "pmin", "pmax"].filter((k) => query[k]).map((k) => (k === "from" ? "dates" : k));
}

/**
 * The next step of the flow.
 * state: { step, from, to, dateLabel, seats, seatsLabel } from the conversation
 * Returns { state, reply, criteria? }, or { error } for a value that doesn't
 * belong to the step (the window then shows the step again).
 */
export async function advanceGuided(state, value) {
  const step = state?.step;

  if (step === "dates") {
    const preset = guidedDateChoices().find((c) => c.value === value);
    const dates = preset || parseCustomDates(value);
    if (!dates) return { error: "Those dates don't work. Pick dates from today, up to 90 days ahead." };
    const next = { step: "seats", from: dates.from, to: dates.to, dateLabel: preset ? dates.label.split(", ").pop() : dates.label };
    return { state: next, reply: stepMessage("seats", "How many people are travelling?", SEAT_CHOICES) };
  }

  if (step === "seats") {
    const seats = SEAT_CHOICES.find((c) => c.value === value);
    if (!seats) return { error: "Pick one of the options." };
    const next = { ...state, step: "budget", seats: seats.value, seatsLabel: seats.label };
    return { state: next, reply: stepMessage("budget", "What's your budget per day?", BUDGET_CHOICES) };
  }

  if (step === "budget") {
    const budget = BUDGET_CHOICES.find((c) => c.value === value);
    if (!budget) return { error: "Pick one of the options." };
    let query = queryFor(state, budget);
    let found = await runSearch(query);
    let relaxed = false;
    if (!found.total && (query.pmin || query.pmax)) {
      // Relax the budget first, as the chatbot design says.
      query = queryFor(state, null);
      found = await runSearch(query);
      relaxed = true;
    }

    trackEvent({
      name: "search_performed",
      properties: {
        input_mode: "conversational",
        filters_applied: filtersApplied(query),
        result_count: found.total,
        category: "CAR_RENTAL",
      },
    });

    const searched = `${state.dateLabel}, 10:00 pickup and return, ${state.seatsLabel.toLowerCase()}`;
    const chips = [state.dateLabel, `${state.seats}+ seats`, ...(relaxed || budget.value === "any" ? [] : [budget.label])];

    if (!found.total) {
      return {
        state: { step: "done" },
        criteria: query,
        reply: {
          kind: "text",
          text: `No cars are free for ${searched}. Try other dates or fewer seats.`,
          actions: [{ key: "find-car", label: "Try other dates" }],
        },
      };
    }

    const cars = found.items.slice(0, MAX_CARDS).map((item) => carCard(item, query));
    const lead = relaxed
      ? `Nothing fits ${budget.label.toLowerCase()} for ${searched}. These are free at any price, lowest deposit first:`
      : `I searched ${searched}. ${found.total === 1 ? "1 car is" : `${found.total} cars are`} free${found.total > MAX_CARDS ? `. The first ${MAX_CARDS}:` : ":"}`;

    return {
      state: { step: "done" },
      criteria: query,
      reply: {
        kind: "cars",
        text: `${lead}\n${cars.map((c) => `${c.name}, ${c.operator}: ${c.totalSen !== null ? `${ringgit(c.totalSen)} total` : `${ringgit(c.dailySen)} a day`}`).join("\n")}`,
        intro: lead,
        cars,
        chips,
        total: found.total,
        resultsHref: resultsHref(query),
      },
    };
  }

  return { error: "Let's start again.", restart: true };
}
