import { Link } from "react-router-dom";
import { BRAND } from "../../constants/brand";
import styles from "../../assets/styles/public/PublicFooter.module.css";

// Links without a built page go to /info/<slug>, which renders NotAvailable.
const COLUMNS = [
  {
    head: "Book",
    items: [
      { label: "Car rental", to: "/cars" },
      { label: "Tour packages", to: "/tours" },
      { label: "Pickup locations", to: "/info/pickup-locations" },
      { label: "Saved listings", to: "/info/saved-listings" },
    ],
  },
  {
    head: "Understand",
    items: [
      { label: "How it works", to: { pathname: "/", hash: "#how" } },
      { label: "Deposits and balances", to: "/info/deposits-and-balances" },
      { label: "Refund rules", to: "/info/refund-rules" },
      { label: "Licence verification", to: "/info/licence-verification" },
    ],
  },
  {
    head: "Operators",
    items: [
      { label: "Apply to list", to: "/operator-register" },
      { label: "Allocation explained", to: "/info/allocation" },
      { label: "Commission and payouts", to: "/info/commission-and-payouts" },
      { label: "Operator help", to: "/info/operator-help" },
    ],
  },
  {
    head: "Platform",
    items: [
      { label: "About the pilot", to: "/info/about" },
      { label: "Contact", to: "/info/contact" },
      { label: "Terms of service", to: "/info/terms" },
      { label: "Privacy and PDPA", to: "/info/privacy" },
    ],
  },
];

export default function PublicFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.cols}>
          {COLUMNS.map((col) => (
            <nav key={col.head} aria-label={col.head} className={styles.col}>
              <h2 className={styles.head}>{col.head}</h2>
              <ul className={styles.list}>
                {col.items.map((item) => (
                  <li key={item.label}>
                    <Link to={item.to} className={styles.link}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <p className={styles.legal}>{BRAND.legalLine}</p>
      </div>
    </footer>
  );
}
