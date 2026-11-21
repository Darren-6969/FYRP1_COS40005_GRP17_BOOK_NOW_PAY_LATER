import { Link } from "react-router-dom";
import {
  ArrowRight,
  Banknote,
  BookOpen,
  IdCard,
  Info,
  LifeBuoy,
  MessageCircle,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";

import { INFO_PAGES } from "../../constants/infoPages";
import styles from "../../assets/styles/public/HelpTiles.module.css";

// The help pages as tiles, plus a "still stuck" strip. Used on the public
// Help page (/info) and on the customer account's Help and support tab, so
// there is one place for help, not two.

const ICONS = {
  "how-it-works": LifeBuoy,
  "deposits-and-balances": Banknote,
  "licence-and-permit": IdCard,
  "refund-rules": RotateCcw,
  terms: BookOpen,
  privacy: ShieldCheck,
  about: Info,
};

export default function HelpTiles() {
  const pages = Object.entries(INFO_PAGES).filter(([slug]) => slug !== "contact");

  return (
    <div className={styles.wrap}>
      <ul className={styles.grid}>
        {pages.map(([slug, page]) => {
          const Icon = ICONS[slug] || BookOpen;
          return (
            <li key={slug}>
              <Link to={`/info/${slug}`} className={styles.tile}>
                <Icon size={22} aria-hidden="true" className={styles.icon} />
                <span className={styles.tileTitle}>{page.nav}</span>
                <span className={styles.tileText}>{page.summary}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className={styles.contact}>
        <div>
          <p className={styles.contactTitle}>Still need help?</p>
          <p className={styles.contactText}>
            Ask the assistant for a quick answer, or contact us about a booking, a payment or your data.
          </p>
        </div>
        <div className={styles.contactActions}>
          <Link to="/assistant" className={styles.secondary}>
            <MessageCircle size={16} aria-hidden="true" />
            Ask the assistant
          </Link>
          <Link to="/info/contact" className={styles.primary}>
            Contact us
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
