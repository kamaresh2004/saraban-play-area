import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { money } from "../../lib/format";
import type { WeekPoint } from "../../lib/types";

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const visits = payload.find((item: any) => item.dataKey === "visits")?.value ?? 0;
  const collection =
    payload.find((item: any) => item.dataKey === "collection")?.value ?? 0;

  return (
    <div className="rounded-xl border border-ink/10 bg-white px-3 py-2.5 shadow-lift">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
        {label}
      </p>
      <p className="mt-1 text-[12px] font-semibold text-ink">{visits} visits</p>
      <p className="tabular text-[12px] text-primary-700">{money(collection)}</p>
    </div>
  );
}

export function WeekChart({ data }: { data: WeekPoint[] }) {
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 4, bottom: 0, left: -22 }}>
          <CartesianGrid
            vertical={false}
            strokeDasharray="3 4"
            stroke="rgba(28,32,43,0.08)"
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "#8C95A4", fontWeight: 500 }}
            dy={8}
          />
          <YAxis
            yAxisId="visits"
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "#8C95A4" }}
          />
          <YAxis
            yAxisId="money"
            orientation="right"
            tickLine={false}
            axisLine={false}
            width={52}
            tick={{ fontSize: 11, fill: "#8C95A4" }}
            tickFormatter={(value: number) =>
              value >= 1000 ? `₹${(value / 1000).toFixed(0)}k` : `₹${value}`
            }
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(28,147,160,0.05)" }} />
          <Bar
            yAxisId="visits"
            dataKey="visits"
            fill="#1C93A0"
            radius={[6, 6, 0, 0]}
            barSize={24}
            maxBarSize={30}
          />
          <Line
            yAxisId="money"
            type="monotone"
            dataKey="collection"
            stroke="#FAC442"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "#FAC442", strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "#FAC442", stroke: "#fff", strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
