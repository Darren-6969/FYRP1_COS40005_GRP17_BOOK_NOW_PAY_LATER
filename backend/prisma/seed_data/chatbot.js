// Wording seeded by prisma/seed_chatbot.js: the policy library, the Layer 1
// answer templates, and the starting AI model list and settings. Text only:
// every number (deposit %, rates, refund %) is read live from the operator's
// settings and filled into {placeholders}, never written here.
//
// Bodies are plain text. A blank line starts a new paragraph and a line
// starting with "- " is a list item.

// ── Policy library ───────────────────────────────────────────────────

export const POLICY_DOCUMENTS = [
  {
    key: "terms",
    title: "Terms of service",
    audience: "PLATFORM",
    sections: [
      {
        key: "who-you-rent-from",
        title: "Who you are renting from",
        body: "The platform is a booking service. The car, the rental and the handover are provided by the independent rental operator named on each listing. The platform takes the booking, shows you the price and collects your payments.",
      },
      {
        key: "sending-a-request",
        title: "Sending a request",
        body: [
          "- Sending a booking request is free. Nothing is charged until the operator accepts it.",
          "- The car is held for you while the operator decides. Each listing shows how long the operator has to reply.",
          "- The operator can accept, decline with a reason, or offer you something different: another car, other dates, another price, or a charge for a pickup place you asked for. You accept or decline the offer before you pay anything. Declining ends the request.",
          "- If the operator does not reply in time, the request may close by itself and you can book another car.",
        ].join("\n"),
      },
      {
        key: "paying",
        title: "Paying",
        body: [
          "- Every amount is worked out by the platform from the operator's rates. The price you are shown before you send a request is the price you pay, unless you accept an offer that changes it.",
          "- Once the operator accepts, you pay a deposit. Each operator sets its own deposit, and every listing shows it.",
          "- The rest, the balance, is due before pickup by the deadline shown on your booking. Add-ons, pickup and drop-off charges and any night handover charge are paid with the balance.",
          "- If pickup is very soon after acceptance, the deposit and balance may be due together, and never later than one hour before pickup.",
          "- You can pay by card or by DuitNow with a receipt upload, where the operator accepts it.",
        ].join("\n"),
      },
      {
        key: "driving-licence",
        title: "Your driving licence",
        body: [
          "- Every car booking needs a valid driving licence for the driver, uploaded by the same deadline as the balance. A licence you uploaded before is reused while it is still valid.",
          "- If your licence was issued outside Malaysia, you also upload an international driving permit.",
          "- The upload is a first check only. Rental staff inspect the original licence at handover.",
        ].join("\n"),
      },
      {
        key: "missed-deadlines",
        title: "Missed deadlines",
        body: "If the balance or your licence is not in by its deadline, the booking can be cancelled and the car released. The deposit is then kept by the operator, unless the listing shows a partial refund rule. Any balance you have already paid is refunded in full. The refund rules page explains this in full.",
      },
      {
        key: "at-the-counter",
        title: "At the counter",
        body: [
          "- Returning the car late is charged by the hour at the counter. It is not part of your booking total.",
          "- A chauffeur is a request to the operator, not a priced add-on.",
          "- The operator's own rental terms on the listing also apply to your rental.",
        ].join("\n"),
      },
    ],
  },
  {
    key: "privacy",
    title: "Privacy and personal data",
    audience: "PLATFORM",
    sections: [
      {
        key: "what-we-collect",
        title: "What we collect",
        body: [
          "- Account details: your name, email address and password. The password is stored only in a scrambled form we cannot read.",
          "- Booking details: your phone number, the driver's name, the car, the dates and the places you asked for.",
          "- Your driving licence, and an international driving permit where one is needed.",
          "- Payment records: amounts, dates and status. Card details are entered on Stripe's page and never reach our servers. DuitNow receipts you upload are kept with the booking.",
          "- When you agreed to these terms and this notice, and the network address you agreed from, as a record of your consent.",
          "- Your booking history on the platform, such as a missed balance, a licence not uploaded in time, or not turning up for a pickup.",
        ].join("\n"),
      },
      {
        key: "why-we-use-it",
        title: "Why we use it",
        body: [
          "- To send your request to the operator, take your payments and send you booking emails.",
          "- So the operator can check the driver and hand over the car.",
          "- To keep the platform safe and working, and to answer questions about a booking.",
          "",
          "We do not sell your data and do not send marketing without your consent.",
        ].join("\n"),
      },
      {
        key: "who-can-see-it",
        title: "Who can see it",
        body: [
          "- The operator of your booking sees your name, phone number, driver details and licence for that booking only. Operators never see other operators' customers.",
          "- Licences and documents are private. They open only through short-lived links, for the people who need them.",
          "- Service providers that run parts of the platform for us: Stripe for card payments, Resend for email, and our hosting, database and file storage providers. Some of these store data outside Malaysia.",
        ].join("\n"),
      },
      {
        key: "your-rights",
        title: "Your rights",
        body: "You can ask to see the personal data we hold about you, ask us to correct it, or withdraw consent for anything optional. Use the contact details on the Contact page.",
      },
    ],
  },
  {
    key: "refund-rules",
    title: "Refund rules",
    audience: "PLATFORM",
    sections: [
      {
        key: "before-acceptance",
        title: "Before the operator accepts",
        body: "Nothing has been charged, so there is nothing to refund. If the operator declines or does not reply, the request simply ends.",
      },
      {
        key: "missed-deadline",
        title: "If you miss the balance or licence deadline",
        body: [
          "The booking can be cancelled, the car is released, and the deposit is kept by the operator. This is the default.",
          "",
          "Some operators choose a partial refund rule instead, for standard rentals outside the platform's peak dates. Where they have, the listing says how much of the deposit you get back, for example 60%.",
          "",
          "Any balance you have already paid is refunded in full. A licence that is still being checked when the deadline passes does not cancel your booking.",
        ].join("\n"),
      },
      {
        key: "if-you-cancel",
        title: "If you cancel",
        body: "You can cancel up to pickup time. The deposit follows the listing's refund rule, the same as for a missed deadline, and any balance you have paid is refunded in full. You are not charged the balance if you cancel before it is due. After pickup time there is no refund.",
      },
      {
        key: "if-the-operator-cancels",
        title: "If the operator cancels",
        body: "If the operator cancels a booking you are up to date on, everything you paid is refunded.",
      },
      {
        key: "how-refunds-are-paid",
        title: "How refunds are paid",
        body: "Card payments are refunded to the same card automatically. DuitNow payments are refunded by the operator, within a deadline the platform sets. No fee is taken from your refund.",
      },
      {
        key: "listing-withdrawn",
        title: "If the operator's listing is withdrawn",
        body: "A booking the operator accepted while its listing was live is still honoured if the listing is later withdrawn from the platform.",
      },
    ],
  },
  {
    key: "help",
    title: "Help articles",
    audience: "PLATFORM",
    sections: [
      {
        key: "deposits-and-balance",
        title: "Deposits and the balance",
        body: [
          "Every booking is paid in two parts, a deposit and a balance, both through the platform.",
          "",
          "- Nothing is charged when you send a request. You pay the deposit after the operator accepts.",
          "- Each operator sets its own deposit percentage, shown on every listing and on the booking form.",
          "- The balance is due before pickup, by the deadline shown on your booking. Add-ons and pickup and drop-off charges are paid with the balance.",
          "- Your booking page shows the amount and due date of each part, with a button to pay it. Every reminder email links straight to the payment.",
        ].join("\n"),
      },
      {
        key: "cancellations-and-refunds",
        title: "Cancellations and refunds",
        body: [
          "- You can cancel from your booking page up to pickup time. Before you confirm, you see exactly what you will get back.",
          "- The deposit follows the car's refund rule: by default the operator keeps it, and some operators return part of it.",
          "- Any balance you have paid is refunded in full if the booking does not go ahead before pickup.",
          "- If the operator cancels, everything you paid is refunded.",
          "- Card refunds go back to your card automatically. DuitNow refunds are sent by the operator.",
          "- After pickup time there is no refund.",
        ].join("\n"),
      },
      {
        key: "licence-checks",
        title: "Driving licence checks",
        body: [
          "- After the operator accepts your booking, a licence task appears on your booking page with its deadline, which is the same as the balance deadline.",
          "- Attach a licence already on your account or upload a new one. It must name the driver and be valid until the return date.",
          "- If the licence was issued outside Malaysia, upload an international driving permit with it.",
          "- The operator checks it and tells you straight away if it is rejected, with the reason, so you can upload another.",
          "- Staff check the original licence when you pick up the car.",
        ].join("\n"),
      },
      {
        key: "duitnow-receipts",
        title: "Paying by DuitNow",
        body: [
          "- Pay the amount due to the operator's DuitNow account shown on your payment page.",
          "- Upload the receipt on your booking page against the part you paid, the deposit or the balance.",
          "- The operator checks the receipt. If it is rejected, you see the reason and that part goes back to unpaid.",
          "- Some operators take card payment only, or give their own payment note instead.",
        ].join("\n"),
      },
      {
        key: "pickup-and-dropoff",
        title: "Pickup and drop-off",
        body: [
          "- Each operator has a list of pickup and drop-off points, each with its own charge, which may be free.",
          "- You choose a pickup point and a drop-off point when you book. They can be different.",
          "- You can ask for a place that is not on the list. The operator replies with a charge for it, and you accept or decline before paying anything.",
          "- Pickup or return between 9 pm and 9 am may carry the operator's night handover charge, and some operators do not hand over at night.",
        ].join("\n"),
      },
      {
        key: "late-returns",
        title: "Late returns",
        body: [
          "- Returning the car after the booked time is charged by the hour, at the operator's hourly rate shown on the listing.",
          "- The charge is paid at the counter, not through the platform.",
          "- A late return does not extend your booking. Contact the branch as soon as you know you will be late.",
        ].join("\n"),
      },
    ],
  },
  {
    // Shown as "Questions about this car" on every car detail page.
    // Moved from STANDARD_FAQS in public_car_service.js.
    key: "car-faqs",
    title: "Questions about this car",
    audience: "PLATFORM",
    sections: [
      {
        key: "international-permit",
        title: "Do I need an international driving permit?",
        body: "Only if your licence was issued outside Malaysia. Upload the permit alongside the original licence, by the licence deadline.",
      },
      {
        key: "when-is-balance-due",
        title: "When do I pay the balance?",
        body: "The balance is due before pick-up, on the date shown in your payment schedule. If the balance deadline is missed, the refund rule shown on the listing applies to the deposit.",
      },
      {
        key: "late-pickup",
        title: "What if I pick up late?",
        body: "Call the branch as soon as you know you will be late. The operator decides how long the car is held.",
      },
    ],
  },
];

// ── Layer 1 answer templates ─────────────────────────────────────────
// A ".car" key is the version used when a car is on screen; the rules
// service falls back to the plain key when a placeholder has no value.
// keywords are matched in lower case against messages of six words or fewer.

export const ANSWER_TEMPLATES = [
  {
    key: "welcome",
    quickActionLabel: null,
    keywords: [],
    placeholders: [],
    body: "Hi! I can help you find a car, or explain deposits, refunds and other rules. Pick a question below or type your own.",
  },
  {
    key: "deposit",
    quickActionLabel: "How do deposits work?",
    keywords: ["deposit", "down payment", "downpayment", "balance", "pay later", "how to pay"],
    placeholders: [],
    body: "When the operator accepts your request, you pay a deposit. Each operator sets its own deposit percentage, shown on every listing. The rest, the balance, is paid through the platform before pickup, by the deadline on your booking. Nothing is charged before the operator accepts.",
  },
  {
    key: "deposit.car",
    quickActionLabel: null,
    keywords: [],
    placeholders: ["car_name", "deposit_percent"],
    body: "For the {car_name}, the deposit is {deposit_percent}% of the rental, paid after the operator accepts. The balance is paid through the platform before pickup, by the deadline on your booking.",
  },
  {
    key: "refunds",
    quickActionLabel: "Cancellations and refunds",
    keywords: ["refund", "cancel", "cancellation", "money back"],
    placeholders: [],
    body: "You can cancel up to pickup time. The deposit follows the car's refund rule: by default the operator keeps it, and some operators return part of it. Any balance you have paid is refunded in full. Nothing is charged before the operator accepts, so cancelling before then costs nothing.",
  },
  {
    key: "refunds.car",
    quickActionLabel: null,
    keywords: [],
    placeholders: ["car_name", "refund_rule"],
    body: "For the {car_name}, {refund_rule} Any balance you have paid is refunded in full if you cancel before pickup.",
  },
  {
    key: "late-return",
    quickActionLabel: "Returning late",
    keywords: ["late", "late return", "return late", "overtime"],
    placeholders: [],
    body: "Returning the car after the booked time is charged by the hour at the operator's hourly rate, and paid at the counter, not through the platform. Contact the branch as soon as you know you will be late.",
  },
  {
    key: "late-return.car",
    quickActionLabel: null,
    keywords: [],
    placeholders: ["car_name", "late_hourly_rate"],
    body: "Late returns for the {car_name} are charged at {late_hourly_rate} an hour, paid at the counter. Contact the branch as soon as you know you will be late.",
  },
  {
    key: "licence",
    quickActionLabel: "Driving licence rules",
    keywords: ["licence", "license", "lesen", "idp", "driving permit"],
    placeholders: [],
    body: "Every car booking needs the driver's valid driving licence, uploaded after the operator accepts and by the same deadline as the balance. A licence you uploaded before can be reused while it is still valid. If it was issued outside Malaysia, upload an international driving permit with it. Staff check the original at pickup.",
  },
  {
    key: "duitnow",
    quickActionLabel: "Paying by DuitNow",
    keywords: ["duitnow", "receipt", "bank transfer", "transfer"],
    placeholders: [],
    body: "Pay the amount due to the operator's DuitNow account shown on your payment page, then upload the receipt on your booking page against the part you paid. The operator checks it, and if it is rejected you will see the reason. Some operators take card payment only.",
  },
  {
    key: "booking-status",
    quickActionLabel: "My booking status",
    keywords: ["status", "my booking", "my bookings", "booking status"],
    placeholders: ["booking_lines"],
    signedInOnly: true,
    body: "Your upcoming bookings:\n{booking_lines}",
  },
  {
    key: "payments-due",
    quickActionLabel: "Payments due",
    keywords: ["payment due", "how much left", "amount due", "paid", "my balance", "balance due"],
    placeholders: ["payment_lines"],
    signedInOnly: true,
    body: "Payments on your bookings:\n{payment_lines}",
  },
  {
    key: "licence-status",
    quickActionLabel: "My licence check",
    keywords: ["licence status", "license status", "licence check", "license check"],
    placeholders: ["licence_lines"],
    signedInOnly: true,
    body: "Licence checks on your bookings:\n{licence_lines}",
  },
  {
    key: "sign-in-needed",
    quickActionLabel: null,
    keywords: [],
    placeholders: [],
    body: "Sign in to see your bookings, payments and licence checks. I can still help you find a car or explain the rules.",
  },
];

// ── AI models (all switched off) ─────────────────────────────────────
// modelName must match the ID that `npm run check:ai-keys` lists for the
// key. Prices are USD per million tokens, from the chatbot design (2 Nov 2026).

export const AI_MODELS = [
  { position: 1, provider: "ANTHROPIC", modelName: "claude-haiku-5-5", displayName: "Claude Haiku 5.5", priceInput: "0.10", priceOutput: "0.50" },
  { position: 2, provider: "OPENAI", modelName: "gpt-6-luna", displayName: "GPT-6 Luna", priceInput: "0.10", priceOutput: "0.50" },
  { position: 3, provider: "GOOGLE", modelName: "gemini-3.8-flash", displayName: "Gemini 3.8 Flash", priceInput: "0.75", priceOutput: "3.75" },
];

// Starting values, editable on the AI models page. The monthly cap is a
// placeholder until Felix sets it.
export const AI_SETTINGS = {
  liveCustomerMode: false,
  monthlyCapUsd: "10.00",
  alertPercent: 80,
  messagesPerCustomerHour: 20,
  messagesPerIpHour: 10,
  maxMessageChars: 500,
};
