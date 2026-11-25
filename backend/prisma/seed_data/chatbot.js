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
    title: "Terms of Service",
    audience: "PLATFORM",
    sections: [
      {
        key: "who-you-rent-from",
        title: "Who you book with",
        body: [
          "These Terms are an agreement between you and BNPL17 for using the BNPL platform: the website at fypbnplquma.tech and the BNPL Android app, published on Google Play by grp17FYP. By creating an account or sending a booking request, you agree to these Terms, our Privacy Policy and our Refund rules. If you do not agree, do not use the platform.",
          "",
          "The platform is a booking service. Cars, tours and driver services are provided by independent operators: rental companies, licensed tour guides and licensed drivers. The operator named on each listing provides the car or service and is responsible for it.",
          "",
          "We show listings, work out the price, take your booking request, collect your payments and pass them to the operator. We do not own the cars and do not provide the tours or driving ourselves. The operator's own rental or service terms shown on the listing also apply. If they conflict with these Terms on how the platform handles bookings and payments, these Terms apply.",
        ].join("\n"),
      },
      {
        key: "who-can-use",
        title: "Who can use the platform",
        body: [
          "- You must be at least 18 years old.",
          "- Every driver must hold a valid driving licence for the car booked. Some operators set a higher minimum driver age; the listing shows it.",
          "- You must give true, complete and current information, and keep it up to date.",
          "- One person, one account. You are responsible for everything done through your account, so keep your password private and tell us at once if you think someone else has used it.",
        ].join("\n"),
      },
      {
        key: "sending-a-request",
        title: "Booking requests",
        body: [
          "- Sending a booking request is free. Nothing is charged until the operator accepts it.",
          "- A request is not a confirmed booking. The car or service is held for you while the operator decides. Each listing shows how long the operator has to reply.",
          "- The operator can accept, decline with a reason, or offer something different: another car, other dates, another price, or a charge for a pickup or drop-off place you asked for. You accept or decline the offer before you pay anything. Declining ends the request.",
          "- If the operator does not reply in time, the request may close on its own and you can book something else.",
          "- Tour packages and driver services follow the same request, acceptance and payment steps unless the listing says otherwise.",
        ].join("\n"),
      },
      {
        key: "paying",
        title: "Prices and payment",
        body: [
          "- The platform works out every amount from the operator's rates. The price shown before you send a request is the price you pay, unless you accept an offer that changes it.",
          "- Once the operator accepts, you pay a deposit. Each operator sets its own deposit percentage, and every listing shows it.",
          "- The balance is due before pickup by the deadline shown on your booking. Add-ons, pickup and drop-off charges and any night handover charge are paid with the balance.",
          "- If pickup is less than 48 hours after acceptance, the deposit and balance may be due together, and never later than 1 hour before pickup.",
          "- You can pay by card through Stripe, or by DuitNow with a receipt upload where the operator accepts it.",
          "- A DuitNow payment counts only after the operator checks and approves your receipt. Uploading a receipt does not by itself confirm payment.",
          "- All prices are in Malaysian ringgit (RM).",
        ].join("\n"),
      },
      {
        key: "driving-licence",
        title: "Driving licence",
        body: [
          "- Every car booking needs a valid licence for the driver, uploaded by the same deadline as the balance. You can attach a licence already on your account if it names the driver and is valid on your return date.",
          "- If the licence was issued outside Malaysia, you also upload an international driving permit.",
          "- The operator checks the upload. This is a first check only. The operator inspects the original licence at handover and can refuse the handover if it is not valid or does not match.",
        ].join("\n"),
      },
      {
        key: "missed-deadlines",
        title: "Missed deadlines",
        body: "If the balance or the licence is not in by its deadline, the booking can be cancelled and the car released. The deposit is then kept by the operator, unless the listing shows a partial refund rule. Any balance you have already paid is refunded in full. A licence that is still being checked when the deadline passes does not cancel your booking. We record missed deadlines, no-shows and cancellations on your booking history, as the Privacy Policy explains.",
      },
      {
        key: "changes-and-cancellations",
        title: "Changes and cancellations",
        body: [
          "- You can ask to change a booking. A change needs the operator's agreement and may change the price.",
          "- You can cancel a booking up to the pickup time. The deposit follows the refund rule on the listing, and any balance you have paid is refunded in full. After pickup time there is no refund.",
          "- If the operator cancels a booking you are up to date on, it must give a reason and everything you paid is refunded.",
          "- Card refunds go back to your card through Stripe. DuitNow refunds are sent by the operator to the account you give, within the deadline in our Refund rules. No fee is taken from your refund.",
          "- The Refund rules page at fypbnplquma.tech/info/refund-rules has the full details and forms part of these Terms.",
        ].join("\n"),
      },
      {
        key: "at-the-counter",
        title: "At pickup and during the rental",
        body: [
          "- Returning the car late is charged by the hour at the counter. It is not part of your booking total.",
          "- A chauffeur is a request to the operator, not a priced add-on.",
          "- Damage, fuel, mileage, traffic fines, insurance and the condition of the car are covered by the operator's own rental terms.",
        ].join("\n"),
      },
      {
        key: "not-allowed",
        title: "What you must not do",
        body: [
          "- Give false details, use someone else's licence or payment method, or book for someone without their permission.",
          "- Upload fake or altered licences, permits or receipts.",
          "- Try to get into another person's account, the operator area or the admin area.",
          "- Copy, scrape or overload the platform, or try to get around its security.",
          "- Use the chat to harass anyone or to send unlawful content.",
        ].join("\n"),
      },
      {
        key: "chat-assistant",
        title: "The chat assistant",
        body: "The chat assistant can use AI to answer questions. Its answers are for information only and may be wrong. It cannot make, change or cancel a booking or agree to a refund. Your booking page, the operator and our support team have the final word.",
      },
      {
        key: "your-account",
        title: "Suspending or closing your account",
        body: [
          "- We may suspend or close an account that breaks these Terms, gives false details or puts other users at risk. We will tell you why unless the law prevents it.",
          "- You can delete your account from Profile > Delete account in the app, or at fypbnplquma.tech/info/delete-account. We can delete it once your bookings are finished and no refund is still open. Booking, payment and invoice records are kept as the Privacy Policy explains.",
        ].join("\n"),
      },
      {
        key: "availability",
        title: "Availability of the platform",
        body: "We try to keep the platform running at all times, but it may be unavailable for maintenance, updates or problems outside our control. We will not hold you responsible for a deadline you miss only because the platform was down; contact us and we will work with the operator to sort it out.",
      },
      {
        key: "responsibility",
        title: "Our responsibility",
        body: [
          "- The operator is responsible for the car, tour or driving service, its condition, safety and insurance, and for what happens during the rental or service.",
          "- We are responsible for running the platform with reasonable care, charging the correct amounts and handling refunds as these Terms and the Refund rules say.",
          "- As far as the law allows, we are not liable for indirect losses, such as lost plans or lost earnings, and our total liability for a booking is limited to the amount you paid through the platform for that booking.",
          "- Nothing in these Terms takes away rights you have under the Consumer Protection Act 1999 or other Malaysian law that cannot be excluded.",
        ].join("\n"),
      },
      {
        key: "changes-to-terms",
        title: "Changes to these Terms",
        body: "We may update these Terms. We will post the new version here with a new date. If a change is significant, we will tell you by email or in the app before it takes effect. A booking already accepted follows the Terms in force when you sent the request.",
      },
      {
        key: "law-and-disputes",
        title: "Law and disputes",
        body: "These Terms are governed by the laws of Malaysia. If something goes wrong, contact us first at gp17bnplqm@gmail.com and we will try to resolve it. If we cannot, either side may take it to the Malaysian courts, or you may file a claim with the Tribunal for Consumer Claims Malaysia.",
      },
      {
        key: "contact",
        title: "Contact",
        body: "BNPL17, gp17bnplqm@gmail.com. These Terms are also available in Bahasa Malaysia at fypbnplquma.tech/info/terms-ms. If the two differ, the English version applies.",
      },
    ],
  },
  {
    key: "privacy",
    title: "Privacy Policy",
    audience: "PLATFORM",
    sections: [
      {
        key: "who-we-are",
        title: "Who we are",
        body: [
          "This Privacy Policy explains how BNPL17 collects, uses, shares and protects your personal data when you use the BNPL platform: the website at fypbnplquma.tech and the BNPL Android app. It is our written notice under Malaysia's Personal Data Protection Act 2010 (PDPA).",
          "",
          "The platform is run by BNPL17. BNPL17 publishes the app on Google Play under the developer name grp17FYP. We are the data controller for the personal data described here. Contact us at gp17bnplqm@gmail.com for any privacy question, request or complaint.",
          "",
          "Cars, tours and driver services are provided by independent operators: rental companies, tour guides and drivers. Each operator is responsible for the personal data it holds about you for its own rental or service.",
        ].join("\n"),
      },
      {
        key: "what-we-collect",
        title: "What we collect",
        body: [
          "You give us:",
          "- Account details: your name, email address, password and, if you choose, a phone number and a profile picture.",
          "- Booking details: the car, tour or driver service, dates and times, pickup and drop-off places, the driver's name and phone number, add-ons and any notes you write to the operator.",
          "- Driving licence: a photo or file of the driver's licence, and an international driving permit if the licence was issued outside Malaysia. These may show your photo, licence number, identity card or passport number, date of birth and address. Some operators also ask for a date of birth to check a minimum driver age.",
          "- Payment receipts: DuitNow receipts you upload, with the amount and date.",
          "- Messages: what you type to our chat assistant or support team, and the email address you give if you chat without signing in.",
          "- Requests: account deletion requests, credit record appeals and other support requests.",
          "",
          "We create or record:",
          "- Payment records: amounts, dates, payment method, status, refunds and invoices. Card numbers are entered on Stripe's page and never reach our servers.",
          "- Booking history: events such as a missed balance deadline, a licence not uploaded in time, a no-show or a cancellation. This is kept as a record only. It does not change your deposit or what you can book.",
          "- Consent record: when you accepted this Privacy Policy and the Terms of Service, and the IP address you accepted from.",
          "- Security and usage records: sign-in times, one-time passcodes (stored scrambled), audit logs of account changes with the IP address, and error reports.",
          "- Product usage: events such as a search, a car viewed or a booking made, recorded with reference numbers and counts only.",
          "- Your settings: notification choices and saved cars.",
          "",
          "Device permissions: the app asks to use your camera or photo library only when you choose to upload a profile picture, licence, permit or receipt. We do not collect your location, contacts or the list of apps on your phone.",
          "",
          "Required or optional: your name, email address, password, booking details, the driver's licence and payment details are needed to make a booking. Without them we cannot take or complete it. Your phone number (unless an operator needs it), profile picture, saved cars and promotional emails are optional.",
          "",
          "Where it comes from: almost everything comes from you. Payment results come from Stripe. Licence checks and booking decisions come from the operator.",
          "",
          "Sensitive data: we do not ask for health, religious, political, criminal or biometric data. Your licence photo is used only so the operator can look at it, not for face matching.",
        ].join("\n"),
      },
      {
        key: "why-we-use-it",
        title: "How we use it",
        body: [
          "- To create and run your account and keep it secure.",
          "- To send your booking request to the operator and manage it through to return.",
          "- To work out prices, take payments, process refunds and issue invoices.",
          "- So the operator can check the driver's licence and hand over the car or start the service.",
          "- To send booking, payment and account emails and in-app notifications.",
          "- To answer your questions through the chat assistant and the support team.",
          "- To find and fix errors, prevent fraud and misuse, and keep records the law requires.",
          "- To understand how the platform is used and improve it, using counts and reference numbers, not your name or contact details.",
          "- To send promotions, only if you turn them on in your notification settings.",
          "",
          "We do not sell your personal data. We do not use it for advertising by other companies.",
        ].join("\n"),
      },
      {
        key: "chat-assistant",
        title: "The chat assistant",
        body: [
          "The chat assistant answers some questions with fixed answers. Others are answered by an AI model from OpenAI, Google (Gemini) or Mistral. When the AI answers, your message, the conversation so far and the platform data needed for the answer are sent to that provider. This can include your booking reference, dates, car and booking status. Your driving licence, permit and receipts are never sent to an AI provider.",
          "",
          "The AI can only look up information; it cannot make, change or cancel a booking. Its answers are checked before you see them, but they may still be wrong. Your booking page, the operator and our support team have the final word. Please do not type card numbers, passwords or identity numbers into the chat. Conversations are kept so our support team can follow up.",
        ].join("\n"),
      },
      {
        key: "who-can-see-it",
        title: "Who we share it with",
        body: [
          "- The operator of your booking sees your name, phone number, email address, driver details, licence and permit, receipts and booking details for that booking only. Operators never see other operators' customers.",
          "- Stripe, for card payments and card refunds.",
          "- Resend, for emails.",
          "- OpenAI, Google and Mistral, for AI chat answers, as described above.",
          "- Sentry, for error reports. It is set up not to collect personal data by default.",
          "- Hostinger, for the server that runs the platform, its database and uploaded files.",
          "- Authorities, when the law requires it, for example a court order or a request from the police or a regulator.",
          "- A new owner, if the platform is transferred, under the same protections described here.",
          "",
          "Service providers use your data only to run their part of the platform for us.",
        ].join("\n"),
      },
      {
        key: "transfers",
        title: "Transfers outside Malaysia",
        body: "Some of our service providers store or process data outside Malaysia, including in the United States and the European Union. We use providers that protect personal data to a standard at least equal to the PDPA. Our own server, database and uploaded files are in Kuala Lumpur, Malaysia.",
      },
      {
        key: "security",
        title: "How we protect it",
        body: [
          "- Passwords and one-time passcodes are stored only in a scrambled form we cannot read.",
          "- All traffic between your device and the platform is encrypted (HTTPS).",
          "- Licences, permits and receipts are kept private. They open only through links that expire after a short time, and only for the operator of that booking and our admins.",
          "- Each operator can see only its own bookings and customers.",
          "- Sign-in tokens in the app are kept in your phone's secure storage.",
          "- Admin and settings changes are logged with who made them and when.",
          "- Repeated sign-in or request attempts are limited to block attacks.",
          "",
          "No system is completely secure. If a breach of personal data is likely to cause you significant harm, we will tell you and the Personal Data Protection Commissioner as the PDPA requires.",
        ].join("\n"),
      },
      {
        key: "retention",
        title: "How long we keep it",
        body: [
          "- Your account: while it is open. When you ask us to delete it, we aim to finish within 30 days. Your licence and permit files, booking history record, saved cars, notifications, chat conversations, support requests and sign-in data are deleted, and your email address, phone number and profile picture are removed.",
          "- Booking, payment, refund and invoice records: kept after deletion for 7 years because Malaysian tax and accounting law requires it. Your name stays on those records because invoices and receipts show it, and DuitNow receipts stay with the payment they belong to.",
          "- Security and audit logs: kept for 2 years, then deleted.",
          "- Chat conversations: kept for 12 months after the last message, then deleted.",
        ].join("\n"),
      },
      {
        key: "your-rights",
        title: "Your rights",
        body: [
          "Under the PDPA you can:",
          "- See the personal data we hold about you and get a copy.",
          "- Correct data that is wrong, incomplete or out of date. You can change your name, phone number and profile picture yourself in Profile.",
          "- Withdraw consent for anything optional, such as promotional emails, in your notification settings or by emailing us.",
          "- Stop direct marketing at any time.",
          "- Ask us to send your data to you or another organisation in a common format, where the PDPA allows.",
          "- Delete your account from Profile > Delete account in the app, or at fypbnplquma.tech/info/delete-account. We can delete it once your bookings are finished and no refund is still open.",
          "- Complain to us, and if you are not satisfied, to the Personal Data Protection Commissioner of Malaysia.",
          "",
          "To use any of these rights, email gp17bnplqm@gmail.com from the address on your account. We reply within 21 days. We may ask you to confirm who you are first.",
        ].join("\n"),
      },
      {
        key: "age",
        title: "Age",
        body: "You must be at least 18 years old to create an account. We do not knowingly collect data from anyone under 18. If we find we have, we will delete it.",
      },
      {
        key: "changes",
        title: "Changes to this policy",
        body: "We will post any change here and update the date at the top. If a change affects how we use data you have already given us, we will tell you by email or in the app before it takes effect, and ask for your consent again where the law requires.",
      },
      {
        key: "language",
        title: "Language",
        body: "This policy is available in English and in Bahasa Malaysia at fypbnplquma.tech/info/privacy-ms. If the two differ, the English version applies.",
      },
    ],
  },
  {
    key: "terms-ms",
    title: "Terma Perkhidmatan",
    audience: "PLATFORM",
    sections: [
      {
        key: "who-you-rent-from",
        title: "Dengan siapa anda menempah",
        body: [
          "Terma ini ialah perjanjian antara anda dan BNPL17 bagi penggunaan platform BNPL: laman web di fypbnplquma.tech dan aplikasi Android BNPL, yang diterbitkan di Google Play oleh grp17FYP. Dengan membuka akaun atau menghantar permintaan tempahan, anda bersetuju dengan Terma ini, Dasar Privasi kami dan Peraturan Bayaran Balik kami. Jika anda tidak bersetuju, jangan gunakan platform ini.",
          "",
          "Platform ini ialah perkhidmatan tempahan. Kereta, lawatan dan perkhidmatan pemandu disediakan oleh pengendali bebas: syarikat sewa kereta, pemandu pelancong berlesen dan pemandu berlesen. Pengendali yang dinamakan pada setiap senarai menyediakan kereta atau perkhidmatan dan bertanggungjawab ke atasnya.",
          "",
          "Kami memaparkan senarai, mengira harga, menerima permintaan tempahan anda, mengutip bayaran anda dan menyalurkannya kepada pengendali. Kami tidak memiliki kereta dan tidak menyediakan lawatan atau perkhidmatan memandu sendiri. Terma sewaan atau perkhidmatan pengendali yang dipaparkan pada senarai juga terpakai. Jika terma itu bercanggah dengan Terma ini tentang cara platform mengendalikan tempahan dan pembayaran, Terma ini terpakai.",
        ].join("\n"),
      },
      {
        key: "who-can-use",
        title: "Siapa yang boleh menggunakan platform",
        body: [
          "- Anda mesti berumur sekurang-kurangnya 18 tahun.",
          "- Setiap pemandu mesti memegang lesen memandu yang sah bagi kereta yang ditempah. Sesetengah pengendali menetapkan umur minimum pemandu yang lebih tinggi; senarai akan menunjukkannya.",
          "- Anda mesti memberikan maklumat yang benar, lengkap dan terkini, dan sentiasa mengemas kininya.",
          "- Satu orang, satu akaun. Anda bertanggungjawab atas segala yang dilakukan melalui akaun anda, jadi rahsiakan kata laluan anda dan maklumkan kami segera jika anda fikir orang lain telah menggunakannya.",
        ].join("\n"),
      },
      {
        key: "sending-a-request",
        title: "Permintaan tempahan",
        body: [
          "- Menghantar permintaan tempahan adalah percuma. Tiada caj dikenakan sehingga pengendali menerimanya.",
          "- Permintaan bukan tempahan yang disahkan. Kereta atau perkhidmatan ditahan untuk anda sementara pengendali membuat keputusan. Setiap senarai menunjukkan tempoh pengendali perlu membalas.",
          "- Pengendali boleh menerima, menolak dengan alasan, atau menawarkan sesuatu yang berbeza: kereta lain, tarikh lain, harga lain, atau caj bagi tempat ambil atau pulang yang anda minta. Anda menerima atau menolak tawaran itu sebelum membayar apa-apa. Menolak tawaran menamatkan permintaan.",
          "- Jika pengendali tidak membalas dalam masa yang ditetapkan, permintaan mungkin ditutup dengan sendirinya dan anda boleh menempah yang lain.",
          "- Pakej lawatan dan perkhidmatan pemandu mengikut langkah permintaan, penerimaan dan pembayaran yang sama melainkan senarai menyatakan sebaliknya.",
        ].join("\n"),
      },
      {
        key: "paying",
        title: "Harga dan pembayaran",
        body: [
          "- Platform mengira setiap jumlah berdasarkan kadar pengendali. Harga yang dipaparkan sebelum anda menghantar permintaan ialah harga yang anda bayar, melainkan anda menerima tawaran yang mengubahnya.",
          "- Setelah pengendali menerima, anda membayar deposit. Setiap pengendali menetapkan peratusan depositnya sendiri, dan setiap senarai memaparkannya.",
          "- Baki perlu dibayar sebelum pengambilan, mengikut tarikh akhir yang dipaparkan pada tempahan anda. Tambahan, caj ambil dan pulang serta sebarang caj serahan waktu malam dibayar bersama baki.",
          "- Jika pengambilan kurang daripada 48 jam selepas penerimaan, deposit dan baki mungkin perlu dibayar serentak, dan tidak lewat daripada 1 jam sebelum pengambilan.",
          "- Anda boleh membayar dengan kad melalui Stripe, atau dengan DuitNow beserta muat naik resit jika pengendali menerimanya.",
          "- Pembayaran DuitNow hanya dikira selepas pengendali menyemak dan meluluskan resit anda. Memuat naik resit tidak dengan sendirinya mengesahkan pembayaran.",
          "- Semua harga dalam ringgit Malaysia (RM).",
        ].join("\n"),
      },
      {
        key: "driving-licence",
        title: "Lesen memandu",
        body: [
          "- Setiap tempahan kereta memerlukan lesen yang sah bagi pemandu, dimuat naik sebelum tarikh akhir yang sama dengan baki. Lesen yang pernah anda muat naik digunakan semula selagi masih sah.",
          "- Jika lesen dikeluarkan di luar Malaysia, anda juga perlu memuat naik permit memandu antarabangsa.",
          "- Pengendali menyemak muat naik tersebut. Ini hanya semakan awal. Pengendali memeriksa lesen asal semasa serahan dan boleh menolak serahan jika lesen tidak sah atau tidak sepadan.",
        ].join("\n"),
      },
      {
        key: "missed-deadlines",
        title: "Terlepas tarikh akhir",
        body: "Jika baki atau lesen tidak diterima sebelum tarikh akhirnya, tempahan boleh dibatalkan dan kereta dilepaskan. Deposit kemudian disimpan oleh pengendali, melainkan senarai menunjukkan peraturan bayaran balik separa. Sebarang baki yang telah anda bayar akan dibayar balik sepenuhnya. Lesen yang masih disemak semasa tarikh akhir berlalu tidak membatalkan tempahan anda. Kami merekod tarikh akhir yang terlepas, ketidakhadiran dan pembatalan dalam sejarah tempahan anda, seperti yang diterangkan dalam Dasar Privasi.",
      },
      {
        key: "changes-and-cancellations",
        title: "Perubahan dan pembatalan",
        body: [
          "- Anda boleh meminta untuk mengubah tempahan. Perubahan memerlukan persetujuan pengendali dan mungkin mengubah harga.",
          "- Anda boleh membatalkan tempahan sehingga waktu pengambilan. Deposit mengikut peraturan bayaran balik pada senarai, dan sebarang baki yang telah anda bayar akan dibayar balik sepenuhnya. Selepas waktu pengambilan, tiada bayaran balik.",
          "- Jika pengendali membatalkan tempahan yang semua bayarannya telah anda jelaskan mengikut jadual, pengendali mesti memberikan alasan dan semua yang anda bayar akan dibayar balik.",
          "- Bayaran balik kad dikembalikan ke kad anda melalui Stripe. Bayaran balik DuitNow dihantar oleh pengendali ke akaun yang anda berikan, dalam tempoh yang ditetapkan dalam Peraturan Bayaran Balik kami. Tiada fi diambil daripada bayaran balik anda.",
          "- Halaman Peraturan Bayaran Balik di fypbnplquma.tech/info/refund-rules mengandungi butiran penuh dan menjadi sebahagian daripada Terma ini.",
        ].join("\n"),
      },
      {
        key: "at-the-counter",
        title: "Semasa pengambilan dan sewaan",
        body: [
          "- Memulangkan kereta lewat dikenakan caj mengikut jam di kaunter. Caj ini bukan sebahagian daripada jumlah tempahan anda.",
          "- Pemandu peribadi (chauffeur) ialah permintaan kepada pengendali, bukan tambahan berbayar.",
          "- Kerosakan, minyak, perbatuan, saman trafik, insurans dan keadaan kereta tertakluk kepada terma sewaan pengendali sendiri.",
        ].join("\n"),
      },
      {
        key: "not-allowed",
        title: "Perkara yang tidak boleh anda lakukan",
        body: [
          "- Memberikan butiran palsu, menggunakan lesen atau kaedah pembayaran orang lain, atau menempah bagi seseorang tanpa kebenarannya.",
          "- Memuat naik lesen, permit atau resit yang palsu atau telah diubah.",
          "- Cuba memasuki akaun orang lain, kawasan pengendali atau kawasan pentadbir.",
          "- Menyalin, mengikis (scrape) atau membebankan platform, atau cuba memintas keselamatannya.",
          "- Menggunakan sembang untuk mengganggu sesiapa atau menghantar kandungan yang menyalahi undang-undang.",
        ].join("\n"),
      },
      {
        key: "chat-assistant",
        title: "Pembantu sembang",
        body: "Pembantu sembang boleh menggunakan AI untuk menjawab soalan. Jawapannya untuk makluman sahaja dan mungkin salah. Ia tidak boleh membuat, mengubah atau membatalkan tempahan atau meluluskan bayaran balik. Halaman tempahan anda, pengendali dan pasukan sokongan kami mempunyai kata putus.",
      },
      {
        key: "your-account",
        title: "Penggantungan atau penutupan akaun",
        body: [
          "- Kami boleh menggantung atau menutup akaun yang melanggar Terma ini, memberikan butiran palsu atau membahayakan pengguna lain. Kami akan memberitahu sebabnya melainkan undang-undang menghalang.",
          "- Anda boleh memadam akaun melalui Profil > Padam akaun dalam aplikasi, atau di fypbnplquma.tech/info/delete-account. Kami boleh memadamnya setelah tempahan anda selesai dan tiada bayaran balik yang masih belum selesai. Rekod tempahan, pembayaran dan invois disimpan seperti yang diterangkan dalam Dasar Privasi.",
        ].join("\n"),
      },
      {
        key: "availability",
        title: "Ketersediaan platform",
        body: "Kami berusaha memastikan platform beroperasi pada setiap masa, tetapi ia mungkin tidak tersedia kerana penyelenggaraan, kemas kini atau masalah di luar kawalan kami. Kami tidak akan menganggap anda bersalah atas tarikh akhir yang terlepas semata-mata kerana platform tidak berfungsi; hubungi kami dan kami akan bekerjasama dengan pengendali untuk menyelesaikannya.",
      },
      {
        key: "responsibility",
        title: "Tanggungjawab kami",
        body: [
          "- Pengendali bertanggungjawab atas kereta, lawatan atau perkhidmatan memandu, keadaan, keselamatan dan insuransnya, serta apa yang berlaku semasa sewaan atau perkhidmatan.",
          "- Kami bertanggungjawab mengendalikan platform dengan berhati-hati secara munasabah, mengenakan jumlah yang betul dan mengendalikan bayaran balik seperti yang dinyatakan dalam Terma ini dan Peraturan Bayaran Balik.",
          "- Setakat yang dibenarkan undang-undang, kami tidak bertanggungjawab atas kerugian tidak langsung, seperti rancangan yang terjejas atau pendapatan yang hilang, dan jumlah tanggungan kami bagi sesuatu tempahan terhad kepada jumlah yang anda bayar melalui platform bagi tempahan itu.",
          "- Tiada apa-apa dalam Terma ini menghapuskan hak anda di bawah Akta Perlindungan Pengguna 1999 atau undang-undang Malaysia lain yang tidak boleh dikecualikan.",
        ].join("\n"),
      },
      {
        key: "changes-to-terms",
        title: "Perubahan pada Terma ini",
        body: "Kami boleh mengemas kini Terma ini. Kami akan menyiarkan versi baharu di sini dengan tarikh baharu. Jika perubahan itu ketara, kami akan memaklumkan anda melalui e-mel atau dalam aplikasi sebelum ia berkuat kuasa. Tempahan yang telah diterima mengikut Terma yang berkuat kuasa semasa anda menghantar permintaan.",
      },
      {
        key: "law-and-disputes",
        title: "Undang-undang dan pertikaian",
        body: "Terma ini ditadbir oleh undang-undang Malaysia. Jika berlaku masalah, hubungi kami dahulu di gp17bnplqm@gmail.com dan kami akan cuba menyelesaikannya. Jika tidak dapat diselesaikan, mana-mana pihak boleh membawanya ke mahkamah Malaysia, atau anda boleh memfailkan tuntutan di Tribunal Tuntutan Pengguna Malaysia.",
      },
      {
        key: "contact",
        title: "Hubungi",
        body: "BNPL17, gp17bnplqm@gmail.com. Terma ini juga tersedia dalam Bahasa Inggeris di fypbnplquma.tech/info/terms. Jika terdapat perbezaan, versi Bahasa Inggeris terpakai.",
      },
    ],
  },
  {
    key: "privacy-ms",
    title: "Dasar Privasi",
    audience: "PLATFORM",
    sections: [
      {
        key: "who-we-are",
        title: "Siapa kami",
        body: [
          "Dasar Privasi ini menerangkan cara BNPL17 mengumpul, menggunakan, berkongsi dan melindungi data peribadi anda apabila anda menggunakan platform BNPL: laman web di fypbnplquma.tech dan aplikasi Android BNPL. Ini ialah notis bertulis kami di bawah Akta Perlindungan Data Peribadi 2010 (PDPA).",
          "",
          "Platform ini dikendalikan oleh BNPL17. BNPL17 menerbitkan aplikasi di Google Play di bawah nama pembangun grp17FYP. Kami ialah pengawal data bagi data peribadi yang diterangkan di sini. Hubungi kami di gp17bnplqm@gmail.com untuk sebarang soalan, permintaan atau aduan berkaitan privasi.",
          "",
          "Kereta, lawatan dan perkhidmatan pemandu disediakan oleh pengendali bebas: syarikat sewa kereta, pemandu pelancong dan pemandu. Setiap pengendali bertanggungjawab atas data peribadi yang disimpannya tentang anda bagi sewaan atau perkhidmatannya sendiri.",
        ].join("\n"),
      },
      {
        key: "what-we-collect",
        title: "Data yang kami kumpul",
        body: [
          "Yang anda berikan kepada kami:",
          "- Butiran akaun: nama, alamat e-mel, kata laluan dan, jika anda pilih, nombor telefon dan gambar profil.",
          "- Butiran tempahan: kereta, lawatan atau perkhidmatan pemandu, tarikh dan masa, tempat ambil dan pulang, nama dan nombor telefon pemandu, tambahan serta sebarang nota anda kepada pengendali.",
          "- Lesen memandu: gambar atau fail lesen pemandu, dan permit memandu antarabangsa jika lesen dikeluarkan di luar Malaysia. Dokumen ini mungkin menunjukkan gambar anda, nombor lesen, nombor kad pengenalan atau pasport, tarikh lahir dan alamat. Sesetengah pengendali juga meminta tarikh lahir untuk menyemak umur minimum pemandu.",
          "- Resit pembayaran: resit DuitNow yang anda muat naik, bersama jumlah dan tarikh.",
          "- Mesej: apa yang anda taip kepada pembantu sembang atau pasukan sokongan kami, dan alamat e-mel yang anda berikan jika anda bersembang tanpa log masuk.",
          "- Permintaan: permintaan memadam akaun, rayuan rekod kredit dan permintaan sokongan lain.",
          "",
          "Yang kami cipta atau rekod:",
          "- Rekod pembayaran: jumlah, tarikh, kaedah pembayaran, status, bayaran balik dan invois. Nombor kad dimasukkan di halaman Stripe dan tidak pernah sampai ke pelayan kami.",
          "- Sejarah tempahan: peristiwa seperti terlepas tarikh akhir baki, lesen tidak dimuat naik tepat pada masanya, tidak hadir atau pembatalan. Ini disimpan sebagai rekod sahaja. Ia tidak mengubah deposit anda atau apa yang boleh anda tempah.",
          "- Rekod persetujuan: bila anda menerima Dasar Privasi ini dan Terma Perkhidmatan, serta alamat IP semasa anda menerimanya.",
          "- Rekod keselamatan dan penggunaan: masa log masuk, kod laluan sekali guna (disimpan dalam bentuk bercelaru), log audit perubahan akaun bersama alamat IP, dan laporan ralat.",
          "- Penggunaan produk: peristiwa seperti carian, kereta yang dilihat atau tempahan yang dibuat, direkod dengan nombor rujukan dan kiraan sahaja.",
          "- Tetapan anda: pilihan pemberitahuan dan kereta yang disimpan.",
          "",
          "Kebenaran peranti: aplikasi hanya meminta akses kamera atau galeri foto apabila anda memilih untuk memuat naik gambar profil, lesen, permit atau resit. Kami tidak mengumpul lokasi, kenalan atau senarai aplikasi di telefon anda.",
          "",
          "Wajib atau pilihan: nama, alamat e-mel, kata laluan, butiran tempahan, lesen pemandu dan butiran pembayaran diperlukan untuk membuat tempahan. Tanpanya kami tidak dapat menerima atau melengkapkan tempahan. Nombor telefon (kecuali diperlukan oleh pengendali), gambar profil, kereta yang disimpan dan e-mel promosi adalah pilihan.",
          "",
          "Sumber data: hampir semua data datang daripada anda. Keputusan pembayaran datang daripada Stripe. Semakan lesen dan keputusan tempahan datang daripada pengendali.",
          "",
          "Data sensitif: kami tidak meminta data kesihatan, agama, politik, jenayah atau biometrik. Gambar pada lesen anda hanya digunakan supaya pengendali boleh melihatnya, bukan untuk pemadanan wajah.",
        ].join("\n"),
      },
      {
        key: "why-we-use-it",
        title: "Cara kami menggunakannya",
        body: [
          "- Untuk membuka dan mengurus akaun anda serta memastikannya selamat.",
          "- Untuk menghantar permintaan tempahan anda kepada pengendali dan menguruskannya sehingga kereta dipulangkan.",
          "- Untuk mengira harga, menerima bayaran, memproses bayaran balik dan mengeluarkan invois.",
          "- Supaya pengendali boleh menyemak lesen pemandu dan menyerahkan kereta atau memulakan perkhidmatan.",
          "- Untuk menghantar e-mel dan pemberitahuan dalam aplikasi berkaitan tempahan, pembayaran dan akaun.",
          "- Untuk menjawab soalan anda melalui pembantu sembang dan pasukan sokongan.",
          "- Untuk mengesan dan membetulkan ralat, mencegah penipuan dan salah guna, serta menyimpan rekod yang dikehendaki undang-undang.",
          "- Untuk memahami cara platform digunakan dan menambah baiknya, menggunakan kiraan dan nombor rujukan, bukan nama atau butiran hubungan anda.",
          "- Untuk menghantar promosi, hanya jika anda menghidupkannya dalam tetapan pemberitahuan.",
          "",
          "Kami tidak menjual data peribadi anda. Kami tidak menggunakannya untuk pengiklanan oleh syarikat lain.",
        ].join("\n"),
      },
      {
        key: "chat-assistant",
        title: "Pembantu sembang",
        body: [
          "Pembantu sembang menjawab sesetengah soalan dengan jawapan tetap. Soalan lain dijawab oleh model AI daripada OpenAI, Google (Gemini) atau Mistral. Apabila AI menjawab, mesej anda, perbualan setakat ini dan data platform yang diperlukan untuk jawapan itu dihantar kepada penyedia tersebut. Ini boleh termasuk rujukan tempahan, tarikh, kereta dan status tempahan anda. Lesen memandu, permit dan resit anda tidak pernah dihantar kepada penyedia AI.",
          "",
          "AI hanya boleh mencari maklumat; ia tidak boleh membuat, mengubah atau membatalkan tempahan. Jawapannya disemak sebelum anda melihatnya, tetapi mungkin masih salah. Halaman tempahan anda, pengendali dan pasukan sokongan kami mempunyai kata putus. Jangan taip nombor kad, kata laluan atau nombor pengenalan dalam sembang. Perbualan disimpan supaya pasukan sokongan kami boleh membuat susulan.",
        ].join("\n"),
      },
      {
        key: "who-can-see-it",
        title: "Dengan siapa kami berkongsi",
        body: [
          "- Pengendali tempahan anda melihat nama, nombor telefon, alamat e-mel, butiran pemandu, lesen dan permit, resit serta butiran tempahan anda bagi tempahan itu sahaja. Pengendali tidak pernah melihat pelanggan pengendali lain.",
          "- Stripe, untuk pembayaran kad dan bayaran balik kad.",
          "- Resend, untuk e-mel.",
          "- OpenAI, Google dan Mistral, untuk jawapan sembang AI, seperti yang diterangkan di atas.",
          "- Sentry, untuk laporan ralat. Ia ditetapkan supaya tidak mengumpul data peribadi secara lalai.",
          "- Hostinger, untuk pelayan yang menjalankan platform, pangkalan data dan fail yang dimuat naik.",
          "- Pihak berkuasa, apabila dikehendaki undang-undang, contohnya perintah mahkamah atau permintaan polis atau pengawal selia.",
          "- Pemilik baharu, jika platform dipindahkan, di bawah perlindungan yang sama seperti yang diterangkan di sini.",
          "",
          "Penyedia perkhidmatan menggunakan data anda hanya untuk menjalankan bahagian platform mereka bagi pihak kami.",
        ].join("\n"),
      },
      {
        key: "transfers",
        title: "Pemindahan ke luar Malaysia",
        body: "Sesetengah penyedia perkhidmatan kami menyimpan atau memproses data di luar Malaysia, termasuk di Amerika Syarikat dan Kesatuan Eropah. Kami menggunakan penyedia yang melindungi data peribadi pada tahap sekurang-kurangnya setara dengan PDPA. Pelayan, pangkalan data dan fail yang dimuat naik milik kami sendiri terletak di Kuala Lumpur, Malaysia.",
      },
      {
        key: "security",
        title: "Cara kami melindunginya",
        body: [
          "- Kata laluan dan kod laluan sekali guna disimpan hanya dalam bentuk bercelaru yang tidak dapat kami baca.",
          "- Semua trafik antara peranti anda dan platform disulitkan (HTTPS).",
          "- Lesen, permit dan resit disimpan secara peribadi. Ia hanya boleh dibuka melalui pautan yang tamat tempoh selepas masa yang singkat, dan hanya untuk pengendali tempahan itu dan pentadbir kami.",
          "- Setiap pengendali hanya boleh melihat tempahan dan pelanggannya sendiri.",
          "- Token log masuk dalam aplikasi disimpan dalam storan selamat telefon anda.",
          "- Perubahan oleh pentadbir dan perubahan tetapan direkod bersama siapa yang membuatnya dan bila.",
          "- Percubaan log masuk atau permintaan yang berulang dihadkan untuk menyekat serangan.",
          "",
          "Tiada sistem yang selamat sepenuhnya. Jika pelanggaran data peribadi mungkin menyebabkan kemudaratan yang ketara kepada anda, kami akan memaklumkan anda dan Pesuruhjaya Perlindungan Data Peribadi seperti yang dikehendaki PDPA.",
        ].join("\n"),
      },
      {
        key: "retention",
        title: "Tempoh kami menyimpannya",
        body: [
          "- Akaun anda: selagi akaun dibuka. Apabila anda meminta akaun dipadam, kami berusaha menyelesaikannya dalam tempoh 30 hari. Fail lesen dan permit, rekod sejarah tempahan, kereta yang disimpan, pemberitahuan, perbualan sembang, permintaan sokongan dan data log masuk anda dipadam, dan alamat e-mel, nombor telefon serta gambar profil anda dibuang.",
          "- Rekod tempahan, pembayaran, bayaran balik dan invois: disimpan selepas pemadaman selama 7 tahun kerana dikehendaki undang-undang cukai dan perakaunan Malaysia. Nama anda kekal pada rekod tersebut kerana invois dan resit memaparkannya, dan resit DuitNow kekal bersama bayaran yang berkaitan.",
          "- Log keselamatan dan audit: disimpan selama 2 tahun, kemudian dipadam.",
          "- Perbualan sembang: disimpan selama 12 bulan selepas mesej terakhir, kemudian dipadam.",
        ].join("\n"),
      },
      {
        key: "your-rights",
        title: "Hak anda",
        body: [
          "Di bawah PDPA anda boleh:",
          "- Melihat data peribadi yang kami simpan tentang anda dan mendapatkan salinannya.",
          "- Membetulkan data yang salah, tidak lengkap atau lapuk. Anda boleh menukar nama, nombor telefon dan gambar profil sendiri di Profil.",
          "- Menarik balik persetujuan bagi apa-apa yang bersifat pilihan, seperti e-mel promosi, dalam tetapan pemberitahuan atau dengan menghantar e-mel kepada kami.",
          "- Menghentikan pemasaran langsung pada bila-bila masa.",
          "- Meminta kami menghantar data anda kepada anda atau organisasi lain dalam format biasa, setakat yang dibenarkan PDPA.",
          "- Memadam akaun anda melalui Profil > Padam akaun dalam aplikasi, atau di fypbnplquma.tech/info/delete-account. Kami boleh memadamnya setelah tempahan anda selesai dan tiada bayaran balik yang masih belum selesai.",
          "- Membuat aduan kepada kami, dan jika tidak berpuas hati, kepada Pesuruhjaya Perlindungan Data Peribadi Malaysia.",
          "",
          "Untuk menggunakan mana-mana hak ini, hantar e-mel ke gp17bnplqm@gmail.com daripada alamat akaun anda. Kami akan membalas dalam tempoh 21 hari. Kami mungkin meminta anda mengesahkan identiti anda terlebih dahulu.",
        ].join("\n"),
      },
      {
        key: "age",
        title: "Umur",
        body: "Anda mesti berumur sekurang-kurangnya 18 tahun untuk membuka akaun. Kami tidak dengan sengaja mengumpul data daripada sesiapa yang berumur bawah 18 tahun. Jika kami mendapati kami telah berbuat demikian, kami akan memadamnya.",
      },
      {
        key: "changes",
        title: "Perubahan pada dasar ini",
        body: "Kami akan menyiarkan sebarang perubahan di sini dan mengemas kini tarikh di bahagian atas. Jika perubahan menjejaskan cara kami menggunakan data yang telah anda berikan, kami akan memaklumkan anda melalui e-mel atau dalam aplikasi sebelum ia berkuat kuasa, dan meminta persetujuan anda semula jika dikehendaki undang-undang.",
      },
      {
        key: "language",
        title: "Bahasa",
        body: "Dasar ini tersedia dalam Bahasa Malaysia dan dalam Bahasa Inggeris di fypbnplquma.tech/info/privacy. Jika terdapat perbezaan, versi Bahasa Inggeris terpakai.",
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
    body: "Every car booking needs the driver's valid driving licence, uploaded after the operator accepts and by the same deadline as the balance. You can attach a licence already on your account if it names the driver and is still valid on your return date; the operator still checks it. If it was issued outside Malaysia, upload an international driving permit with it. Staff check the original at pickup.",
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
  { position: 1, provider: "OPENAI", modelName: "gpt-6-luna", displayName: "GPT-6 Luna", priceInput: "0.10", priceOutput: "0.50" },
  // Added 4 Nov 2026. The Free plan includes a monthly API allowance; turn off
  // training on your data under API → Privacy. Paid prices, for cost
  // estimates only; check them on Mistral's pricing page before the pilot.
  { position: 2, provider: "MISTRAL", modelName: "mistral-small-latest", displayName: "Mistral Small", priceInput: "0.10", priceOutput: "0.30" },
  // Gemini 3.5 Flash-Lite replaced Gemini 3.8 Flash (6 Nov 2026), which timed
  // out at 20 seconds on the free plan even for a one-word reply.
  { position: 3, provider: "GOOGLE", modelName: "gemini-3.5-flash-lite", displayName: "Gemini 3.5 Flash-Lite", priceInput: "0.30", priceOutput: "2.50" },
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
