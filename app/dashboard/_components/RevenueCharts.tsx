"use client";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  Legend,
  LineChart,
  Line,
} from "recharts";

const ACCENT_COLORS = [
  "#22C55E", "#3B82F6", "#A855F7", "#F97316",
  "#F59E0B", "#EC4899", "#5BA37C", "#5A8FCC",
  "#D98C5A", "#8E76D6",
];

function fmtCompact(n: number): string {
  if (n === 0) return "$0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

interface BarChartData {
  name: string;
  fullName?: string;
  value: number;
}

export function HorizontalBarChart({
  data,
  title,
  subtitle,
  color = "#3B82F6",
}: {
  data: BarChartData[];
  title: string;
  subtitle?: string;
  color?: string;
}) {
  const display = data.map((d) => ({
    ...d,
    fullName: d.name,
    name: d.name.length > 22 ? d.name.slice(0, 22) + "…" : d.name,
  }));

  return (
    <div className="card p-4 h-[380px] flex flex-col">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-ink-primary">{title}</h3>
        {subtitle && <p className="text-[11px] text-ink-tertiary mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex-1 min-h-0">
        {display.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={display}
              layout="vertical"
              margin={{ top: 0, right: 30, bottom: 0, left: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#E2E8F0"
                horizontal={false}
              />
              <XAxis
                type="number"
                tickFormatter={fmtCompact}
                tick={{ fontSize: 10, fill: "#94A3B8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                dataKey="name"
                type="category"
                width={160}
                tick={{ fontSize: 11, fill: "#475569" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value: number) => [fmtCompact(value), "Revenue"]}
                labelFormatter={(label, items: any[]) =>
                  items?.[0]?.payload?.fullName || label
                }
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid #E2E8F0",
                }}
              />
              <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export function DonutChart({
  data,
  title,
  subtitle,
}: {
  data: BarChartData[];
  title: string;
  subtitle?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="card p-4 h-[380px] flex flex-col">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-ink-primary">{title}</h3>
        {subtitle && (
          <p className="text-[11px] text-ink-tertiary mt-0.5">{subtitle}</p>
        )}
      </div>
      <div className="flex-1 min-h-0">
        {data.length === 0 || total === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="45%"
                innerRadius="50%"
                outerRadius="75%"
                paddingAngle={2}
                dataKey="value"
                label={(entry: any) =>
                  `${((entry.value / total) * 100).toFixed(0)}%`
                }
                labelLine={false}
                fontSize={11}
              >
                {data.map((_, i) => (
                  <Cell
                    key={i}
                    fill={ACCENT_COLORS[i % ACCENT_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => fmtCompact(value)}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid #E2E8F0",
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                wrapperStyle={{ fontSize: 11 }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export function MonthlyTrendLine({
  data,
  title,
  subtitle,
  color = "#22C55E",
}: {
  data: { month: string; value: number }[];
  title: string;
  subtitle?: string;
  color?: string;
}) {
  return (
    <div className="card p-4 h-[380px] flex flex-col">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-ink-primary">{title}</h3>
        {subtitle && (
          <p className="text-[11px] text-ink-tertiary mt-0.5">{subtitle}</p>
        )}
      </div>
      <div className="flex-1 min-h-0">
        {data.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 10, right: 30, bottom: 0, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: "#94A3B8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={fmtCompact}
                tick={{ fontSize: 10, fill: "#94A3B8" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value: number) => [fmtCompact(value), "Revenue"]}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid #E2E8F0",
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                dot={{ r: 3, fill: color }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-full w-full flex items-center justify-center text-xs text-ink-tertiary">
      No data
    </div>
  );
}
