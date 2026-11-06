// What the chat window draws for an AI answer (development plan Step 8): the
// answer's text, plus cards and links built from the tool results, never from
// the AI's words. A search shows its cars as cards with removable chips and the
// results link; other tools add links to the car, the booking form, the
// operator or the customer's own bookings. Pure, so it can be tested.

const MAX_LINKS = 5;

function linksFrom(result) {
  const o = result.output || {};
  switch (result.name) {
    case "get_car":
      return o.link ? [{ label: `View the ${o.car}`, href: o.link }] : [];
    case "quote_price":
      return o.booking_link ? [{ label: "Book with these dates", href: o.booking_link }] : [];
    case "make_booking_link":
      return o.booking_link ? [{ label: "Open the booking form", href: o.booking_link }] : [];
    case "get_operator":
      return o.link ? [{ label: o.operator, href: o.link }] : [];
    case "get_my_bookings": {
      const bookings = o.booking ? [o.booking] : o.bookings || [];
      const links = bookings.slice(0, 3).flatMap((b) => [
        ...(b.pay_link ? [{ label: `Pay for ${b.booking_code}`, href: b.pay_link }] : []),
        ...(b.licence_link ? [{ label: "Upload your licence", href: b.licence_link }] : []),
        ...(b.link ? [{ label: `Booking ${b.booking_code}`, href: b.link }] : []),
      ]);
      if (o.all_bookings_link && bookings.length > 1) links.push({ label: "All my bookings", href: o.all_bookings_link });
      return links;
    }
    default:
      return [];
  }
}

/**
 * text: the checked answer. toolResults: this message's results.
 * Returns { payload, lastSearch }, where lastSearch is the query of the
 * message's last search (stored for chips and follow-ups), or null.
 */
export function aiReplyPayload(text, toolResults = []) {
  const ok = toolResults.filter((r) => !r.isError);
  const search = [...ok].reverse().find((r) => r.name === "search_cars" && r.view);

  const seen = new Set();
  const links = ok
    .flatMap(linksFrom)
    .filter((l) => l.href && !seen.has(l.href) && seen.add(l.href))
    .slice(0, MAX_LINKS);

  if (!search) return { payload: { kind: "text", text, ...(links.length ? { links } : {}) }, lastSearch: null };

  const v = search.view;
  return {
    payload: {
      kind: "cars",
      text,
      intro: text,
      cars: v.cars,
      chips: v.chips,
      chipsEditable: true,
      total: v.total,
      resultsHref: v.resultsHref,
      ...(links.length ? { links } : {}),
    },
    lastSearch: v.query,
  };
}
