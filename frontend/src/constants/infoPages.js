import { BRAND } from "./brand";

// Text for the /info/:slug pages. Pilot drafts written from the rules the
// site and booking flow already state; the team reviews them before they are
// final. A slug not listed here falls through to NotAvailable.

const SITE = `${BRAND.name}${BRAND.suffix}`;

// TODO(pilot): fill in before deploying. A null value shows as
// "Being added" on the Contact page rather than a made-up address.
export const CONTACT = {
  email: null,
  phone: null,
  whatsapp: null,
  hours: null,
};

export const INFO_UPDATED = "23 October 2026";

// Order here is the order of the side navigation.
export const INFO_PAGES = {
  terms: {
    nav: "Terms of service",
    title: "Terms of service",
    lead: `How booking a car through ${SITE} works, and what you agree to when you send a request.`,
    sections: [
      {
        heading: "Who you are renting from",
        paragraphs: [
          `${SITE} is a booking platform. The car, the rental and the handover are provided by the independent rental operator named on each listing. ${SITE} takes the booking, shows you the price and collects your payments.`,
        ],
      },
      {
        heading: "Sending a request",
        list: [
          "Sending a booking request is free. Nothing is charged until the operator accepts it.",
          "The car is held for you while the operator decides. Each listing shows how long the operator has to reply.",
          "The operator can accept, decline with a reason, or offer you something different: another car, other dates, another price, or a charge for a pickup place you asked for. You accept or decline the offer before you pay anything. Declining ends the request.",
          "If the operator does not reply in time, the request may close by itself and you can book another car.",
        ],
      },
      {
        heading: "Paying",
        list: [
          "Every amount is worked out by the platform from the operator's rates. The price you are shown before you send a request is the price you pay, unless you accept an offer that changes it.",
          "Once the operator accepts, you pay a deposit. Each operator sets its own deposit, and every listing shows it.",
          "The rest, the balance, is due before pickup by the deadline shown on your booking. Add-ons, pickup and drop-off charges and any night handover charge are paid with the balance.",
          "If pickup is very soon after acceptance, the deposit and balance may be due together, and never later than one hour before pickup.",
          "You can pay by card or by DuitNow with a receipt upload, where the operator accepts it.",
        ],
      },
      {
        heading: "Your driving licence",
        list: [
          "Every car booking needs a valid driving licence for the driver, uploaded by the same deadline as the balance. A licence you uploaded before is reused while it is still valid.",
          "If your licence was issued outside Malaysia, you also upload an international driving permit.",
          "The upload is a first check only. Rental staff inspect the original licence at handover.",
        ],
      },
      {
        heading: "Missed deadlines",
        paragraphs: [
          "If the balance or your licence is not in by its deadline, the booking can be cancelled and the car released. The deposit is then kept by the operator, unless the listing shows a partial refund rule. The refund rules page explains this in full.",
        ],
      },
      {
        heading: "At the counter",
        list: [
          "Returning the car late is charged by the hour at the counter. It is not part of your booking total.",
          "A chauffeur is a request to the operator, not a priced add-on.",
          "The operator's own rental terms on the listing also apply to your rental.",
        ],
      },
    ],
  },

  privacy: {
    nav: "Privacy and PDPA",
    title: "Privacy and personal data",
    lead: `What ${SITE} collects about you, why, and who sees it. Your personal data is handled under Malaysia's Personal Data Protection Act 2010 (PDPA).`,
    sections: [
      {
        heading: "What we collect",
        list: [
          "Account details: your name, email address and password. The password is stored only in a scrambled form we cannot read.",
          "Booking details: your phone number, the driver's name and date of birth, the car, the dates and the places you asked for.",
          "Your driving licence, and an international driving permit where one is needed.",
          "Payment records: amounts, dates and status. Card details are entered on Stripe's page and never reach our servers. DuitNow receipts you upload are kept with the booking.",
          "When you agreed to these terms and this notice, and the network address you agreed from, as a record of your consent.",
          "Your booking history on the platform, such as a missed balance, a licence not uploaded in time, or not turning up for a pickup.",
        ],
      },
      {
        heading: "Why we use it",
        list: [
          "To send your request to the operator, take your payments and send you booking emails.",
          "So the operator can check the driver and hand over the car.",
          "To keep the platform safe and working, and to answer questions about a booking.",
        ],
        paragraphs: ["We do not sell your data and do not send marketing without your consent."],
      },
      {
        heading: "Who can see it",
        list: [
          "The operator of your booking sees your name, phone number, driver details and licence for that booking only. Operators never see other operators' customers.",
          "Licences and documents are private. They open only through short-lived links, for the people who need them.",
          "Service providers that run parts of the platform for us: Stripe for card payments, Resend for email, and our hosting, database and file storage providers. Some of these store data outside Malaysia.",
        ],
      },
      {
        heading: "Your rights",
        paragraphs: [
          "You can ask to see the personal data we hold about you, ask us to correct it, or withdraw consent for anything optional. Use the contact details on the Contact page.",
        ],
      },
    ],
  },

  "refund-rules": {
    nav: "Refund rules",
    title: "Refund rules",
    lead: "What happens to your money if a booking does not go ahead. The refund rule for each car is shown on its listing and again before you pay.",
    sections: [
      {
        heading: "Before the operator accepts",
        paragraphs: ["Nothing has been charged, so there is nothing to refund. If the operator declines or does not reply, the request simply ends."],
      },
      {
        heading: "If you miss the balance or licence deadline",
        paragraphs: [
          "The booking can be cancelled, the car is released, and the deposit is kept by the operator. This is the default.",
          "Some operators choose a partial refund rule instead, for standard rentals outside the platform's peak dates. Where they have, the listing says how much of the deposit you get back, for example 60%.",
          "A licence that is still being checked when the deadline passes does not cancel your booking.",
        ],
      },
      {
        heading: "If you cancel",
        paragraphs: [
          "The listing's refund rule says how much of the deposit the operator refunds when you cancel. You are not charged the balance if you cancel before it is due.",
        ],
      },
      {
        heading: "If the operator's listing is withdrawn",
        paragraphs: [
          "A booking the operator accepted while its listing was live is still honoured if the listing is later withdrawn from the platform.",
        ],
      },
    ],
  },

  contact: {
    nav: "Contact",
    title: "Contact us",
    lead: "Questions about a booking, a payment or your data. For anything about the car itself, such as pickup directions, contact the operator shown on your booking.",
    contact: true,
    sections: [],
  },
};
