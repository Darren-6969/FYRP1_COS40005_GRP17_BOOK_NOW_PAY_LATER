import { BRAND } from "./brand";

// Text for the /info/:slug pages. For terms, privacy and refund rules the
// sections are only a fallback: the live wording is in the policy library
// (admin console, Policies and answers), seeded from
// backend/prisma/seed_data/chatbot.js. A slug not listed here falls through
// to NotAvailable.

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

// Order here is the order of the side navigation and of the Help page tiles.
// `summary` is the one line shown on the Help page (/info) tile.
export const INFO_PAGES = {
  "how-it-works": {
    nav: "How it works",
    title: "How it works",
    summary: "Request a car, wait for the operator, then pay and pick up.",
    lead: "Book now, pay later: you send a request for free, and pay only once the operator has accepted it.",
    // Rendered as numbered steps above the sections.
    steps: [
      {
        title: "Find a car",
        text: "Search by date and place. Each car shows the full price, the deposit and the operator's rules before you book.",
      },
      {
        title: "Send a request",
        text: "It's free and nothing is charged. The car is held for you while the operator decides, and the listing shows how long they have to reply.",
      },
      {
        title: "The operator replies",
        text: "They accept, decline with a reason, or send you an offer such as another car, other dates or a charge for a place you asked for. You accept or decline an offer before you pay anything.",
      },
      {
        title: "Pay the deposit",
        text: "This secures the car. Pay by card, or by DuitNow where the operator accepts it.",
      },
      {
        title: "Pay the balance and upload your licence",
        text: "Both by the deadline on your booking. If your licence was issued outside Malaysia, upload an international driving permit too.",
      },
      {
        title: "Pick up the car",
        text: "Bring your original licence, and permit if you needed one. Staff check them at the counter, then hand over the car.",
      },
    ],
    sections: [
      {
        heading: "What you know before you pay",
        list: [
          "The total price, worked out by the platform from the operator's rates.",
          "How much the deposit is and when the balance is due.",
          "What happens to the deposit if you cancel or miss a deadline.",
        ],
      },
      {
        heading: "If your plans change",
        paragraphs: [
          "You can cancel up to pickup time from your booking page. What you get back depends on the car's refund rule, shown on the listing and again before you pay.",
        ],
      },
      {
        heading: "Returning the car",
        paragraphs: [
          "Return it by the time on your booking. Late returns are charged by the hour at the counter and are not part of your booking total.",
        ],
      },
    ],
    related: [
      { label: "Deposits and balances", to: "/info/deposits-and-balances" },
      { label: "Driving licence and permit", to: "/info/licence-and-permit" },
      { label: "Refund rules", to: "/info/refund-rules" },
    ],
  },

  "deposits-and-balances": {
    nav: "Deposits and balances",
    title: "Deposits and balances",
    summary: "How a booking is paid in two parts, and when each is due.",
    lead: "You pay nothing when you send a request. Once the operator accepts, the price is split into a deposit and a balance.",
    sections: [
      {
        heading: "How the price is split",
        list: [
          "The deposit is a share of the rental that the operator sets, from 0% to 100%. The car's listing shows it before you book.",
          "The balance is the rest of the rental. Add-ons, pickup and drop-off charges and any night handover charge are paid with the balance.",
          "Every amount is worked out by the platform from the operator's rates. What you see before you send the request is what you pay, unless you accept an offer that changes it.",
        ],
      },
      {
        heading: "When each part is due",
        list: [
          "The deposit is due soon after the operator accepts. The exact date and time are on your booking.",
          "The balance is due before pickup, by the deadline shown on your booking.",
          "If pickup is within 48 hours of the operator accepting, the deposit and balance are due together, and never later than one hour before pickup.",
        ],
      },
      {
        heading: "Ways to pay",
        list: [
          "By card, through Stripe. The payment is confirmed straight away.",
          "By DuitNow, where the operator accepts it. You scan the QR code, pay from your banking app and upload the receipt. The operator checks the receipt and confirms it.",
        ],
      },
      {
        heading: "If a payment is missed",
        paragraphs: [
          "A booking whose balance is not paid by its deadline can no longer be paid. It can be cancelled and the car released. The deposit is then kept by the operator, unless the listing shows a partial refund rule. Any balance you already paid is refunded in full. The refund rules page has the details.",
        ],
      },
      {
        heading: "Ready for pickup",
        paragraphs: [
          "Once the balance is paid and your driving licence is approved (and your international driving permit, if you need one), your booking shows as ready for pickup.",
        ],
      },
    ],
  },

  "licence-and-permit": {
    nav: "Licence and permit",
    title: "Driving licence and permit",
    summary: "What to upload, who checks it, and when you need an international permit.",
    lead: "Every car booking needs the driver's driving licence. If the licence was issued outside Malaysia, you also need an international driving permit (IDP).",
    sections: [
      {
        heading: "What to upload",
        list: [
          "A clear photo or scan of the front and back of the driver's full driving licence.",
          "PDF, JPG or PNG, up to 5 MB.",
          "Upload it from your booking page or from Driving licence in your account.",
        ],
      },
      {
        heading: "When to upload",
        list: [
          "By the same deadline as the balance. The date is on your booking.",
          "A licence that was approved for an earlier booking is reused while it is still valid, so you do not need to upload it every time.",
          "If your licence is still being checked when the deadline passes, your booking is not cancelled for that.",
        ],
      },
      {
        heading: "Who checks it",
        list: [
          "The operator of your booking checks the upload, usually within 48 hours.",
          "If they cannot accept it, you are told why (for example expired or unreadable) and asked to upload a new one.",
          "Your licence is private. Only the operator of your booking can open it, and only while you have an active booking with them.",
        ],
      },
      {
        heading: "International driving permit",
        list: [
          "You need one when the driver's licence was issued outside Malaysia. Choose \"Another country\" for where the licence was issued when you book.",
          "The operator can decide a permit is not needed for your licence, for example an English-language licence from another ASEAN country. Your booking page always shows whether one is needed.",
          "Upload the permit with the date it is valid until. It must still be valid on your return date.",
          "The operator checks that it is a real permit, that it has not expired and that its details match your licence.",
        ],
      },
      {
        heading: "At pickup",
        paragraphs: [
          "Bring the original driving licence, and the original permit if you needed one. Rental staff check them at the counter before handing over the car. The upload is a first check only.",
        ],
      },
    ],
  },

  terms: {
    nav: "Terms of service",
    title: "Terms of service",
    summary: "How booking works and what you agree to when you send a request.",
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
          "If the balance or your licence is not in by its deadline, the booking can be cancelled and the car released. The deposit is then kept by the operator, unless the listing shows a partial refund rule. Any balance you have already paid is refunded in full. The refund rules page explains this in full.",
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
    summary: "What we collect, why, and who can see it.",
    lead: `What ${SITE} collects about you, why, and who sees it. Your personal data is handled under Malaysia's Personal Data Protection Act 2010 (PDPA).`,
    sections: [
      {
        heading: "What we collect",
        list: [
          "Account details: your name, email address and password. The password is stored only in a scrambled form we cannot read.",
          "Booking details: your phone number, the driver's name, the car, the dates and the places you asked for.",
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
    summary: "What happens to your money if a booking does not go ahead.",
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
          "Any balance you have already paid is refunded in full. A licence that is still being checked when the deadline passes does not cancel your booking.",
        ],
      },
      {
        heading: "If you cancel",
        paragraphs: [
          "You can cancel up to pickup time. The deposit follows the listing's refund rule, the same as for a missed deadline, and any balance you have paid is refunded in full. You are not charged the balance if you cancel before it is due. After pickup time there is no refund.",
        ],
      },
      {
        heading: "If the operator cancels",
        paragraphs: ["If the operator cancels a booking you are up to date on, everything you paid is refunded."],
      },
      {
        heading: "How refunds are paid",
        paragraphs: [
          "Card payments are refunded to the same card automatically. DuitNow payments are refunded by the operator, within a deadline the platform sets. No fee is taken from your refund.",
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

  about: {
    nav: "About",
    title: `About ${SITE}`,
    summary: "What the platform is and how it works with rental operators.",
    // TODO(pilot): wording to be confirmed by the client before handover.
    lead: `${SITE} is a car rental booking platform for Sarawak, built on a book now, pay later model.`,
    sections: [
      {
        heading: "What we do",
        paragraphs: [
          `${SITE} lists cars from independent rental operators in one place. You compare cars, send a booking request and pay through the platform. The operator named on each listing provides the car and hands it over.`,
        ],
      },
      {
        heading: "Book now, pay later",
        paragraphs: [
          "Sending a request costs nothing. You pay only after the operator accepts: a deposit first, then the balance before pickup. Deposits and balances explains how this works.",
        ],
      },
      {
        heading: "A pilot",
        paragraphs: [
          `${SITE} is in a pilot with a small group of operators. Features and wording may change as we learn from customers and operators. If something does not work as you expect, please tell us through the Contact page.`,
        ],
      },
    ],
  },

  contact: {
    nav: "Contact",
    title: "Contact us",
    summary: "Questions about a booking, a payment or your data.",
    lead: "Questions about a booking, a payment or your data. For anything about the car itself, such as pickup directions, contact the operator shown on your booking.",
    contact: true,
    sections: [],
  },
};
