import styles from "../../assets/styles/master/Customers.module.css";

// A customer account's status as text and colour (never colour alone).
export default function CustomerStatusPill({ customer }) {
  const value = customer?.customerStatus;
  const [label, className] =
    value === "DELETED"
      ? ["Deleted", styles.statusDeleted]
      : value === "RESTRICTED"
        ? ["Restricted", styles.statusRestricted]
        : ["Active", styles.statusActive];
  return <span className={`${styles.status} ${className}`}>{label}</span>;
}
