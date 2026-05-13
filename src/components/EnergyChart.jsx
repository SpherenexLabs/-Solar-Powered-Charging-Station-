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

function EnergyChart({ liveData }) {
  const labels = ["Voltage", "Current", "Load", "Battery", "Energy"];

  const values = [
    liveData?.voltage || 0,
    liveData?.current || 0,
    liveData?.load || 0,
    liveData?.battery || 0,
    liveData?.energy || 0
  ];

  const barData = {
    labels,
    datasets: [
      {
        label: "Live Data",
        data: values,
        backgroundColor: [
          "#fbbf24",
          "#22c55e",
          "#3b82f6",
          "#10b981",
          "#f97316"
        ],
        borderRadius: 12
      }
    ]
  };

  const lineData = {
    labels,
    datasets: [
      {
        label: "Performance Trend",
        data: values,
        borderColor: "#10b981",
        backgroundColor: "rgba(16, 185, 129, 0.12)",
        tension: 0.45,
        fill: true
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
        <h3>Energy Usage Overview</h3>
        <Bar data={barData} options={options} />
      </div>

      <div className="new-chart-card">
        <h3>Station Performance Trend</h3>
        <Line data={lineData} options={options} />
      </div>
    </div>
  );
}

export default EnergyChart;