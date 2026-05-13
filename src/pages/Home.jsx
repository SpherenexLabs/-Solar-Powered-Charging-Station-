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
            A complete web-integrated solar charging station — book charging
            slots, pick USB or AC charging, make dummy payments, and watch live
            voltage, current, load, battery and energy data in real-time.
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

          <div className="mini-metrics">
            <div>
              <strong>03</strong>
              <span>Charging Stations</span>
            </div>
            <div>
              <strong>Live</strong>
              <span>Energy Monitoring</span>
            </div>
            <div>
              <strong>100%</strong>
              <span>Firebase Backed</span>
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
          <h3>User Booking</h3>
          <p>
            Select station, charging type, duration and time slot, then complete
            a simulated payment in seconds.
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
            Real-time display of voltage, current, load, battery percentage and
            cumulative energy generation.
          </p>
        </div>

        <div className="service-card orange">
          <div className="service-icon">💳</div>
          <h3>Dummy Payment</h3>
          <p>
            Simulated payment gateway records every transaction with full
            session details in Firebase.
          </p>
        </div>
      </section>
    </main>
  );
}

export default Home;
