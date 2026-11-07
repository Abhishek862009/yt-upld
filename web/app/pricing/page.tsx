import Link from "next/link";
import Nav from "@/components/Nav";
import { PLANS } from "@/lib/plans";

export default function Pricing() {
  return (
    <>
      <Nav />
      <div className="wrap">
        <section className="hero" style={{ paddingBottom: 30 }}>
          <h1>Simple <em>pricing</em></h1>
          <p>Start free. Upgrade when you need more videos, 1080p and scheduling.</p>
        </section>
        <section className="grid cols3">
          {Object.values(PLANS).map((p) => (
            <div className="card" key={p.id} style={p.id === "pro" ? { borderColor: "var(--accent)" } : undefined}>
              <h3>{p.name}</h3>
              <div className="price">
                ₹{p.priceInr}
                <small> / month</small>
              </div>
              <ul className="ticks">
                {p.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <Link href="/login" className={`btn ${p.id === "pro" ? "primary" : ""}`} style={{ width: "100%" }}>
                {p.id === "free" ? "Start free" : `Get ${p.name}`}
              </Link>
            </div>
          ))}
        </section>
        <div className="footer">Paid plans are switched on by the site owner for now (see README).</div>
      </div>
    </>
  );
}
