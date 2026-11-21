import { Link } from "react-router-dom";
import { BRAND } from "../../constants/brand";
import styles from "../../assets/styles/public/PublicFooter.module.css";

// Every link here goes to a built page. Help pages live under /info.
const COLUMNS = [
  {
    head: "Book",
    items: [
      { label: "Car rental", to: "/cars" },
      { label: "Saved cars", to: "/customer/saved" },
    ],
  },
  {
    head: "Help",
    // Two columns: how booking works on the left, documents and contact
    // on the right.
    split: true,
    items: [
      { label: "How it works", to: "/info/how-it-works" },
      { label: "Deposits and balances", to: "/info/deposits-and-balances" },
      { label: "Refund rules", to: "/info/refund-rules" },
      { label: "Licence and permit", to: "/info/licence-and-permit" },
      { label: "Contact", to: "/info/contact" },
    ],
  },
  {
    head: "Operators",
    items: [
      { label: "Why list with us", to: "/for-operators" },
      { label: "Apply to list", to: "/operator-register" },
    ],
  },
];

// The small row under the columns, next to the legal line.
const BOTTOM_LINKS = [
  { label: "About", to: "/info/about" },
  { label: "Terms of service", to: "/info/terms" },
  { label: "Privacy and PDPA", to: "/info/privacy" },
];

export default function PublicFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.cols}>
          {COLUMNS.map((col) => (
            <nav
              key={col.head}
              aria-label={col.head}
              className={`${styles.col} ${col.split ? styles.colWide : ""}`}
            >
              <h2 className={styles.head}>{col.head}</h2>
              <ul className={`${styles.list} ${col.split ? styles.listSplit : ""}`}>
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
        <div className={styles.bottom}>
          <p className={styles.legal}>{BRAND.legalLine}</p>
          <nav aria-label="About and policies">
            <ul className={styles.bottomList}>
              {BOTTOM_LINKS.map((item) => (
                <li key={item.label}>
                  <Link to={item.to} className={styles.bottomLink}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
