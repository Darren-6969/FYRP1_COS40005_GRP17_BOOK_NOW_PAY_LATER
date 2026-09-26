import { useState } from "react";
import RangeSlider from "./RangeSlider";
import styles from "../../assets/styles/public/FilterPanel.module.css";

function Facet({ facet, selected, onToggle, idPrefix }) {
  const [expanded, setExpanded] = useState(false);
  const truncated = facet.limit && facet.options.length > facet.limit;
  const options = truncated && !expanded ? facet.options.slice(0, facet.limit) : facet.options;

  return (
    <fieldset className={styles.facet}>
      <legend className={styles.facetLabel}>{facet.label}</legend>
      <ul className={styles.options}>
        {options.map((o) => {
          const id = `${idPrefix}-${facet.group}-${o.value}`;
          const on = selected.includes(o.value);
          return (
            <li key={o.value}>
              <label htmlFor={id} className={`${styles.option} ${on ? styles.optionOn : ""}`}>
                <input
                  id={id}
                  type="checkbox"
                  className={styles.checkbox}
                  checked={on}
                  onChange={() => onToggle(facet.group, o.value)}
                />
                <span className={styles.box} aria-hidden="true" />
                <span className={styles.optionLabel}>{o.label}</span>
                <span className={styles.count}>
                  {o.count}
                  <span className={styles.srOnly}> cars</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {truncated && (
        <button type="button" className={styles.more} aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Show fewer" : `Show all ${facet.options.length}`}
        </button>
      )}
    </fieldset>
  );
}

// Filter controls shared by the desktop rail and the mobile sheet.
export default function FilterPanel({ data, criteria, onToggle, onRange, idPrefix }) {
  const { bounds, days, facets } = data;
  const price = bounds.price || { min: 0, max: 0 };
  const deposit = bounds.deposit;
  const top = facets.filter((f) => f.top);
  const more = facets.filter((f) => !f.top);

  const priceRange = (
    <div className={styles.section}>
      <RangeSlider
        label="Price per day"
        min={price.min}
        max={price.max}
        lo={criteria.pmin}
        hi={criteria.pmax}
        disabled={price.min === price.max}
        note="Bounds follow the cars currently matching your other filters."
        format={(lo, hi, any) => (any ? "Any" : `RM${lo} - RM${hi}`)}
        onCommit={(lo, hi) => onRange("price", lo, hi)}
      />
    </div>
  );

  const depositRange = (
    <div className={styles.section}>
      <RangeSlider
        label="Amount payable now"
        min={deposit ? deposit.min : 0}
        max={deposit ? deposit.max : 1}
        lo={deposit ? criteria.dmin : null}
        hi={deposit ? criteria.dmax : null}
        disabled={!days || !deposit || deposit.min === deposit.max}
        note={
          days
            ? "Computed for your selected dates."
            : "Needs dates. Without a date range there is no exact deposit to filter on."
        }
        format={(lo, hi, any) => (!days ? "Set dates" : any ? "Any" : `RM${lo} - RM${hi}`)}
        onCommit={(lo, hi) => onRange("dep", lo, hi)}
      />
    </div>
  );

  return (
    <div className={styles.panel}>
      {priceRange}
      {top.map((f) => (
        <div key={f.group} className={styles.section}>
          <Facet facet={f} selected={criteria.sel[f.group]} onToggle={onToggle} idPrefix={idPrefix} />
        </div>
      ))}
      {depositRange}
      {more.map((f) => (
        <div key={f.group} className={styles.section}>
          <Facet facet={f} selected={criteria.sel[f.group]} onToggle={onToggle} idPrefix={idPrefix} />
        </div>
      ))}
    </div>
  );
}
