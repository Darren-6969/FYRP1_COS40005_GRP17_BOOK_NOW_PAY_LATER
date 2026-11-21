import HelpTiles from "../../components/public/HelpTiles";

// Help and support tab: the same help pages as the public Help page (/info),
// so customers find the same answers wherever they look.
export default function CustomerHelp() {
  return (
    <div className="customer-page">
      <section className="customer-hero-card compact">
        <div>
          <p className="customer-eyebrow">Help and support</p>
          <h1>How can we help?</h1>
          <p>Answers about booking, paying, documents and refunds.</p>
        </div>
      </section>

      <HelpTiles />
    </div>
  );
}
