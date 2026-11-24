import { BRAND } from "./brand";

// Text for the /info/:slug pages. For terms, privacy and refund rules the
// sections are only a fallback: the live wording is in the policy library
// (admin console, Policies and answers), seeded from
// backend/prisma/seed_data/chatbot.js. A slug not listed here falls through
// to NotAvailable.

const SITE = `${BRAND.name}${BRAND.suffix}`;

// A null value is left off the Contact page rather than made up. The email is the one named in the Privacy Policy and Terms.
export const CONTACT = {
  email: "gp17bnplqm@gmail.com",
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
      {
        heading: "Tours and drivers",
        list: [
          "Tours are booked the same way: send a request, the tour guide or rental operator accepts, then you pay a deposit and the balance. A tour has one price per car or per package, not per person.",
          "If you cancel a tour, or miss its balance deadline, the deposit is kept by the guide or operator.",
          "If you would rather not drive, add a licensed driver when you book a car, or after the car is accepted. The driver is a separate booking with its own deposit and balance, paid through the platform.",
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
          "Tours and driver bookings are split the same way, using the deposit the guide, driver or operator sets.",
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
          "Partial refund rules apply to car rentals only. A tour's deposit is always kept if the balance is missed or you cancel.",
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
    nav: "Terms of Service",
    title: "Terms of Service",
    summary: "How booking works and what you agree to when you send a request.",
    lead: `The agreement between you and BNPL17 when you use ${SITE}, on the website or in the app.`,
    // Only shown if the policy library cannot be reached. The full wording
    // is in the library, so this never holds an older copy of the text.
    sections: [
      {
        heading: "The full text could not be loaded",
        paragraphs: [
          "Please refresh the page in a moment. If it still does not load, email gp17bnplqm@gmail.com and we will send you a copy.",
        ],
      },
    ],
    related: [
      { to: "/info/refund-rules", label: "Refund rules" },
      { to: "/info/terms-ms", label: "Baca dalam Bahasa Malaysia" },
    ],
  },

  privacy: {
    nav: "Privacy Policy",
    title: "Privacy Policy",
    summary: "What we collect, why, who can see it, and your rights under the PDPA.",
    lead: `What ${SITE} collects about you, why, who sees it and how long we keep it, under Malaysia's Personal Data Protection Act 2010 (PDPA).`,
    // Only shown if the policy library cannot be reached. The full wording
    // is in the library, so this never holds an older copy of the text.
    sections: [
      {
        heading: "The full text could not be loaded",
        paragraphs: [
          "Please refresh the page in a moment. If it still does not load, email gp17bnplqm@gmail.com and we will send you a copy.",
        ],
      },
    ],
    related: [
      { to: "/info/delete-account", label: "Deleting your account" },
      { to: "/info/privacy-ms", label: "Baca dalam Bahasa Malaysia" },
    ],
  },

  // Bahasa Malaysia versions (PDPA s.7 asks for the notice in both
  // languages). Reached from the English pages; hidden from the side
  // navigation and the Help tiles so each policy shows up once there.
  "terms-ms": {
    hidden: true,
    nav: "Terma Perkhidmatan",
    title: "Terma Perkhidmatan",
    summary: "Terma Perkhidmatan dalam Bahasa Malaysia.",
    lead: `Perjanjian antara anda dan BNPL17 apabila anda menggunakan ${SITE}, di laman web atau dalam aplikasi.`,
    sections: [
      {
        heading: "Teks penuh tidak dapat dimuatkan",
        paragraphs: [
          "Sila muat semula halaman ini sebentar lagi. Jika masih tidak dapat dimuatkan, hantar e-mel ke gp17bnplqm@gmail.com dan kami akan menghantar salinannya kepada anda.",
        ],
      },
    ],
    related: [{ to: "/info/terms", label: "Read in English" }],
  },

  "privacy-ms": {
    hidden: true,
    nav: "Dasar Privasi",
    title: "Dasar Privasi",
    summary: "Dasar Privasi dalam Bahasa Malaysia.",
    lead: `Data yang dikumpul oleh ${SITE} tentang anda, sebabnya, siapa yang melihatnya dan berapa lama kami menyimpannya, di bawah Akta Perlindungan Data Peribadi 2010 (PDPA).`,
    sections: [
      {
        heading: "Teks penuh tidak dapat dimuatkan",
        paragraphs: [
          "Sila muat semula halaman ini sebentar lagi. Jika masih tidak dapat dimuatkan, hantar e-mel ke gp17bnplqm@gmail.com dan kami akan menghantar salinannya kepada anda.",
        ],
      },
    ],
    related: [{ to: "/info/privacy", label: "Read in English" }],
  },

  // Google Play requires a web page where users can ask for their account and
  // data to be deleted without the app installed. The app's operator
  // Account sheet opens this page. Signed-in customers send the
  // request from their profile (POST /customer/account-deletion-request).
  // The button here is for people who cannot sign in: it goes through the
  // Assistant's "contact support" hand-off. Either way it lands in the admin
  // support queue as a "My account" ticket.
  // The 30 day target was confirmed by the client on 23 Nov 2026. Records
  // are kept for 7 years (team decision, 24 Nov 2026, Privacy Policy). Keep
  // the same wording in the customer profile tab, the app's delete screen,
  // the Privacy Policy and the deletion email.
  "delete-account": {
    nav: "Delete your account",
    title: "Deleting your account",
    summary: "How to ask us to delete your account and personal data.",
    lead: `You can ask ${SITE} to delete your account and the personal data linked to it at any time, whether you signed up on the website or in the app.`,
    action: {
      label: "Request account deletion",
      to: "/assistant?q=" + encodeURIComponent("Contact support: please delete my account and personal data"),
    },
    steps: [
      {
        title: "Send a deletion request",
        text: "If you can sign in, open Profile on the website or in the app and choose Delete account. Confirm, and the request goes straight to our team. If you cannot sign in, press Request account deletion above and give the email address your account uses.",
      },
      {
        title: "We confirm it is you",
        text: "We only delete an account when the request comes from you while signed in, or from the email address on the account, so nobody else can delete it for you.",
      },
      {
        title: "We delete your account",
        text: "We aim to finish within 30 days of your request and email you when it is done. You will no longer be able to sign in.",
      },
    ],
    sections: [
      {
        heading: "What we delete",
        list: [
          "Your email address, phone number, profile photo and password. You are signed out on every device.",
          "Your driving licence and any international driving permit you uploaded.",
          "Your saved cars, notifications and notification settings.",
          "Your Assistant chats and support requests.",
          "Your booking history on the platform, such as a missed balance or a no-show.",
        ],
      },
      {
        heading: "What we keep, and for how long",
        list: [
          "Booking, payment, refund and invoice records, with your name on them. Malaysian tax and accounting law requires businesses to keep financial records, so we keep these for 7 years, and then delete them. The phone number, email and driver's date of birth on each booking are removed.",
          "Payment receipts you uploaded for a DuitNow payment, kept with the payment record they belong to.",
        ],
        paragraphs: ["Kept records are not used for anything else, such as marketing."],
      },
      {
        heading: "Before you ask",
        list: [
          "Finish or cancel any booking that is still going on. We cannot delete an account with a booking in progress, a payment due, a refund still on its way to you or a credit appeal waiting for a decision.",
          "Download any invoices you want to keep. You cannot get them from us after the account is deleted.",
          "You can sign up again later with the same email address. It will be a new account without your old bookings.",
        ],
      },
      {
        heading: "Operator accounts",
        paragraphs: [
          "If you run a rental business on the platform, use the same request. Our team closes operator accounts with you directly, because accepted bookings must be completed or cancelled and payouts owed to you settled first.",
        ],
      },
    ],
    related: [{ to: "/info/privacy", label: "Privacy Policy" }],
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
    lead: `${SITE} is a booking platform for car rental, tours and drivers in Sarawak, built on a book now, pay later model.`,
    sections: [
      {
        heading: "What we do",
        paragraphs: [
          `${SITE} lists cars from independent rental operators, tours from rental operators and licensed tour guides, and licensed drivers, all in one place. You compare, send a booking request and pay through the platform. The operator named on each listing provides the car, tour or driver.`,
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
