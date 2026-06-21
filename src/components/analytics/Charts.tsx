'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, BarChart, Bar, Legend, ComposedChart
} from 'recharts'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/formatters'

interface ChartProps {
  data: any[]
  height?: number
}

interface TimeSeriesPoint {
  date: string
  spend?: number
  revenue?: number
  purchase_value?: number
  clicks?: number
  impressions?: number
  conversions?: number
  roas?: number
  cpa?: number
  cpc?: number
  ctr?: number
  cpm?: number
  add_to_cart?: number
  checkout?: number
  leads?: number
  video_p100_watched?: number
}

const COLORS = {
  spend: '#3b82f6',
  revenue: '#10b981',
  roas: '#8b5cf6',
  cpa: '#f59e0b',
  ctr: '#ef4444',
  clicks: '#06b6d4',
  impressions: '#6366f1',
  conversions: '#22c55e',
}

const CustomTooltip = ({ active, payload, label, valueFormat }: any) => {
  if (!active || !payload || !payload.length) return null

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
      <p className="text-slate-400 text-xs mb-2">{label}</p>
      {payload.map((entry: any, index: number) => (
        <p key={index} className="text-sm">
          <span style={{ color: entry.color }} className="font-medium">
            {entry.name}:
          </span>
          <span className="text-white ml-2">
            {valueFormat ? valueFormat(entry.value) : entry.value}
          </span>
        </p>
      ))}
    </div>
  )
}

export function SpendChart({ data, height = 300 }: ChartProps & { height?: number }) {
  const chartData = data.map(d => ({
    date: d.date,
    spend: d.spend || 0,
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.spend} stopOpacity={0.3} />
            <stop offset="95%" stopColor={COLORS.spend} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis
          dataKey="date"
          stroke="#64748b"
          tick={{ fill: '#64748b', fontSize: 11 }}
          tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        />
        <YAxis
          stroke="#64748b"
          tick={{ fill: '#64748b', fontSize: 11 }}
          tickFormatter={(value) => `$${value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}`}
        />
        <Tooltip content={({ active, payload, label }) => (
          <CustomTooltip
            active={active}
            payload={payload}
            label={label ? new Date(label).toLocaleDateString() : ''}
            valueFormat={(v: number) => formatCurrency(v)}
          />
        )} />
        <Area
          type="monotone"
          dataKey="spend"
          stroke={COLORS.spend}
          strokeWidth={2}
          fill="url(#spendGradient)"
          name="Spend"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function RevenueChart({ data, height = 300 }: ChartProps & { height?: number }) {
  const chartData = data.map(d => ({
    date: d.date,
    revenue: d.purchase_value || d.revenue || 0,
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.revenue} stopOpacity={0.3} />
            <stop offset="95%" stopColor={COLORS.revenue} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis
          dataKey="date"
          stroke="#64748b"
          tick={{ fill: '#64748b', fontSize: 11 }}
          tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        />
        <YAxis
          stroke="#64748b"
          tick={{ fill: '#64748b', fontSize: 11 }}
          tickFormatter={(value) => `$${value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}`}
        />
        <Tooltip content={({ active, payload, label }) => (
          <CustomTooltip
            active={active}
            payload={payload}
            label={label ? new Date(label).toLocaleDateString() : ''}
            valueFormat={(v: number) => formatCurrency(v)}
          />
        )} />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke={COLORS.revenue}
          strokeWidth={2}
          fill="url(#revenueGradient)"
          name="Revenue"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function ROASChart({ data, height = 300 }: ChartProps & { height?: number }) {
  const chartData = data.map(d => ({
    date: d.date,
    roas: d.spend > 0 ? ((d.purchase_value || d.revenue || 0) / d.spend) : 0,
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis
          dataKey="date"
          stroke="#64748b"
          tick={{ fill: '#64748b', fontSize: 11 }}
          tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        />
        <YAxis
          stroke="#64748b"
          tick={{ fill: '#64748b', fontSize: 11 }}
          domain={[0, 'auto']}
        />
        <Tooltip content={({ active, payload, label }) => (
          <CustomTooltip
            active={active}
            payload={payload}
            label={label ? new Date(label).toLocaleDateString() : ''}
            valueFormat={(v: number) => `${v.toFixed(2)}x`}
          />
        )} />
        <Line
          type="monotone"
          dataKey="roas"
          stroke={COLORS.roas}
          strokeWidth={2}
          dot={{ fill: COLORS.roas, strokeWidth: 0, r: 3 }}
          activeDot={{ r: 5, fill: COLORS.roas }}
          name="ROAS"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function CPAChart({ data, height = 300 }: ChartProps & { height?: number }) {
  const chartData = data.map(d => ({
    date: d.date,
    cpa: d.conversions > 0 ? (d.spend / d.conversions) : 0,
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis
          dataKey="date"
          stroke="#64748b"
          tick={{ fill: '#64748b', fontSize: 11 }}
          tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        />
        <YAxis
          stroke="#64748b"
          tick={{ fill: '#64748b', fontSize: 11 }}
          tickFormatter={(value) => `$${value >= 100 ? `${(value / 100).toFixed(0)}` : value?.toFixed(0)}`}
        />
        <Tooltip content={({ active, payload, label }) => (
          <CustomTooltip
            active={active}
            payload={payload}
            label={label ? new Date(label).toLocaleDateString() : ''}
            valueFormat={(v: number) => formatCurrency(v)}
          />
        )} />
        <Line
          type="monotone"
          dataKey="cpa"
          stroke={COLORS.cpa}
          strokeWidth={2}
          dot={{ fill: COLORS.cpa, strokeWidth: 0, r: 3 }}
          activeDot={{ r: 5, fill: COLORS.cpa }}
          name="CPA"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function CTRChart({ data, height = 300 }: ChartProps & { height?: number }) {
  const chartData = data.map(d => ({
    date: d.date,
    ctr: d.impressions > 0 ? ((d.clicks / d.impressions) * 100) : 0,
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis
          dataKey="date"
          stroke="#64748b"
          tick={{ fill: '#64748b', fontSize: 11 }}
          tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        />
        <YAxis
          stroke="#64748b"
          tick={{ fill: '#64748b', fontSize: 11 }}
          tickFormatter={(value) => `${value.toFixed(1)}%`}
        />
        <Tooltip content={({ active, payload, label }) => (
          <CustomTooltip
            active={active}
            payload={payload}
            label={label ? new Date(label).toLocaleDateString() : ''}
            valueFormat={(v: number) => `${v.toFixed(2)}%`}
          />
        )} />
        <Line
          type="monotone"
          dataKey="ctr"
          stroke={COLORS.ctr}
          strokeWidth={2}
          dot={{ fill: COLORS.ctr, strokeWidth: 0, r: 3 }}
          activeDot={{ r: 5, fill: COLORS.ctr }}
          name="CTR"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function PerformanceChart({ data, height = 300 }: ChartProps & { height?: number }) {
  const chartData = data.map(d => ({
    date: d.date,
    spend: d.spend || 0,
    revenue: d.purchase_value || d.revenue || 0,
    conversions: d.conversions || 0,
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis
          dataKey="date"
          stroke="#64748b"
          tick={{ fill: '#64748b', fontSize: 11 }}
          tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        />
        <YAxis
          yAxisId="left"
          stroke="#64748b"
          tick={{ fill: '#64748b', fontSize: 11 }}
          tickFormatter={(value) => `$${value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}`}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          stroke="#64748b"
          tick={{ fill: '#64748b', fontSize: 11 }}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload || !payload.length) return null
            return (
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
                <p className="text-slate-400 text-xs mb-2">{label ? new Date(label).toLocaleDateString() : ''}</p>
                {payload.map((entry: any, index: number) => (
                  <p key={index} className="text-sm">
                    <span style={{ color: entry.color }} className="font-medium">
                      {entry.name}:
                    </span>
                    <span className="text-white ml-2">
                      {entry.name === 'Conversions' ? formatNumber(entry.value) : formatCurrency(entry.value)}
                    </span>
                  </p>
                ))}
              </div>
            )
          }}
        />
        <Legend
          wrapperStyle={{ paddingTop: 20 }}
          formatter={(value) => <span className="text-slate-400 text-sm">{value}</span>}
        />
        <Bar yAxisId="right" dataKey="conversions" fill={COLORS.conversions} name="Conversions" radius={[4, 4, 0, 0]} />
        <Line yAxisId="left" type="monotone" dataKey="spend" stroke={COLORS.spend} strokeWidth={2} name="Spend" dot={false} />
        <Line yAxisId="left" type="monotone" dataKey="revenue" stroke={COLORS.revenue} strokeWidth={2} name="Revenue" dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export function FunnelChart({ data, height = 300 }: ChartProps & { height?: number }) {
  const chartData = data.map(d => ({
    date: d.date,
    'Add to Cart': d.add_to_cart || 0,
    'Checkout': d.checkout || 0,
    'Purchases': d.purchases || d.conversions || 0,
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis
          dataKey="date"
          stroke="#64748b"
          tick={{ fill: '#64748b', fontSize: 11 }}
          tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        />
        <YAxis
          stroke="#64748b"
          tick={{ fill: '#64748b', fontSize: 11 }}
        />
        <Tooltip
          content={({ active, payload, label }) => (
            <CustomTooltip
              active={active}
              payload={payload}
              label={label ? new Date(label).toLocaleDateString() : ''}
              valueFormat={(v: number) => formatNumber(v)}
            />
          )}
        />
        <Legend
          wrapperStyle={{ paddingTop: 20 }}
          formatter={(value) => <span className="text-slate-400 text-sm">{value}</span>}
        />
        <Bar dataKey="Add to Cart" fill="#f97316" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Checkout" fill="#10b981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Purchases" fill="#3b82f6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function ClicksImpressionsChart({ data, height = 300 }: ChartProps & { height?: number }) {
  const chartData = data.map(d => ({
    date: d.date,
    impressions: (d.impressions || 0) / 1000,
    clicks: d.clicks || 0,
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis
          dataKey="date"
          stroke="#64748b"
          tick={{ fill: '#64748b', fontSize: 11 }}
          tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        />
        <YAxis
          yAxisId="left"
          stroke="#64748b"
          tick={{ fill: '#64748b', fontSize: 11 }}
          tickFormatter={(value) => `${value.toFixed(0)}k`}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          stroke="#64748b"
          tick={{ fill: '#64748b', fontSize: 11 }}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload || !payload.length) return null
            return (
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
                <p className="text-slate-400 text-xs mb-2">{label ? new Date(label).toLocaleDateString() : ''}</p>
                {payload.map((entry: any, index: number) => (
                  <p key={index} className="text-sm">
                    <span style={{ color: entry.color }} className="font-medium">
                      {entry.name}:
                    </span>
                    <span className="text-white ml-2">
                      {entry.name === 'Impressions' ? formatNumber(entry.value * 1000) : formatNumber(entry.value)}
                    </span>
                  </p>
                ))}
              </div>
            )
          }}
        />
        <Legend
          wrapperStyle={{ paddingTop: 20 }}
          formatter={(value) => <span className="text-slate-400 text-sm">{value}</span>}
        />
        <Area yAxisId="left" type="monotone" dataKey="impressions" fill="#6366f1" fillOpacity={0.3} stroke="#6366f1" name="Impressions" />
        <Line yAxisId="right" type="monotone" dataKey="clicks" stroke={COLORS.clicks} strokeWidth={2} name="Clicks" dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
