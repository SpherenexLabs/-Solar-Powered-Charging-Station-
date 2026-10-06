import { Link } from "react-router-dom";
import SolarAnimation from "../components/SolarAnimation";

function Home() {
  return (
    <main className="home-wrapper">
      {/* ── Hero ── */}
      <section className="new-hero">
        <div className="hero-left">
          <div className="small-badge">⚡ Solar Powered Charging Station</div>

          <h1>
            Charge Devices Using
            <span>Smart Solar Energy</span>
          </h1>

          <p>
            A complete web-integrated solar charging station — book one of four
            AC slots or start a DC fast-charging session, pay by UPI, card, net
            banking or wallet, and watch live voltage, current, power, battery
            and temperature data in real time.
          </p>
{/* 
          <div className="hero-buttons">
            <a href="/user" className="btn-main">
              ⚡ Book Charging Slot
            </a>
            <a href="/admin" className="btn-outline">
              📊 Admin Dashboard
            </a>
          </div> */}

          <div className="hero-buttons">
            <Link to="/stations" className="btn-main">
              📍 Find Charging Station
            </Link>
          </div>

          <div className="mini-metrics">
            <div>
              <strong>04</strong>
              <span>AC Charging Slots</span>
            </div>
            <div>
              <strong>Live</strong>
              <span>Energy Monitoring</span>
            </div>
            <div>
              <strong>24/7</strong>
              <span>DC Fast Charging</span>
            </div>
          </div>
        </div>

        <div className="hero-right">
          <div className="visual-card">
            <SolarAnimation />
          </div>
        </div>
      </section>

      {/* ── Section divider ── */}
      <div className="section-divider" />

      {/* ── Feature cards ── */}
      <div className="services-header">
        <span className="section-label">✦ Platform Features</span>
      </div>

      <section className="service-grid">
        <div className="service-card yellow">
          <div className="service-icon">👤</div>
          <h3>Slot Booking</h3>
          <p>
            Pick Slot 1 to Slot 4, choose the charging type, duration and start
            time, then pay. The slot relay switches on for exactly that time.
          </p>
        </div>

        <div className="service-card green">
          <div className="service-icon">📊</div>
          <h3>Admin Monitoring</h3>
          <p>
            Full visibility into users, transactions, station occupancy and
            live solar energy data.
          </p>
        </div>

        <div className="service-card blue">
          <div className="service-icon">🔋</div>
          <h3>Live Solar Data</h3>
          <p>
            Real-time display of the voltage, current, power, battery percentage
            and temperature reported by the panel hardware.
          </p>
        </div>

        <div className="service-card orange">
          <div className="service-icon">💳</div>
          <h3>Multiple Payment Modes</h3>
          <p>
            Pay by UPI, card, net banking or wallet. Every transaction is
            recorded with its full session details in Firebase.
          </p>
        </div>
      </section>
    </main>
  );
}

export default Home;
