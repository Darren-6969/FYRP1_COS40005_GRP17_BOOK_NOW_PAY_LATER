import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BRAND } from "../../constants/brand";
import { CONTACT, INFO_PAGES, INFO_UPDATED } from "../../constants/infoPages";
import NotAvailable from "./NotAvailable";
import PolicyBody from "../../components/common/PolicyBody";
import { getPublicPolicy } from "../../services/policy_service";
import styles from "../../assets/styles/public/InfoPage.module.css";

// Terms, privacy, refund rules and contact (/info/:slug). The section text of
// terms, privacy and refund rules comes from the policy library, edited on
// the admin Policies and answers page. constants/infoPages.js holds the
// title, lead and navigation, and its sections are the fallback if the
// library cannot be reached. Any other /info slug is "not available yet".
const ORDER = Object.keys(INFO_PAGES);
const LIBRARY_PAGES = new Set(["terms", "privacy", "refund-rules"]);

function formatUpdated(sections) {
  const latest = Math.max(...sections.map((s) => new Date(s.publishedAt).getTime()));
  return new Date(latest).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function ContactDetails() {
  const rows = [
    { label: "Email", value: CONTACT.email, href: CONTACT.email && `mailto:${CONTACT.email}` },
    { label: "Phone", value: CONTACT.phone, href: CONTACT.phone && `tel:${CONTACT.phone.replace(/[^\d+]/g, "")}` },
    {
      label: "WhatsApp",
      value: CONTACT.whatsapp,
      href: CONTACT.whatsapp && `https://wa.me/${CONTACT.whatsapp.replace(/\D/g, "")}`,
    },
    { label: "Hours", value: CONTACT.hours },
  ];
  return (
    <dl className={styles.contact}>
      {rows.map((row) => (
        <div key={row.label} className={styles.contactRow}>
          <dt className={styles.contactLabel}>{row.label}</dt>
          <dd className={styles.contactValue}>
            {!row.value ? (
              <span className={styles.pending}>Being added</span>
            ) : row.href ? (
              <a href={row.href}>{row.value}</a>
            ) : (
              row.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function InfoPage() {
  const { slug } = useParams();
  const page = INFO_PAGES[slug];
  const navRef = useRef(null);
  const fromLibrary = LIBRARY_PAGES.has(slug);
  // { slug, sections } once loaded; sections is null if the library failed.
  const [library, setLibrary] = useState({ slug: null, sections: null });

  useEffect(() => {
    if (!fromLibrary) return undefined;
    let alive = true;
    getPublicPolicy(slug)
      .then(({ data }) => alive && setLibrary({ slug, sections: data.sections?.length ? data.sections : null }))
      .catch(() => alive && setLibrary({ slug, sections: null }));
    return () => {
      alive = false;
    };
  }, [slug, fromLibrary]);

  useEffect(() => {
    if (page) document.title = `${page.title} · ${BRAND.name}${BRAND.suffix}`;
    // On a phone the page links are a sideways-scrolling row; bring the
    // current one into view so it isn't hidden off the right edge.
    navRef.current?.querySelector("[aria-current='page']")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [page]);

  if (!page) return <NotAvailable />;

  const loading = fromLibrary && library.slug !== slug;
  const librarySections = fromLibrary && !loading ? library.sections : null;

  return (
    <div className={styles.page}>
      <nav ref={navRef} className={styles.side} aria-label="Policies and contact">
        <ul className={styles.sideList}>
          {ORDER.map((key) => (
            <li key={key}>
              <Link
                to={`/info/${key}`}
                aria-current={key === slug ? "page" : undefined}
                className={`${styles.sideLink} ${key === slug ? styles.sideLinkCurrent : ""}`}
              >
                {INFO_PAGES[key].nav}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <article className={styles.article} aria-labelledby="info-title">
        <h1 id="info-title" className={styles.title}>
          {page.title}
        </h1>
        <p className={styles.lead}>{page.lead}</p>
        {!loading && (
          <p className={styles.meta}>
            Pilot version, updated {librarySections ? formatUpdated(librarySections) : INFO_UPDATED}
          </p>
        )}

        {page.contact && <ContactDetails />}

        {librarySections
          ? librarySections.map((section) => (
              <section key={section.key} className={styles.section}>
                <h2 className={styles.heading}>{section.title}</h2>
                <PolicyBody body={section.body} paragraphClassName={styles.text} listClassName={styles.list} />
              </section>
            ))
          : !loading &&
            page.sections.map((section) => (
              <section key={section.heading} className={styles.section}>
                <h2 className={styles.heading}>{section.heading}</h2>
                {section.list && (
                  <ul className={styles.list}>
                    {section.list.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
                {section.paragraphs?.map((text) => (
                  <p key={text} className={styles.text}>
                    {text}
                  </p>
                ))}
              </section>
            ))}

        {!page.contact && (
          <p className={styles.footnote}>
            Questions about any of this? <Link to="/info/contact">Contact us</Link> before you send a request or pay.
          </p>
        )}
      </article>
    </div>
  );
}
