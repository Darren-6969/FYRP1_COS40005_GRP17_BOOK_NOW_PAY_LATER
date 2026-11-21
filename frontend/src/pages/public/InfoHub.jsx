import { useEffect } from "react";

import { BRAND } from "../../constants/brand";
import HelpTiles from "../../components/public/HelpTiles";
import styles from "../../assets/styles/public/InfoPage.module.css";

// Help (/info): every help and policy page in one place. Linked from the
// header ("Help"), the footer and the customer Help and support tab.
export default function InfoHub() {
  useEffect(() => {
    document.title = `Help · ${BRAND.name}${BRAND.suffix}`;
  }, []);

  return (
    <div className={styles.hub}>
      <h1 className={styles.title}>Help</h1>
      <p className={styles.lead}>
        How booking, paying and pickup work, and the rules that apply to your rental.
      </p>
      <HelpTiles />
    </div>
  );
}
