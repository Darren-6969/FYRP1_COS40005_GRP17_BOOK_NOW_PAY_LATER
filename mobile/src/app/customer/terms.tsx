import { LegalScreen, type LegalSection } from "@/components/LegalScreen";

// The wording is unchanged from the previous screen; only the layout moved to LegalScreen.
const SECTIONS: LegalSection[] = [
  {
    title: "Acceptance of Terms",
    body: "By accessing or using the BNPL platform, you agree to comply with these Terms & Conditions and any applicable booking or rental requirements provided by the operator.",
  },
  {
    title: "Account Information",
    body: "Customers are responsible for providing accurate account information, including their name, email address, phone number, and other information required for booking and payment processing.",
  },
  {
    title: "Booking Requests",
    body: "A booking request submitted through the BNPL platform is not considered confirmed immediately. The booking remains pending until it is reviewed and accepted by the relevant operator.",
  },
  {
    title: "Booking Approval",
    body: "Operators may accept or reject booking requests based on vehicle availability, booking requirements, customer information, or other operational considerations.",
  },
  {
    title: "Payment Requirements",
    body: "Once a booking is accepted, customers may be required to complete a down payment, final payment, or full payment according to the payment arrangement assigned to the booking.",
  },
  {
    title: "Payment Deadline",
    body: "Customers are responsible for completing required payments within the payment deadline shown in the booking or payment information. Failure to complete payment before the deadline may affect the booking status.",
  },
  {
    title: "Manual Payment Receipts",
    body: "When manual payment is available, customers may upload a payment receipt for verification. Uploaded receipts remain pending until they are reviewed by the operator.",
  },
  {
    title: "Receipt Verification",
    body: "Submission of a receipt does not automatically confirm payment. Payment is considered verified only after the operator reviews and approves the submitted receipt.",
  },
  {
    title: "Payment Information",
    body: "Customers should review the payment amount and payment type before completing a transaction. Payment information displayed in the platform is based on the current booking and payment status.",
  },
  {
    title: "Invoices",
    body: "An invoice may be generated for eligible bookings. Customers can access available invoice information through the booking or payment sections of the platform.",
  },
  {
    title: "Booking Changes",
    body: "Changes to booking dates, vehicles, rental details, or other booking information may require approval from the operator and may affect the payment amount or booking status.",
  },
  {
    title: "Booking Cancellation",
    body: "Booking cancellation may be subject to the operator's cancellation policy, payment status, rental conditions, and other applicable booking requirements.",
  },
  {
    title: "Customer Responsibility",
    body: "Customers are responsible for reviewing their booking information, payment status, deadlines, notifications, and any instructions provided through the platform.",
  },
  {
    title: "Platform Availability",
    body: "The BNPL platform may occasionally be unavailable due to maintenance, technical issues, network conditions, or other circumstances outside normal operation.",
  },
  {
    title: "Security",
    body: "Customers are responsible for protecting their account credentials and should not share their password or authentication information with unauthorized persons.",
  },
  {
    title: "Notifications",
    body: "The platform may provide booking, payment, invoice, receipt, and account-related notifications. Customers can manage supported notification preferences from their profile settings.",
  },
  {
    title: "Operator Services",
    body: "Vehicle rental services are provided by the relevant operator. The BNPL platform supports the booking and payment process but does not replace the rental terms or operational requirements established by the operator.",
  },
  {
    title: "Updates to Terms",
    body: "These Terms & Conditions may be updated when platform features, booking processes, payment services, or operational requirements change.",
  },
];

export default function TermsScreen() {
  return (
    <LegalScreen
      title="Terms and Conditions"
      icon="document-text-outline"
      intro={"Please review the following terms before using the BNPL booking and payment services."}
      notice={"These terms describe the general use of the BNPL platform for booking, payment, receipt verification, and account services."}
      footerTitle={"Need Assistance?"}
      footerText={"If you have questions about these terms, use Help & Support from your Profile page."}
      updated={"Last updated: November 2026"}
      sections={SECTIONS}
    />
  );
}
