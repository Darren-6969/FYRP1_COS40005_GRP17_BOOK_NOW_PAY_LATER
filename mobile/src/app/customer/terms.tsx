import { LegalScreen } from "@/components/LegalScreen";

// The wording comes from the policy library (admin Policies and answers),
// the same text as fypbnplquma.tech/info/terms, so the app and the website
// can never disagree.
export default function TermsScreen() {
  return (
    <LegalScreen
      icon="document-text-outline"
      copy={{
        en: {
          documentKey: "terms",
          webPath: "/info/terms",
          title: "Terms of Service",
          intro: "The agreement between you and BNPL17 when you book cars, tours and driver services on the platform.",
          updatedLabel: "Last updated",
          webLabel: "Open on the website",
        },
        ms: {
          documentKey: "terms-ms",
          webPath: "/info/terms-ms",
          title: "Terma Perkhidmatan",
          intro: "Perjanjian antara anda dan BNPL17 apabila anda menempah kereta, lawatan dan perkhidmatan pemandu di platform ini.",
          updatedLabel: "Kemas kini terakhir",
          webLabel: "Buka di laman web",
        },
      }}
    />
  );
}
