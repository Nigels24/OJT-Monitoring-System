"use client";

import { LucideIcon } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface TrendSeries {
  key: string;
  label: string;
  color: string;
}

interface TrendChartProps {
  title: string;
  icon: LucideIcon;
  data: Record<string, string | number>[];
  series: TrendSeries[];
}

export default function TrendChart({
  title,
  icon: Icon,
  data,
  series,
}: TrendChartProps) {
  return (
    <div className="bg-white rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={18} className="text-gray-500" />
        <h3 className="font-semibold text-gray-800">{title}</h3>
      </div>
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip />
            <Legend
              iconType="plainline"
              wrapperStyle={{ fontSize: 13, paddingTop: 12 }}
            />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2.5}
                dot={{ r: 3, fill: s.color }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
