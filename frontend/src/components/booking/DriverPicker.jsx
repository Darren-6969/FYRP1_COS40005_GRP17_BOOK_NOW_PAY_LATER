import { Languages, MapPin, ShieldCheck, UserRound } from "lucide-react";
import { formatSen } from "../../utils/formatPublic";
import styles from "../../assets/styles/public/DriverPicker.module.css";

// A list of independent drivers to choose one from, each with the server's
// price for this job. Used on the car booking form and on the customer's
// car booking page. Choosing the selected driver again clears the choice.
export default function DriverPicker({ drivers = [], selectedId = null, onSelect, name = "driver" }) {
  if (!drivers.length) return null;
  return (
    <div className={styles.list} role="radiogroup" aria-label="Independent drivers">
      {drivers.map((driver) => {
        const on = String(selectedId) === String(driver.id);
        const quote = driver.quote;
        return (
          <label key={driver.id} className={`${styles.card} ${on ? styles.cardOn : ""}`}>
            <input
              type="radio"
              className={styles.radio}
              name={name}
              value={driver.id}
              checked={on}
              onChange={() => onSelect?.(driver)}
              onClick={() => on && onSelect?.(null)}
            />
            <span className={styles.photo} aria-hidden="true">
              {driver.photoUrl ? <img src={driver.photoUrl} alt="" /> : <UserRound size={26} />}
            </span>
            <span className={styles.body}>
              <span className={styles.nameRow}>
                <strong>{driver.name}</strong>
                {driver.licensed && (
                  <span className={styles.badge}>
                    <ShieldCheck size={14} aria-hidden="true" /> Licence checked
                  </span>
                )}
              </span>
              <span className={styles.meta}>
                <Languages size={14} aria-hidden="true" />
                {driver.languages.join(", ") || "Languages not listed"}
              </span>
              <span className={styles.meta}>
                <MapPin size={14} aria-hidden="true" />
                {driver.serviceAreas.join(", ")}
                {driver.yearsDriving != null ? ` · ${driver.yearsDriving} years driving` : ""}
              </span>
            </span>
            <span className={styles.price}>
              {quote ? (
                <>
                  <strong>{formatSen(quote.totalSen)}</strong>
                  <small>{formatSen(quote.depositSen)} deposit</small>
                </>
              ) : (
                <>
                  <strong>{formatSen(driver.hourlySen)}/hour</strong>
                  <small>{formatSen(driver.dailySen)}/day</small>
                </>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}
