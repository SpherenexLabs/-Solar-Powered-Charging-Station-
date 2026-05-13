import { useState, useEffect } from "react";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand  = (a, b)    => a + Math.random() * (b - a);

function useLive() {
  const [d, setD] = useState({
    solar: 4.24, battery: 74, voltage: 48.3, current: 88.2, todayKwh: 18.4,
    stations: [
      { id:1, label:"ST-01", status:"charging", power:7.4,  progress:62, type:"DC Fast" },
      { id:2, label:"ST-02", status:"idle",     power:0,    progress:0,  type:"AC"      },
      { id:3, label:"ST-03", status:"charging", power:11.0, progress:40, type:"DC Fast" },
    ],
  });
  useEffect(() => {
    const t = setInterval(() => setD(p => ({
      solar:    clamp(p.solar   + rand(-0.25, 0.30), 0.8, 6.2),
      battery:  clamp(p.battery + rand(-0.20, 0.35), 20, 100),
      voltage:  47.8 + Math.random() * 1.5,
      current:  85   + Math.random() * 10,
      todayKwh: p.todayKwh + 0.004,
      stations: p.stations.map(s => ({
        ...s,
        power:    s.status === "charging" ? clamp(s.power + rand(-0.25, 0.25), 3.5, 22) : 0,
        progress: s.status === "charging" ? Math.min(100, s.progress + 0.07) : s.progress,
      })),
    })), 1100);
    return () => clearInterval(t);
  }, []);
  return d;
}

/* Animated particles that travel along an SVG path */
function Particles({ path, color = "#34d399", count = 4, dur = "2s" }) {
  return Array.from({ length: count }, (_, i) => (
    <circle key={i} r="3.5" fill={color} opacity="0.9">
      <animateMotion
        dur={dur}
        begin={`${-(i / count) * parseFloat(dur)}s`}
        repeatCount="indefinite"
        path={path}
      />
    </circle>
  ));
}

const STY = [80, 158, 236];   /* station y positions */
const STH = 62;               /* station height */

/* Wire paths (panel→battery, battery→each station) */
const P_PANEL = "M130,176 C210,176 270,175 330,175";
const P_ST    = [
  "M450,163 C530,155 590,111 658,111",
  "M450,175 C530,175 590,189 658,189",
  "M450,187 C530,200 590,267 658,267",
];

export default function SolarAnimation() {
  const d         = useLive();
  const totalLoad = d.stations.reduce((a, s) => a + s.power, 0);

  const metrics = [
    { label: "Solar Power", val: `${d.solar.toFixed(2)} kW`,    color: "#fbbf24" },
    { label: "Battery SOC", val: `${Math.round(d.battery)}%`,   color: d.battery > 50 ? "#22c55e" : "#eab308" },
    { label: "DC Voltage",  val: `${d.voltage.toFixed(1)} V`,   color: "#60a5fa" },
    { label: "Current",     val: `${d.current.toFixed(1)} A`,   color: "#a78bfa" },
    { label: "Total Load",  val: `${totalLoad.toFixed(1)} kW`,  color: "#f87171" },
    { label: "Today",       val: `${d.todayKwh.toFixed(1)} kWh`,color: "#34d399" },
  ];

  return (
    <div className="ea-wrap">

      {/* ── Flow Diagram ── */}
      <svg viewBox="0 0 820 320" className="ea-svg" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="ea-sunG" cx="35%" cy="35%">
            <stop offset="0%"   stopColor="#fef3c7" />
            <stop offset="45%"  stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f97316" />
          </radialGradient>
          <filter id="ea-gy" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="ea-gg" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* ───── SUN ───── */}
        <circle cx="90" cy="65" r="56" fill="#fbbf24" opacity="0.07">
          <animate attributeName="r"       values="52;63;52" dur="2.8s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.07;0.15;0.07" dur="2.8s" repeatCount="indefinite" />
        </circle>
        <circle cx="90" cy="65" r="46" fill="#fbbf24" opacity="0.12">
          <animate attributeName="r"       values="43;51;43" dur="2.8s" begin="-0.9s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.12;0.22;0.12" dur="2.8s" begin="-0.9s" repeatCount="indefinite" />
        </circle>

        {/* Rotating rays */}
        <g>
          {Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2;
            return (
              <line key={i}
                x1={90 + Math.cos(a) * 44} y1={65 + Math.sin(a) * 44}
                x2={90 + Math.cos(a) * 63} y2={65 + Math.sin(a) * 63}
                stroke="#fde68a" strokeWidth="2.5" opacity="0.6"
              />
            );
          })}
          <animateTransform attributeName="transform" type="rotate"
            from="0 90 65" to="360 90 65" dur="18s" repeatCount="indefinite" />
        </g>

        <circle cx="90" cy="65" r="38" fill="url(#ea-sunG)" filter="url(#ea-gy)" />
        <text x="90" y="118" textAnchor="middle" fill="#fbbf24" fontSize="12" fontWeight="700">
          {d.solar.toFixed(2)} kW
        </text>
        <text x="90" y="131" textAnchor="middle" fill="#78716c" fontSize="9" letterSpacing="1">SOLAR</text>

        {/* Sun → Panel wire */}
        <line x1="90" y1="105" x2="90" y2="140"
          stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="3 5" opacity="0.4" />

        {/* ───── SOLAR PANEL ───── */}
        <rect x="22" y="140" width="108" height="72" rx="7"
          fill="#071428" stroke="#2563eb" strokeWidth="1.5" />
        {[0, 1, 2].flatMap(col => [0, 1].map(row => (
          <g key={`${col}${row}`}>
            <rect
              x={30 + col * 34} y={148 + row * 31} width="28" height="25" rx="3"
              fill="#1e3a8a" stroke="#3b82f6" strokeWidth="0.5" opacity="0.8"
            />
            {/* shimmer flash on each cell */}
            <rect
              x={30 + col * 34} y={148 + row * 31} width="28" height="25" rx="3"
              fill="#93c5fd" opacity="0"
            >
              <animate attributeName="opacity"
                values="0;0.32;0"
                dur={`${1.8 + col * 0.5 + row * 0.7}s`}
                begin={`${(col * 2 + row) * 0.4}s`}
                repeatCount="indefinite"
              />
            </rect>
          </g>
        )))}
        <text x="76" y="228" textAnchor="middle" fill="#3b82f6" fontSize="9" fontWeight="600" letterSpacing="0.5">SOLAR PANEL</text>

        {/* ───── WIRE: Panel → Battery ───── */}
        <path d={P_PANEL} fill="none" stroke="#1e3a5f" strokeWidth="5" opacity="0.3" />
        <path d={P_PANEL} fill="none" stroke="#34d399" strokeWidth="2.5"
          strokeDasharray="8 15" className="ea-flow" />
        <Particles path={P_PANEL} color="#34d399" count={5} dur="1.8s" />

        {/* ───── BATTERY ───── */}
        <rect x="330" y="140" width="120" height="70" rx="8"
          fill="#071428" stroke="#16a34a" strokeWidth="1.5" />
        {/* terminal nub */}
        <rect x="450" y="159" width="8" height="26" rx="3" fill="#16a34a" opacity="0.5" />
        {/* bg track */}
        <rect x="336" y="146" width="108" height="58" rx="5" fill="#0f1f30" />
        {/* fill level */}
        <rect
          x="336" y="146"
          width={Math.max(2, Math.round(108 * d.battery / 100))}
          height="58" rx="5"
          fill={d.battery > 60 ? "#15803d" : d.battery > 30 ? "#a16207" : "#b91c1c"}
          opacity="0.55"
        >
          <animate attributeName="opacity" values="0.5;0.65;0.5" dur="2s" repeatCount="indefinite" />
        </rect>
        {/* segment dividers */}
        {[1, 2, 3, 4].map(i => (
          <line key={i}
            x1={336 + i * 21.6} y1="146" x2={336 + i * 21.6} y2="204"
            stroke="#071428" strokeWidth="2.5"
          />
        ))}
        <text x="390" y="181" textAnchor="middle" fill="#f0fdf4" fontSize="14" fontWeight="700">
          {Math.round(d.battery)}%
        </text>
        <text x="390" y="196" textAnchor="middle" fill="#fbbf24" fontSize="9" letterSpacing="0.5">
          {d.solar > 0.5 ? "⚡ CHARGING" : "STANDBY"}
        </text>
        <text x="390" y="228" textAnchor="middle" fill="#22c55e" fontSize="9" fontWeight="600" letterSpacing="0.5">
          BATTERY STORAGE
        </text>

        {/* ───── WIRES: Battery → Stations ───── */}
        {P_ST.map((p, i) => {
          const active = d.stations[i].status === "charging";
          return (
            <g key={i}>
              <path d={p} fill="none" stroke="#1e3a5f" strokeWidth="5" opacity="0.25" />
              {active ? (
                <>
                  <path d={p} fill="none" stroke="#34d399" strokeWidth="2"
                    strokeDasharray="8 15" className="ea-flow"
                    style={{ animationDelay: `${i * 0.3}s` }}
                  />
                  <Particles path={p} color="#34d399" count={3} dur={`${1.5 + i * 0.35}s`} />
                </>
              ) : (
                <path d={p} fill="none" stroke="#1d4ed8" strokeWidth="1.5"
                  strokeDasharray="4 8" opacity="0.3" />
              )}
            </g>
          );
        })}

        {/* ───── EV STATIONS ───── */}
        {d.stations.map((s, i) => {
          const sy   = STY[i];
          const lcol = s.status === "charging" ? "#22c55e" : "#3b82f6";
          return (
            <g key={s.id}>
              <rect x="658" y={sy} width="100" height={STH} rx="8"
                fill="#071428" stroke={lcol} strokeWidth="1.5" />
              {/* top color bar */}
              <rect x="658" y={sy} width="100" height="6" rx="3" fill={lcol} opacity="0.85" />
              {/* screen */}
              <rect x="670" y={sy + 12} width="64" height="30" rx="4"
                fill={s.status === "charging" ? "#0c2044" : "#0c1120"}
                stroke={s.status === "charging" ? "#1d4ed8" : "#1e293b"}
                strokeWidth="1"
              />
              {s.status === "charging" ? (
                <>
                  <text x="702" y={sy + 24} textAnchor="middle" fill="#7dd3fc" fontSize="9" letterSpacing="0.3">CHARGING</text>
                  <text x="702" y={sy + 37} textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="bold">
                    {s.power.toFixed(1)} kW
                  </text>
                  {/* progress track */}
                  <rect x="670" y={sy + 48} width="64" height="5" rx="2.5" fill="#1e293b" />
                  {/* progress fill */}
                  <rect x="670" y={sy + 48}
                    width={Math.max(2, Math.round(64 * s.progress / 100))}
                    height="5" rx="2.5" fill="#22c55e"
                  >
                    <animate attributeName="opacity" values="0.7;1;0.7" dur="1.4s" repeatCount="indefinite" />
                  </rect>
                  <text x="670" y={sy + 60} fill="#4ade80" fontSize="8">{Math.round(s.progress)}%</text>
                </>
              ) : (
                <>
                  <text x="702" y={sy + 24} textAnchor="middle" fill="#60a5fa" fontSize="10">AVAILABLE</text>
                  <text x="702" y={sy + 36} textAnchor="middle" fill="#475569" fontSize="9">{s.type}</text>
                  <rect x="670" y={sy + 48} width="64" height="5" rx="2.5" fill="#1e293b" />
                </>
              )}
              <text x="702" y={sy + STH + 11} textAnchor="middle" fill="#334155" fontSize="9">{s.label}</text>
            </g>
          );
        })}

        {/* ───── Section headings ───── */}
        <text x="76"  y="22"  textAnchor="middle" fill="#f59e0b" fontSize="11" fontWeight="600">☀ Sun</text>
        <text x="76"  y="137" textAnchor="middle" fill="#60a5fa" fontSize="10" fontWeight="600">Solar Panel</text>
        <text x="390" y="135" textAnchor="middle" fill="#22c55e" fontSize="10" fontWeight="600">Battery Storage</text>
        <text x="708" y="72"  textAnchor="middle" fill="#34d399" fontSize="10" fontWeight="600">EV Stations</text>

        {/* Flow direction arrows on wires */}
        <text x="232" y="170" textAnchor="middle" fill="#34d399" fontSize="10" opacity="0.6">▶</text>
        <text x="560" y="101" textAnchor="middle" fill="#34d399" fontSize="9" opacity="0.5">▶</text>
        <text x="555" y="185" textAnchor="middle" fill="#34d399" fontSize="9" opacity="0.5">▶</text>
        <text x="560" y="255" textAnchor="middle" fill="#34d399" fontSize="9" opacity="0.5">▶</text>
      </svg>

      {/* ── Live Metrics Bar ── */}
      <div className="ea-metrics">
        {metrics.map(m => (
          <div key={m.label} className="ea-metric">
            <span className="ea-mlbl">{m.label}</span>
            <span className="ea-mval" style={{ color: m.color }}>{m.val}</span>
          </div>
        ))}
      </div>

    </div>
  );
}
