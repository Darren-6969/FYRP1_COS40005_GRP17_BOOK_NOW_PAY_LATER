import { TriangleAlert } from "lucide-react";
import styles from "../../assets/styles/public/RefundBox.module.css";

// What happens to the money on cancellation, stated before anything is paid.
export default function RefundBox({ rule, headingLevel = 2 }) {
  const partial = rule?.type === "PARTIAL";
  const Heading = `h${headingLevel}`;
  return (
    <section className={styles.box} aria-labelledby="refund-h">
      <TriangleAlert size={22} className={styles.icon} aria-hidden="true" />
      <div>
        <div className={styles.head}>
          <Heading id="refund-h" className={styles.title}>
            Refund and cancellation
          </Heading>
          <span className={styles.badge}>
            {partial ? `${rule.refundPct}% of deposit refundable` : "Deposit non-refundable"}
          </span>
        </div>
        <p className={styles.lead}>Nothing is charged if the operator declines or doesn&apos;t respond.</p>
        <p className={styles.text}>
          {partial
            ? `If you cancel at any time, the operator refunds ${rule.refundPct}% of the down payment and keeps the rest. You are not charged the balance if you cancel before it is due.`
            : "If you cancel at any time, the operator keeps the down payment. You are not charged the balance if you cancel before it is due."}
        </p>
      </div>
    </section>
  );
}
