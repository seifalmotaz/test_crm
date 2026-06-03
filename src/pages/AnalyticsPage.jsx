import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import {
  TrendingUp, DollarSign, BarChart3, Target, Zap,
  AlertTriangle, CheckCircle, Users, Award, Download,
} from 'lucide-react'
import { useLang } from '../context/LanguageContext'
import RevenueChart from '../components/analytics/RevenueChart'
import ForecastPanel from '../components/analytics/ForecastPanel'
import ChannelROIPanel from '../components/analytics/ChannelROIPanel'
import LeadsAnalytics, { LEAD_STAGE_LABELS } from '../components/analytics/LeadsAnalytics'
import DealsAnalytics from '../components/analytics/DealsAnalytics'
import AgentsAnalytics from '../components/analytics/AgentsAnalytics'
import api from '../lib/api'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  return `$${(n / 1_000).toFixed(0)}K`
}

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const insightIcons = {
  opportunity: { icon: TrendingUp,    color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  risk:        { icon: AlertTriangle, color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20' },
  action:      { icon: Zap,           color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20' },
}

const recPriority = {
  critical: 'text-red-400 bg-red-500/10',
  high:     'text-amber-400 bg-amber-500/10',
  medium:   'text-blue-400 bg-blue-500/10',
}

const TIER_META = {
  elite:      { label: 'Top 20%',    color: '#f59e0b' },
  core:       { label: 'Mid 40%',    color: '#3b82f6' },
  developing: { label: 'Bottom 40%', color: '#64748b' },
}

const SEGMENT_COLORS = ['bg-blue-500','bg-purple-500','bg-emerald-500','bg-amber-500','bg-rose-500']

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview', label: 'Overview',  icon: BarChart3 },
  { id: 'leads',    label: 'Leads',     icon: Users },
  { id: 'deals',    label: 'Deals',     icon: DollarSign },
  { id: 'agents',   label: 'Agents',    icon: Award },
]

// ─── Data mappers ─────────────────────────────────────────────────────────────

function mapRevenue(trend) {
  return trend.map(m => {
    if (!m?.month) return { month: '???', revenue: 0, target: 0, deals: 0 }
    const [yearStr, monthStr] = m.month.split('-')
    const label = `${MONTHS_SHORT[parseInt(monthStr, 10) - 1] ?? '???'} ${yearStr.slice(2)}`
    return { month: label, revenue: (m.totalValue ?? 0) / 1_000_000, target: 0, deals: m.dealCount ?? 0 }
  })
}

function buildQuarterly(monthly) {
  const map = {}
  monthly.forEach(m => {
    const [mon, yr] = m.month.split(' ')
    const q = `Q${Math.floor(MONTHS_SHORT.indexOf(mon) / 3) + 1} ${yr}`
    if (!map[q]) map[q] = { quarter: q, revenue: 0, deals: 0 }
    map[q].revenue += m.revenue
    map[q].deals   += m.deals
  })
  const list = Object.values(map)
  list.forEach((q, i) => {
    q.revenue = Math.round(q.revenue * 10) / 10
    q.growth  = i > 0 ? Math.round((q.revenue - list[i - 1].revenue) / list[i - 1].revenue * 1000) / 10 : null
  })
  return list
}

function computeKPIs(trend, forecastData, portfolio = {}) {
  const currentYear = new Date().getFullYear()
  const ttm = trend.slice(-12)
  const ytd = trend.filter(m => m?.month && parseInt(m.month.slice(0, 4), 10) === currentYear)
  const revenueTTM = ttm.reduce((s, m) => s + m.totalValue, 0)
  const revenueYTD = portfolio.revenueYTD ?? ytd.reduce((s, m) => s + m.totalValue, 0)
  const dealsTTM   = ttm.reduce((s, m) => s + m.dealCount, 0)
  const dealsYTD   = ytd.reduce((s, m) => s + m.dealCount, 0)
  return {
    revenueTTM,
    revenueYTD,
    dealsClosedTTM:       dealsTTM,
    dealsYTD,
    avgDealRevenue:       dealsTTM > 0 ? Math.round(revenueTTM / dealsTTM) : 0,
    pipelineValue:        portfolio.pipelineValue ?? forecastData?.days90?.bestCase ?? 0,
    forecast90Days:       forecastData?.days90?.expectedRevenue || 0,
    growthVsLastYear:     0,
    conversionRate:       0,
    targetConversionRate: 38,
  }
}

function mapForecast(f) {
  const d90e = f.days90.expectedRevenue
  const d90b = f.days90.bestCase
  return {
    days30: { value: f.days30.expectedRevenue, deals: f.days30.dealCount, confidence: f.days30.confidence || 0, breakdown: f.days30.breakdown || [] },
    days90: { value: d90e, deals: f.days90.dealCount, confidence: f.days90.avgConfidence || 0 },
    scenarios: {
      base:     { label: 'Base Case', fullYear: Math.round(d90e * 4),   probability: 65, color: '#3b82f6' },
      upside:   { label: 'Upside',    fullYear: Math.round(d90b * 3.5), probability: 20, color: '#10b981' },
      downside: { label: 'Downside',  fullYear: Math.round(d90e * 2.5), probability: 15, color: '#ef4444' },
    },
  }
}

function mapAgentCohort(cohorts) {
  return cohorts.map(c => ({
    tier:        TIER_META[c.tier]?.label || c.tier,
    agents:      c.agentCount,
    revenue:     c.totalRevenue,
    revenuePct:  c.revenuePct,
    avgPerAgent: c.avgRevenue,
    color:       TIER_META[c.tier]?.color || '#64748b',
  }))
}

function mapMarket(data) {
  const rows  = data?.byNeighborhood || []
  const total = rows.reduce((s, n) => s + n.listings * n.avgPrice, 0)
  return rows.map((n, i) => ({
    segment:  n.neighborhood,
    listings: n.listings,
    avgPrice: n.avgPrice,
    value:    n.listings * n.avgPrice,
    pct:      total > 0 ? Math.round((n.listings * n.avgPrice / total) * 100) : 0,
    color:    SEGMENT_COLORS[i % SEGMENT_COLORS.length],
  }))
}

function deriveInsights(channelROI, agentCohort, forecast) {
  const insights = []
  const topChannels    = channelROI.filter(c => c.recommended === 'increase')
  const dropChannels   = channelROI.filter(c => c.recommended === 'eliminate')
  const reduceChannels = channelROI.filter(c => c.recommended === 'decrease')
  if (topChannels.length) {
    const best = topChannels[0]
    insights.push({ type: 'opportunity', text: `${best.channel} is the highest-quality lead source (${best.roi}x ROI, ${best.conversion}% conversion) — increase investment for strongest pipeline growth`, impact: `${best.leads} leads` })
  }
  if (agentCohort[0]?.revenuePct > 50) {
    insights.push({ type: 'risk', text: `Top-tier agents generate ${agentCohort[0].revenuePct}% of revenue — concentration risk; at-risk agents require immediate retention plans`, impact: `${fmt(Math.round(agentCohort[0].revenue * 0.3))} risk` })
  }
  if (forecast?.days30?.deals > 0) {
    insights.push({ type: 'action', text: `${forecast.days30.deals} deal${forecast.days30.deals !== 1 ? 's' : ''} closing within 30 days — prioritise closing velocity to secure near-term forecast`, impact: fmt(forecast.days30.value) })
  }
  if (dropChannels.length) {
    insights.push({ type: 'action', text: `${dropChannels.map(c => c.channel).join(', ')} ${dropChannels.length > 1 ? 'are' : 'is'} dragging conversion — reallocate effort to ${topChannels[0]?.channel ?? 'higher-ROI sources'}`, impact: 'Efficiency gain' })
  }
  if (topChannels.length > 1) {
    const others = topChannels.slice(1)
    insights.push({ type: 'opportunity', text: `${others.map(c => c.channel).join(' & ')} also showing strong ROI — scaling these channels diversifies lead quality without relying on a single source`, impact: `${others.reduce((s, c) => s + c.leads, 0)} leads` })
  }
  if (reduceChannels.length) {
    insights.push({ type: 'risk', text: `${reduceChannels.map(c => c.channel).join(', ')} showing diminishing returns — reduce spend before further decline erodes pipeline quality`, impact: 'Cost savings' })
  }
  return insights
}

function deriveRecommendations(channelROI, agentCohort) {
  const recs = []
  let rank = 1
  if (agentCohort[0]?.revenuePct > 50) {
    recs.push({ rank: rank++, title: 'Retain top at-risk agents', impact: `${agentCohort[0].revenuePct}% of revenue at risk`, timeline: 'Immediate', priority: 'critical' })
  }
  channelROI.filter(c => c.recommended === 'increase').sort((a, b) => b.roi - a.roi).slice(0, 2).forEach(c => {
    recs.push({ rank: rank++, title: `Double down on ${c.channel}`, impact: `${c.roi}x ROI · ${c.conversion}% conversion`, timeline: 'Month 1', priority: 'high' })
  })
  channelROI.filter(c => c.recommended === 'eliminate').slice(0, 2).forEach(c => {
    recs.push({ rank: rank++, title: `Cut ${c.channel} spend`, impact: 'Reallocate to top sources', timeline: 'Month 1', priority: 'medium' })
  })
  channelROI.filter(c => c.recommended === 'decrease').slice(0, 1).forEach(c => {
    recs.push({ rank: rank++, title: `Reduce ${c.channel} investment`, impact: 'Diminishing returns', timeline: 'Q3', priority: 'medium' })
  })
  return recs
}

// ─── Data hook ────────────────────────────────────────────────────────────────

function useAnalytics() {
  const [monthly,     setMonthly]     = useState([])
  const [quarterly,   setQuarterly]   = useState([])
  const [kpis,        setKPIs]        = useState(null)
  const [forecast,    setForecast]    = useState(null)
  const [channelROI,  setChannelROI]  = useState([])
  const [agentCohort, setAgentCohort] = useState([])
  const [cohortMeta,  setCohortMeta]  = useState({ totalAgents: 0, totalRevenue: 0 })
  const [market,      setMarket]      = useState([])
  const [leads,       setLeads]       = useState(null)
  const [pipeline,    setPipeline]    = useState([])
  const [riskDeals,   setRiskDeals]   = useState([])
  const [agents,      setAgents]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)

  useEffect(() => {
    Promise.all([
      api.get('/api/analytics/revenue?months=18'),
      api.get('/api/analytics/forecast'),
      api.get('/api/analytics/channel-roi'),
      api.get('/api/analytics/agent-cohort'),
      api.get('/api/analytics/portfolio'),
      api.get('/api/analytics/market'),
      api.get('/api/analytics/leads'),
      api.get('/api/analytics/deals/pipeline'),
      api.get('/api/analytics/deals/risk'),
      api.get('/api/analytics/agents/leaderboard'),
    ])
      .then(([revRes, foreRes, chanRes, cohortRes, portRes, marketRes, leadsRes, pipeRes, riskRes, agentsRes]) => {
        const trend     = revRes.data?.trend || []
        const portfolio = portRes.data       || {}
        const mapped    = mapRevenue(trend)
        setMonthly(mapped)
        setQuarterly(buildQuarterly(mapped))
        setKPIs(computeKPIs(trend, foreRes.data, portfolio))
        setForecast(mapForecast(foreRes.data))
        setChannelROI(chanRes.data || [])
        const cd = cohortRes.data || {}
        setAgentCohort(mapAgentCohort(cd.cohorts || []))
        setCohortMeta({ totalAgents: cd.totalAgents || 0, totalRevenue: cd.totalRevenue || 0 })
        setMarket(mapMarket(marketRes.data))
        setLeads(leadsRes.data || { funnel: [], conversionRate: 0, bySource: [] })
        setPipeline(pipeRes.data || [])
        setRiskDeals(riskRes.data || [])
        setAgents(agentsRes.data || [])
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return { monthly, quarterly, kpis, forecast, channelROI, agentCohort, cohortMeta, market, leads, pipeline, riskDeals, agents, loading, error }
}

// ─── Excel Export ─────────────────────────────────────────────────────────────

function setColWidths(ws, widths) {
  ws['!cols'] = widths.map(w => ({ wch: w }))
}

function exportToExcel({ kpis, monthly, channelROI, leads, pipeline, riskDeals, agents }) {
  const wb = XLSX.utils.book_new()

  // ── Overview KPIs
  if (kpis) {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Metric', 'Value'],
      ['Revenue TTM',      kpis.revenueTTM],
      ['Revenue YTD',      kpis.revenueYTD],
      ['Deals Closed TTM', kpis.dealsClosedTTM],
      ['Deals YTD',        kpis.dealsYTD],
      ['Pipeline Value',   kpis.pipelineValue],
      ['90-Day Forecast',  kpis.forecast90Days],
      ['Avg Deal Revenue', kpis.avgDealRevenue],
    ])
    setColWidths(ws, [22, 18])
    XLSX.utils.book_append_sheet(wb, ws, 'Overview KPIs')
  }

  // ── Monthly Revenue
  if (monthly.length) {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Month', 'Revenue ($M)', 'Deals'],
      ...monthly.map(m => [m.month, m.revenue, m.deals]),
    ])
    setColWidths(ws, [10, 16, 8])
    XLSX.utils.book_append_sheet(wb, ws, 'Monthly Revenue')
  }

  // ── Lead Funnel
  if (leads?.funnel?.length) {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Stage', 'Count', '% of Total', 'Avg Days in Stage', 'Avg Score'],
      ...leads.funnel.map(r => [
        LEAD_STAGE_LABELS[r.stage] || r.stage,
        r.count,
        Number(r.pctOfTotal),
        Number(r.avgDaysInStage),
        Number(r.avgScore),
      ]),
    ])
    setColWidths(ws, [16, 8, 12, 18, 10])
    XLSX.utils.book_append_sheet(wb, ws, 'Lead Funnel')
  }

  // ── Lead Sources
  if (leads?.bySource?.length) {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Source', 'Total Leads', 'Converted', 'Conv Rate %', 'Avg Score', 'Avg Budget ($)', 'Pre-Approved'],
      ...leads.bySource.map(s => [
        s.source,
        Number(s.totalLeads),
        Number(s.closedLeads),
        Number(s.conversionRate),
        Number(s.avgScore),
        Number(s.avgBudget),
        Number(s.preApprovedCount),
      ]),
    ])
    setColWidths(ws, [18, 12, 12, 12, 10, 16, 14])
    XLSX.utils.book_append_sheet(wb, ws, 'Lead Sources')
  }

  // ── Deal Pipeline
  if (pipeline.length) {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Stage', 'Deals', 'Total Value ($)', 'Weighted Value ($)', 'Avg Probability %'],
      ...pipeline.map(r => [
        r.stage,
        r.dealCount,
        Number(r.totalValue),
        Number(r.weightedValue),
        Number(r.avgProbability),
      ]),
    ])
    setColWidths(ws, [14, 8, 18, 20, 18])
    XLSX.utils.book_append_sheet(wb, ws, 'Deal Pipeline')
  }

  // ── Deals at Risk
  if (riskDeals.length) {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Address', 'Neighborhood', 'Value ($)', 'Stage', 'Probability %', 'Days to Close', 'Risk Level', 'Risk Factors', 'Agent'],
      ...riskDeals.map(d => [
        d.address,
        d.neighborhood,
        d.value,
        d.stage,
        d.closingProbability,
        d.daysToClose,
        d.riskLevel,
        d.riskFactors || '',
        d.agentName,
      ]),
    ])
    setColWidths(ws, [30, 16, 14, 14, 14, 14, 12, 40, 18])
    XLSX.utils.book_append_sheet(wb, ws, 'Deals at Risk')
  }

  // ── Agent Leaderboard
  if (agents.length) {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Rank', 'Name', 'Tier', 'Region', 'Revenue YTD ($)', 'Growth %', 'Deals Closed', 'Conv Rate %', 'NPS', 'Avg Days to Close', 'Leads Assigned', 'Retention Risk'],
      ...agents.map(a => [
        a.leaderboardRank,
        a.name,
        a.tier,
        a.region,
        a.revenueYTD,
        a.revenueGrowthPct ?? '',
        a.dealsClosedYTD,
        a.conversionRate,
        a.npsScore,
        a.avgDaysToClose,
        a.leadsAssigned,
        a.retentionRisk,
      ]),
    ])
    setColWidths(ws, [6, 20, 12, 14, 18, 10, 14, 12, 8, 18, 16, 14])
    XLSX.utils.book_append_sheet(wb, ws, 'Agent Leaderboard')
  }

  // ── Channel ROI
  if (channelROI.length) {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Channel', 'Leads', 'Conversion %', 'Revenue ($)', 'ROI', 'Recommendation'],
      ...channelROI.map(c => [c.channel, c.leads, c.conversion, c.revenue, c.roi, c.recommended]),
    ])
    setColWidths(ws, [18, 8, 14, 14, 8, 16])
    XLSX.utils.book_append_sheet(wb, ws, 'Channel ROI')
  }

  const date = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `PIN_CRM_Analytics_${date}.xlsx`)
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ monthly, quarterly, kpis, forecast, channelROI, agentCohort, cohortMeta, market }) {
  const insights        = deriveInsights(channelROI, agentCohort, forecast)
  const recommendations = deriveRecommendations(channelROI, agentCohort)
  const topInsights     = insights.filter(i => i.type === 'opportunity').length
  const riskInsights    = insights.filter(i => i.type === 'risk').length

  const increaseChannels = channelROI.filter(c => c.recommended === 'increase')
  const eliminateChannels = channelROI.filter(c => c.recommended === 'eliminate')

  const kpiStrip = kpis ? [
    { icon: DollarSign, label: 'Revenue (TTM)', color: 'text-blue-400',    bg: 'bg-blue-500/15',    value: fmt(kpis.revenueTTM),    sub: kpis.growthVsLastYear ? `+${kpis.growthVsLastYear}% vs last year` : 'From closed deals' },
    { icon: DollarSign, label: 'Revenue YTD',   color: 'text-emerald-400', bg: 'bg-emerald-500/15', value: fmt(kpis.revenueYTD),    sub: `${kpis.dealsYTD} deals closed YTD` },
    { icon: BarChart3,  label: 'Deals TTM',     color: 'text-purple-400',  bg: 'bg-purple-500/15',  value: kpis.dealsClosedTTM,     sub: kpis.avgDealRevenue ? `Avg ${fmt(kpis.avgDealRevenue)} per deal` : 'Pipeline active' },
    { icon: Target,     label: 'Pipeline',       color: 'text-amber-400',   bg: 'bg-amber-500/15',   value: fmt(kpis.pipelineValue), sub: `${fmt(kpis.forecast90Days)} 90-day forecast` },
    { icon: TrendingUp, label: 'Conv Rate',      color: 'text-slate-400',   bg: 'bg-slate-500/15',   value: kpis.conversionRate ? `${kpis.conversionRate}%` : '—', sub: `Target ${kpis.targetConversionRate}%` },
  ] : []

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpiStrip.map(({ icon: Icon, label, value, sub, color, bg }) => (
          <div key={label} className="bg-card card-border rounded-2xl p-4 flex items-center gap-3 glow-blue">
            <div className={`w-10 h-10 rounded-xl ${bg} ${color} flex items-center justify-center flex-shrink-0`}>
              <Icon size={18} />
            </div>
            <div>
              <p className="text-slate-400 text-[10px] uppercase tracking-wider">{label}</p>
              <p className="text-white text-lg font-bold leading-none mt-0.5">{value}</p>
              <p className="text-slate-500 text-[10px] mt-0.5">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Alert banners */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-start gap-3">
          <TrendingUp size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-emerald-300 text-xs font-semibold mb-1">
              {topInsights} Growth {topInsights === 1 ? 'Opportunity' : 'Opportunities'} Identified
            </p>
            <p className="text-slate-300 text-xs">
              {increaseChannels.length > 0
                ? `${increaseChannels.map(c => c.channel).join(', ')} ${increaseChannels.length > 1 ? 'channels are' : 'channel is'} showing strongest lead quality.`
                : 'Review channel performance to identify growth opportunities.'}
              {' '}Maintain momentum on high-performing sources to maximise conversion.
            </p>
          </div>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-300 text-xs font-semibold mb-1">
              {riskInsights} Risk {riskInsights === 1 ? 'Factor' : 'Factors'} Requiring Attention
            </p>
            <p className="text-slate-300 text-xs">
              {agentCohort[0]?.revenuePct > 50
                ? `Top agents generating ${agentCohort[0].revenuePct}% of revenue — concentration risk.`
                : 'Monitor agent performance and channel mix for early warning signals.'}
              {eliminateChannels.length > 0 && ` ${eliminateChannels.length} low-ROI channel${eliminateChannels.length > 1 ? 's' : ''} dragging efficiency.`}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Main column */}
        <div className="flex-1 min-w-0 space-y-4">
          <RevenueChart data={monthly} />

          {quarterly.length > 0 && (
            <div className="bg-card card-border rounded-2xl p-4 glow-blue">
              <p className="text-white font-semibold text-xs mb-3">Quarterly Performance</p>
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${quarterly.length}, 1fr)` }}>
                {quarterly.map(q => {
                  const maxRev = Math.max(...quarterly.map(r => r.revenue))
                  const barPct = maxRev > 0 ? (q.revenue / maxRev) * 100 : 0
                  return (
                    <div key={q.quarter} className="bg-white/3 border border-white/5 rounded-xl p-3 text-center">
                      <p className="text-[9px] font-medium mb-1 text-slate-400">{q.quarter}</p>
                      <div className="h-12 flex items-end justify-center mb-1.5">
                        <div className="w-4 rounded-t bg-blue-500" style={{ height: `${barPct}%` }} />
                      </div>
                      <p className="text-white text-[10px] font-bold">${q.revenue.toFixed(1)}M</p>
                      {q.growth !== null && (
                        <p className={`text-[8px] ${q.growth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {q.growth >= 0 ? '+' : ''}{q.growth.toFixed(1)}%
                        </p>
                      )}
                      <p className="text-slate-600 text-[8px] mt-0.5">{q.deals} deals</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {market.length > 0 && (
            <div className="bg-card card-border rounded-2xl p-4 glow-blue">
              <div className="flex items-center justify-between mb-3">
                <p className="text-white font-semibold text-xs">Revenue by Market</p>
                <span className="text-[9px] text-slate-500">Est. value = listings × avg price</span>
              </div>
              <div className="space-y-3">
                {market.map(s => (
                  <div key={s.segment}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-slate-300 font-medium">{s.segment}</span>
                      <div className="text-right">
                        <span className="text-[10px] text-white font-bold">{fmt(s.value)}</span>
                        <span className="text-[9px] text-slate-600 ml-1">{s.pct}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${s.color}`} style={{ width: `${s.pct}%` }} />
                    </div>
                    <p className="text-[9px] text-slate-600 mt-0.5">{s.listings} active listings · avg {fmt(s.avgPrice)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {agentCohort.length > 0 && (
            <div className="bg-card card-border rounded-2xl p-4 glow-blue">
              <div className="flex items-center justify-between mb-1">
                <p className="text-white font-semibold text-xs">Agent Revenue Distribution</p>
                <span className="text-[9px] text-slate-500">Top tier generating highest share</span>
              </div>
              <p className="text-slate-500 text-[10px] mb-4">
                {cohortMeta.totalAgents} active agents · {fmt(cohortMeta.totalRevenue)} total YTD
              </p>
              <div className="flex gap-3 mb-4">
                {agentCohort.map(c => (
                  <div key={c.tier} className="flex-1 bg-white/3 border border-white/5 rounded-xl p-3 text-center">
                    <div className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: `${c.color}20`, border: `2px solid ${c.color}40` }}>
                      {c.agents}
                    </div>
                    <p className="text-white text-xs font-semibold">{c.tier}</p>
                    <p className="text-slate-400 text-[9px]">{c.agents} agents</p>
                    <p className="text-lg font-bold mt-1" style={{ color: c.color }}>{c.revenuePct}%</p>
                    <p className="text-slate-500 text-[9px]">of revenue</p>
                    <p className="text-[9px] text-slate-400 mt-1">{fmt(c.revenue)}</p>
                    <p className="text-[9px] text-slate-600">avg {fmt(c.avgPerAgent)}/agent</p>
                  </div>
                ))}
              </div>
              <div className="h-3 bg-white/5 rounded-full overflow-hidden flex">
                {agentCohort.map(c => (
                  <div key={c.tier} className="h-full" style={{ width: `${c.revenuePct}%`, backgroundColor: c.color }} />
                ))}
              </div>
            </div>
          )}

          {insights.length > 0 && (
            <div className="bg-card card-border rounded-2xl p-4 glow-blue">
              <p className="text-white font-semibold text-xs mb-3">Strategic Insights</p>
              <div className="space-y-2">
                {insights.map((insight, i) => {
                  const cfg = insightIcons[insight.type]
                  const InsightIcon = cfg.icon
                  return (
                    <div key={i} className={`border rounded-xl p-3 flex items-start gap-2.5 ${cfg.bg}`}>
                      <InsightIcon size={13} className={`${cfg.color} flex-shrink-0 mt-0.5`} />
                      <p className="text-slate-300 text-[10px] leading-relaxed flex-1">{insight.text}</p>
                      <span className={`text-[9px] font-bold flex-shrink-0 ${cfg.color}`}>{insight.impact}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="w-full lg:w-64 lg:flex-shrink-0 space-y-4">
          {forecast && <ForecastPanel forecast={forecast} />}
          {channelROI.length > 0 && <ChannelROIPanel channels={channelROI} />}

          {recommendations.length > 0 && (
            <div className="bg-card card-border rounded-2xl p-4 glow-blue">
              <p className="text-white font-semibold text-xs mb-3">Action Recommendations</p>
              <div className="space-y-2">
                {recommendations.map(r => (
                  <div key={r.rank} className="bg-white/3 border border-white/6 rounded-xl p-3">
                    <div className="flex items-start gap-2 mb-1">
                      <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[8px] font-bold text-slate-400 flex-shrink-0 mt-0.5">{r.rank}</div>
                      <p className="text-white text-[10px] font-semibold leading-snug">{r.title}</p>
                    </div>
                    <div className="flex items-center justify-between ml-6">
                      <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded capitalize ${recPriority[r.priority]}`}>{r.priority}</span>
                      <span className="text-[9px] text-slate-500">{r.timeline}</span>
                      <span className="text-[9px] text-emerald-400 font-bold">{r.impact}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {kpis && forecast && (
            <div className="bg-card card-border rounded-2xl p-4 glow-blue">
              <p className="text-white font-semibold text-xs mb-3">Pipeline Outlook</p>
              <div className="space-y-3">
                {[
                  { label: '30-day expected', value: forecast.days30.value, color: 'bg-blue-500',    pct: forecast.days90.value > 0 ? Math.round((forecast.days30.value / forecast.days90.value) * 100) : 0 },
                  { label: '90-day expected', value: forecast.days90.value, color: 'bg-purple-500',  pct: 100 },
                  { label: '90-day best case', value: kpis.pipelineValue,   color: 'bg-emerald-500', pct: 100, muted: true },
                ].map(row => (
                  <div key={row.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] ${row.muted ? 'text-purple-300' : 'text-slate-400'}`}>{row.label}</span>
                      <span className="text-[10px] text-white font-bold">{fmt(row.value)}</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${row.color} ${row.muted ? 'opacity-60' : ''}`} style={{ width: `${row.pct}%` }} />
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t border-white/5">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle size={11} className="text-emerald-400" />
                    <p className="text-emerald-400 text-[10px] font-bold">
                      {forecast.days30.deals} deal{forecast.days30.deals !== 1 ? 's' : ''} closing within 30 days
                    </p>
                  </div>
                  <p className="text-slate-500 text-[9px] mt-0.5">{fmt(kpis.pipelineValue)} total pipeline at best case</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { t } = useLang()
  const [tab, setTab] = useState('overview')
  const [exporting, setExporting] = useState(false)

  const {
    monthly, quarterly, kpis, forecast,
    channelROI, agentCohort, cohortMeta, market,
    leads, pipeline, riskDeals, agents,
    loading, error,
  } = useAnalytics()

  function handleExport() {
    setExporting(true)
    try {
      exportToExcel({ kpis, monthly, channelROI, leads, pipeline, riskDeals, agents })
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-white text-xl font-bold tracking-tight">{t('analytics.title')}</h1>
          <p className="text-slate-400 text-sm mt-0.5">{t('analytics.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-xs">Live data</span>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 rounded-xl text-xs font-medium text-white transition-all"
          >
            <Download size={13} />
            {exporting ? 'Exporting…' : 'Export Excel'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-white/3 border border-white/8 rounded-2xl p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium transition-all ${
              tab === id
                ? 'bg-blue-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && (
        <OverviewTab
          monthly={monthly}
          quarterly={quarterly}
          kpis={kpis}
          forecast={forecast}
          channelROI={channelROI}
          agentCohort={agentCohort}
          cohortMeta={cohortMeta}
          market={market}
        />
      )}

      {tab === 'leads' && leads && (
        <LeadsAnalytics
          funnel={leads.funnel || []}
          conversionRate={leads.conversionRate || 0}
          bySource={leads.bySource || []}
        />
      )}

      {tab === 'deals' && (
        <DealsAnalytics
          pipeline={pipeline}
          riskDeals={riskDeals}
        />
      )}

      {tab === 'agents' && (
        <AgentsAnalytics agents={agents} />
      )}
    </div>
  )
}
