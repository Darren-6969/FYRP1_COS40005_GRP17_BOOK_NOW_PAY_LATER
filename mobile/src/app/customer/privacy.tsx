import { LegalScreen, type LegalSection } from "@/components/LegalScreen";

// The wording is unchanged from the previous screen; only the layout moved to LegalScreen.
const SECTIONS: LegalSection[] = [
  {
    title: "Information We Collect",
    body: "We may collect information provided through your account and booking activities, including your name, email address, phone number, profile image, booking information, payment status, receipt information, and account preferences.",
  },
  {
    title: "Account Information",
    body: "Account information is used to identify your customer account, support authentication, display your profile, and associate bookings and payments with the correct customer.",
  },
  {
    title: "Booking Information",
    body: "Booking information may include vehicle details, booking dates, pickup and return information, contact details, driver information, booking status, and operator information required to process your rental request.",
  },
  {
    title: "Payment Information",
    body: "The platform stores information related to payment status, payment type, payment amount, payment deadlines, and transaction-related records required to manage the booking payment process.",
  },
  {
    title: "Payment Processing",
    body: "Online payment processing may be handled through third-party payment service providers. The BNPL platform uses payment results and transaction information required to update the booking and payment status.",
  },
  {
    title: "Manual Payment Receipts",
    body: "When you upload a manual payment receipt, the receipt image and related payment information may be stored so that the operator can review and verify the payment.",
  },
  {
    title: "Invoices",
    body: "Invoice information may be generated and stored based on booking and payment records. This information may include invoice numbers, booking references, amounts, dates, payment status, and operator information.",
  },
  {
    title: "How We Use Information",
    body: "Information may be used to provide account services, process booking requests, manage booking status, support payments, verify receipts, generate invoices, send notifications, and provide customer support.",
  },
  {
    title: "Operator Access",
    body: "Relevant booking and payment information may be available to the operator responsible for processing your booking. Operators use this information to review booking requests, manage rentals, verify payments, and provide related services.",
  },
  {
    title: "Notifications",
    body: "The platform may use your account and booking information to provide booking updates, payment reminders, invoice notifications, receipt updates, and optional promotional notifications according to your selected preferences.",
  },
  {
    title: "Profile Information",
    body: "Customers may update supported profile information such as their name, phone number, and profile image. Some account information, such as the registered email address, may remain restricted to maintain record consistency.",
  },
  {
    title: "Authentication and Security",
    body: "Authentication information is used to protect access to your account. Customers should keep their password secure and avoid sharing account credentials with unauthorized persons.",
  },
  {
    title: "Data Storage",
    body: "Platform information may be stored in databases and supporting services used by the BNPL system. Reasonable measures should be used to protect stored information from unauthorized access or misuse.",
  },
  {
    title: "Third-Party Services",
    body: "The platform may rely on third-party services for functions such as payment processing, hosting, email delivery, storage, and other technical services required to operate the application.",
  },
  {
    title: "Data Sharing",
    body: "Customer information should only be shared when required to provide booking, payment, operator, technical, or legal services. Customer information should not be disclosed unnecessarily.",
  },
  {
    title: "Data Retention",
    body: "Information may be retained for as long as reasonably necessary to support booking records, payment records, invoice records, account services, operational requirements, and other legitimate platform purposes.",
  },
  {
    title: "Customer Choices",
    body: "Customers can manage supported account information and notification preferences through the Profile section of the mobile application. Customers can also ask for their account and the personal data linked to it to be deleted, through Delete account in the Profile section or at fypbnplquma.tech/info/delete-account. Booking, payment and invoice records are kept for as long as Malaysian law requires.",
  },
  {
    title: "Policy Updates",
    body: "This Privacy Policy may be updated when platform functionality, data handling practices, services, or operational requirements change.",
  },
];

export default function PrivacyScreen() {
  return (
    <LegalScreen
      title="Privacy Policy"
      icon="shield-checkmark-outline"
      intro={"This policy explains how information is collected, used, stored, and handled when you use the BNPL platform."}
      notice={"The BNPL platform uses customer information to support account management, bookings, payments, receipts, invoices, notifications, and related services."}
      footerTitle={"Privacy Questions"}
      footerText={"If you have questions about your information or account, use Help & Support from your Profile page."}
      updated={"Last updated: November 2026"}
      sections={SECTIONS}
    />
  );
}
