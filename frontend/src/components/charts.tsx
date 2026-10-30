import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { fmtNumber, fmtTime } from '../lib/format';
import type { ReadingPoint } from '../types';

export function TimeSeriesChart({
  points,
  unit,
  height = 240,
  color = '#159d8a',
  emptyLabel = 'Belum ada data pada rentang ini.',
}: {
  points: ReadingPoint[];
  unit?: string | null;
  height?: number;
  color?: string;
  emptyLabel?: string;
}) {
  const data = points.map((point) => ({
    label: fmtTime(point.ts),
    value: point.value,
  }));

  if (data.length === 0) {
    return <div className="chart-empty small">{emptyLabel}</div>;
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="subakoFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.24} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8ec" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#64748b' }}
            minTickGap={42}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#64748b' }}
            width={52}
            axisLine={false}
            tickLine={false}
            domain={['auto', 'auto']}
          />
          <Tooltip
            formatter={(value) => [
              `${fmtNumber(Number(value), 2)}${unit ? ` ${unit}` : ''}`,
              'Nilai',
            ]}
            labelFormatter={(label) => `${label} WITA`}
            contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8ec' }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            fill="url(#subakoFill)"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
