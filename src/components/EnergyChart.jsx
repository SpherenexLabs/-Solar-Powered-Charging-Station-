import { useEffect, useRef, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend
} from "chart.js";

import { Bar, Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend
);

const HISTORY_POINTS = 12;

function EnergyChart({ live }) {
  const labels = ["Voltage (V)", "Current (A)", "Power (W)", "Battery (%)", "Temp (°C)"];

  const values = [
    live?.voltage || 0,
    live?.current || 0,
    live?.power || 0,
    live?.battery || 0,
    live?.temperature || 0
  ];

  /* Rolling power history so the trend line means something */
  const [history, setHistory] = useState([]);
  const latest = useRef({ power: 0, battery: 0 });

  useEffect(() => {
    latest.current = { power: live?.power || 0, battery: live?.battery || 0 };
  }, [live?.power, live?.battery]);

  useEffect(() => {
    const push = () =>
      setHistory((prev) =>
        [
          ...prev,
          {
            t: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            power: latest.current.power,
            battery: latest.current.battery
          }
        ].slice(-HISTORY_POINTS)
      );

    push();
    const timer = setInterval(push, 5000);
    return () => clearInterval(timer);
  }, []);

  const barData = {
    labels,
    datasets: [
      {
        label: "Live Data",
        data: values,
        backgroundColor: ["#fbbf24", "#22c55e", "#3b82f6", "#10b981", "#f97316"],
        borderRadius: 12
      }
    ]
  };

  const lineData = {
    labels: history.map((h) => h.t),
    datasets: [
      {
        label: "Power (W)",
        data: history.map((h) => h.power),
        borderColor: "#10b981",
        backgroundColor: "rgba(16, 185, 129, 0.12)",
        tension: 0.45,
        fill: true
      },
      {
        label: "Battery (%)",
        data: history.map((h) => h.battery),
        borderColor: "#f59e0b",
        backgroundColor: "rgba(245, 158, 11, 0.10)",
        tension: 0.45,
        fill: false
      }
    ]
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        labels: {
          color: "#94a3b8",
          font: { weight: "700", size: 12 },
          boxRadius: 6
        }
      },
      tooltip: {
        backgroundColor: "#0c1a2e",
        borderColor: "rgba(59,130,246,0.25)",
        borderWidth: 1,
        titleColor: "#e2e8f0",
        bodyColor: "#94a3b8"
      }
    },
    scales: {
      x: {
        ticks: { color: "#64748b", font: { size: 12 } },
        grid: { color: "rgba(255,255,255,0.05)" }
      },
      y: {
        ticks: { color: "#64748b", font: { size: 12 } },
        grid: { color: "rgba(255,255,255,0.05)" }
      }
    }
  };

  return (
    <div className="new-chart-grid">
      <div className="new-chart-card">
        <h3>Live Panel Readings</h3>
        <Bar data={barData} options={options} />
      </div>

      <div className="new-chart-card">
        <h3>Power &amp; Battery Trend</h3>
        <Line data={lineData} options={options} />
      </div>
    </div>
  );
}

export default EnergyChart;
