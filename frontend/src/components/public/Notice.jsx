import styles from "../../assets/styles/public/Notice.module.css";

// Inline message for the public pages.
// tone: "warn" (amber), "info" (blue), "error" (red), "ok" (green).
// Pass role="alert" for errors that appear in response to an action.
export default function Notice({ tone = "info", title, children, action, role, id, className = "" }) {
  return (
    <div id={id} role={role} className={`${styles.notice} ${styles[tone]} ${className}`}>
      <div className={styles.body}>
        {title && <p className={styles.title}>{title}</p>}
        {children && <div className={styles.text}>{children}</div>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
