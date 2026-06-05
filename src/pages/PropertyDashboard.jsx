import { useState } from 'react'
import {
  Search, Bell, Settings, ArrowUpRight, Home, ChevronsUpDown,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceDot,
} from 'recharts'

/* ── Chart data ─────────────────────────────────────────────────── */
const chartData = [
  { date: '1st Jan',  v: 48  },
  { date: '15th Jan', v: 198 },
  { date: '1st Feb',  v: 162 },
  { date: '15th Feb', v: 98  },
  { date: '1st Mar',  v: 122 },
  { date: '15th Mar', v: 108 },
  { date: '1st Apr',  v: 88  },
  { date: '15th Apr', v: 128 },
  { date: '1st May',  v: 158 },
  { date: '15th May', v: 145 },
  { date: '1st Jun',  v: 96  },
  { date: '15th Jun', v: 74  },
  { date: '1st Jul',  v: 58  },
  { date: '15th Jul', v: 44  },
]

/* ── Featured property icon palette ────────────────────────────── */
const propColors = [
  { icon: '#3b82f6', bg: 'rgba(59,130,246,0.15)'  },
  { icon: '#f97316', bg: 'rgba(249,115,22,0.15)'  },
  { icon: '#22c55e', bg: 'rgba(34,197,94,0.15)'   },
  { icon: '#ef4444', bg: 'rgba(239,68,68,0.15)'   },
  { icon: '#3b82f6', bg: 'rgba(59,130,246,0.15)'  },
]

/* ── Table rows ─────────────────────────────────────────────────── */
const rows = [
  { address: '123 Beverly Hills Dr', type: 'Villa',     price: '$7.5M', status: 'Active' },
  { address: '123 Beverly Hills Dr', type: 'Villa/Apt', price: '$7.5M', status: 'Sold'   },
  { address: '456 Sunset Boulevard', type: 'Penthouse', price: '$12.0M', status: 'Active' },
]

/* ── Leads ──────────────────────────────────────────────────────── */
const leads = [
  { initials: 'LN', name: 'Lead Name', sub: 'Contact', value: '$22.5M' },
  { initials: 'JL', name: 'Joan Laxem', sub: 'Contact', value: '$23.0M' },
  { initials: 'MW', name: 'Mark Willis', sub: 'Contact', value: '$18.5M' },
]

/* ── Recharts custom tooltip ────────────────────────────────────── */
function ChartTooltip({ active, payload, label }) {
  if (active && payload?.length) {
    return (
      <div style={{
        background: '#16162a', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 10, padding: '9px 13px',
      }}>
        <p style={{ color: '#8b8ba0', fontSize: 11, marginBottom: 4 }}>{label} 2024</p>
        <p style={{ color: '#ffffff', fontWeight: 700, fontSize: 14 }}>$12.5M sales</p>
      </div>
    )
  }
  return null
}

/* ── Pill toggle helper ─────────────────────────────────────────── */
function Pill({ label, active, onClick, sm }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full font-medium transition-all"
      style={{
        padding: sm ? '5px 12px' : '6px 16px',
        fontSize: sm ? 11 : 12,
        background: active ? '#2563eb' : 'rgba(255,255,255,0.06)',
        color:      active ? '#ffffff' : 'rgba(255,255,255,0.45)',
        border:     active ? 'none'    : '1px solid rgba(255,255,255,0.09)',
      }}
    >
      {label}
    </button>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
export default function PropertyDashboard() {
  const [chartRange,  setChartRange]  = useState('6M')
  const [propFilter,  setPropFilter]  = useState('All')
  const [leadsFilter, setLeadsFilter] = useState('Most Viewed')

  return (
    <div
      className="min-h-screen"
      style={{ background: '#09090f', fontFamily: "'Inter', system-ui, sans-serif", color: '#fff' }}
    >
      {/* ── TOP BAR ───────────────────────────────────────────────── */}
      <div
        className="items-center px-5 py-3"
        style={{
          background: '#0e0e13',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          gap: 16,
        }}
      >
        {/* Left — nav pills */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {['Listings', 'Clients', 'Reports'].map(item => (
            <button
              key={item}
              className="rounded-full text-sm font-medium transition-all"
              style={{
                padding: '8px 20px',
                background: '#1d1d26',
                color: '#ffffff',
                letterSpacing: '0.01em',
              }}
            >
              {item}
            </button>
          ))}
        </div>

        {/* Center — search (centered in grid column) */}
        <div className="flex justify-center">
        <div className="relative w-full" style={{ maxWidth: 480 }}>
          <Search
            size={14}
            className="absolute top-1/2 -translate-y-1/2"
            style={{ left: 16, color: 'rgba(255,255,255,0.35)' }}
          />
          <input
            type="text"
            placeholder="Search properties, clients, leads"
            className="w-full rounded-full text-sm focus:outline-none"
            style={{
              padding: '10px 22px 10px 42px',
              background: '#1d1d26',
              border: '1px solid rgba(255,255,255,0.07)',
              color: 'rgba(255,255,255,0.65)',
            }}
          />
        </div>
        </div>

        {/* Right — icons + user */}
        <div className="flex items-center gap-2.5 flex-shrink-0 justify-end">
          {/* Bell */}
          <button
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:brightness-125"
            style={{ background: '#1d1d26', color: 'rgba(255,255,255,0.65)' }}
          >
            <Bell size={15} />
          </button>

          {/* Gear */}
          <button
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:brightness-125"
            style={{ background: '#1d1d26', color: 'rgba(255,255,255,0.65)' }}
          >
            <Settings size={15} />
          </button>

          {/* User */}
          <div className="flex items-center gap-2.5" style={{ marginLeft: 6 }}>
            {/* Avatar — circular photo-style */}
            <div
              className="flex-shrink-0 rounded-full overflow-hidden relative"
              style={{
                width: 38, height: 38,
                background: 'linear-gradient(160deg,#d4a5c9 0%,#b07cc0 40%,#7a5fa8 100%)',
                border: '2px solid rgba(255,255,255,0.15)',
              }}
            >
              <svg viewBox="0 0 38 38" width="38" height="38" style={{ position: 'absolute', inset: 0 }}>
                {/* shoulder/body */}
                <ellipse cx="19" cy="37" rx="14" ry="9" fill="rgba(255,255,255,0.55)" />
                {/* neck */}
                <rect x="15.5" y="24" width="7" height="6" rx="3" fill="rgba(255,220,190,0.90)" />
                {/* head */}
                <circle cx="19" cy="17" r="9" fill="rgba(255,220,190,0.95)" />
                {/* hair */}
                <path d="M10 16 Q10 6 19 5 Q28 6 28 16 Q27 10 19 9 Q11 10 10 16Z" fill="rgba(60,30,20,0.85)" />
              </svg>
            </div>

            <div>
              <p style={{ color: '#ffffff', fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>
                Noya Rachel
              </p>
              <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 11, lineHeight: 1.3 }}>
                rachie@gmail.com
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── CONTENT ───────────────────────────────────────────────── */}
      <div className="p-5 space-y-4">

        {/* Row 1 ─ Portfolio Value + Featured Properties */}
        <div className="grid gap-4" style={{ gridTemplateColumns: '2fr 3fr' }}>

          {/* Total Portfolio Value */}
          <div
            className="rounded-2xl p-6"
            style={{ background: '#0f0f17', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center justify-between mb-7">
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>Total Portfolio Value</p>
              <div className="flex gap-1.5">
                {['6M', '1Y'].map(r => (
                  <span
                    key={r}
                    className="rounded-full text-xs font-medium px-3 py-1"
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.11)',
                      color: 'rgba(255,255,255,0.50)',
                    }}
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>

            <p
              className="text-white font-bold leading-none mb-3"
              style={{ fontSize: 33, letterSpacing: '-0.02em' }}
            >
              $ 15,480,250.00
            </p>

            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Growth{' '}
              <span style={{ color: '#22c55e', fontWeight: 600 }}>+4.2% ($650,170)</span>
            </p>
          </div>

          {/* Featured Properties */}
          <div
            className="rounded-2xl p-6"
            style={{ background: '#0f0f17', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center justify-between mb-5">
              <p className="text-white font-semibold">Featured Properties</p>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-full text-xs font-medium px-4 py-1.5 transition-all hover:brightness-125"
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    color: 'rgba(255,255,255,0.60)',
                  }}
                >
                  See all
                </button>
                <button
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:brightness-125"
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    color: 'rgba(255,255,255,0.50)',
                  }}
                >
                  <ArrowUpRight size={13} />
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              {propColors.map((c, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-xl p-3 cursor-pointer transition-all hover:brightness-110"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div
                    className="w-9 h-9 rounded-xl mb-3 flex items-center justify-center"
                    style={{ background: c.bg }}
                  >
                    <Home size={16} style={{ color: c.icon }} />
                  </div>
                  <p className="text-[10px] leading-snug mb-1.5" style={{ color: 'rgba(255,255,255,0.38)' }}>
                    Villa - Beverly Hills
                  </p>
                  <p className="text-sm font-semibold text-white">$7.5M</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Row 2 ─ Portfolio Sales Trends chart */}
        <div
          className="rounded-2xl p-6"
          style={{ background: '#0f0f17', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center justify-between mb-5">
            <p className="text-white font-semibold">Portfolio Sales Trends</p>
            <div className="flex gap-1.5">
              {['1D', '1W', '1M', '6M', '1Y'].map(r => (
                <Pill key={r} label={r} active={chartRange === r} onClick={() => setChartRange(r)} sm />
              ))}
            </div>
          </div>

          <div style={{ height: 218 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 16, right: 8, left: -4, bottom: 0 }}>
                <defs>
                  <linearGradient id="pdBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#3b82f6" stopOpacity={0.38} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  stroke="rgba(255,255,255,0.05)"
                  vertical={false}
                  strokeDasharray="0"
                />

                <XAxis
                  dataKey="date"
                  tick={{ fill: 'rgba(255,255,255,0.28)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                />

                <YAxis
                  domain={[0, 220]}
                  ticks={[10, 50, 100, 130, 200]}
                  tickFormatter={v => `${v}k`}
                  tick={{ fill: 'rgba(255,255,255,0.28)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={38}
                />

                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ stroke: 'rgba(59,130,246,0.30)', strokeWidth: 1, strokeDasharray: '4 4' }}
                />

                {/* Dashed marker at 1st Mar */}
                <ReferenceLine
                  x="1st Mar"
                  stroke="rgba(59,130,246,0.50)"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                />

                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#pdBlue)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#3b82f6', stroke: '#1e40af', strokeWidth: 2 }}
                />

                {/* Static highlight dot at 1st Mar */}
                <ReferenceDot
                  x="1st Mar"
                  y={122}
                  r={5}
                  fill="#3b82f6"
                  stroke="#1e40af"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Row 3 ─ Properties Listed + Top Leads */}
        <div className="grid gap-4" style={{ gridTemplateColumns: '3fr 2fr' }}>

          {/* Properties Listed */}
          <div
            className="rounded-2xl p-6"
            style={{
              background: '#0f0f17',
              border: '1px solid rgba(255,255,255,0.07)',
              overflow: 'hidden',
              maxHeight: 268,
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <p className="text-white font-semibold">Properties Listed</p>
              <div className="flex gap-1.5">
                {['All', 'Gainers', 'Losers'].map(f => (
                  <Pill key={f} label={f} active={propFilter === f} onClick={() => setPropFilter(f)} sm />
                ))}
              </div>
            </div>

            <table className="w-full border-collapse">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  {['Address', 'Type', 'Price', 'Status'].map((h, i) => (
                    <th
                      key={h}
                      className="pb-3 text-xs font-medium text-left"
                      style={{ color: 'rgba(255,255,255,0.35)' }}
                    >
                      {i === 2 ? (
                        <span className="flex items-center gap-1">
                          {h}
                          <ChevronsUpDown size={11} style={{ opacity: 0.5 }} />
                        </span>
                      ) : h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={i}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      opacity: i === rows.length - 1 ? 0.28 : 1,
                    }}
                  >
                    <td className="py-3 text-sm" style={{ color: 'rgba(255,255,255,0.80)' }}>{r.address}</td>
                    <td className="py-3 text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>{r.type}</td>
                    <td className="py-3 text-sm" style={{ color: 'rgba(255,255,255,0.80)' }}>{r.price}</td>
                    <td className="py-3">
                      <span
                        className="px-3 py-1 rounded-full text-xs font-semibold text-white"
                        style={{ background: r.status === 'Active' ? '#22c55e' : '#ef4444' }}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Top Leads */}
          <div
            className="rounded-2xl p-6"
            style={{
              background: '#0f0f17',
              border: '1px solid rgba(255,255,255,0.07)',
              overflow: 'hidden',
              maxHeight: 268,
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <p className="text-white font-semibold">Top Leads</p>
              <div className="flex gap-1.5">
                {['Most Viewed', 'Gainers', 'Losers'].map(f => (
                  <Pill key={f} label={f} active={leadsFilter === f} onClick={() => setLeadsFilter(f)} sm />
                ))}
              </div>
            </div>

            <div>
              {leads.map((l, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 py-3"
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    opacity: i === leads.length - 1 ? 0.28 : 1,
                  }}
                >
                  {/* Avatar */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: 'rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.65)' }}
                  >
                    {l.initials}
                  </div>

                  {/* Name + subtitle */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{l.name}</p>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{l.sub}</p>
                  </div>

                  {/* Value */}
                  <p className="text-white text-sm font-semibold">{l.value}</p>

                  {/* Source */}
                  <p className="text-xs ml-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Source</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
