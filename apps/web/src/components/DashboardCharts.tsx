import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMinor } from "../lib/money";

const PIE_COLORS = ["#c6f432", "#5ad0ff", "#ff5a4e", "#3ddc97", "#ffb020", "#a78bfa", "#60a5fa", "#f472b6"];

type Daily = { day: string; income: number; expense: number };
type Cat = { name: string; value: number };

export function DailyBars({ data }: { data: Daily[] }) {
  if (!data.length) return <div className="empty">Add transactions to see charts</div>;
  return (
    <ResponsiveContainer>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
        <XAxis dataKey="day" stroke="var(--muted)" />
        <YAxis stroke="var(--muted)" />
        <Tooltip contentStyle={{ background: "var(--panel-solid)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--text)" }} />
        <Bar dataKey="expense" fill="#ff5a4e" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CategoryDonut({ data }: { data: Cat[] }) {
  if (!data.length) return <div className="empty">No expenses this month</div>;
  return (
    <ResponsiveContainer>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: "var(--panel-solid)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--text)" }}
          formatter={(v) => formatMinor(Math.round(Number(v) * 100))}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
