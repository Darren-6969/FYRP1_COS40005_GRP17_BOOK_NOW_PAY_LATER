import { LegalScreen } from "@/components/LegalScreen";

// The wording comes from the policy library (admin Policies and answers),
// the same text as fypbnplquma.tech/info/privacy, so the app and the website
// can never disagree.
export default function PrivacyScreen() {
  return (
    <LegalScreen
      icon="shield-checkmark-outline"
      copy={{
        en: {
          documentKey: "privacy",
          webPath: "/info/privacy",
          title: "Privacy Policy",
          intro: "How BNPL17 collects, uses, shares and protects your personal data, under Malaysia's Personal Data Protection Act 2010 (PDPA).",
          updatedLabel: "Last updated",
          webLabel: "Open on the website",
        },
        ms: {
          documentKey: "privacy-ms",
          webPath: "/info/privacy-ms",
          title: "Dasar Privasi",
          intro: "Cara BNPL17 mengumpul, menggunakan, berkongsi dan melindungi data peribadi anda, di bawah Akta Perlindungan Data Peribadi 2010 (PDPA).",
          updatedLabel: "Kemas kini terakhir",
          webLabel: "Buka di laman web",
        },
      }}
    />
  );
}
