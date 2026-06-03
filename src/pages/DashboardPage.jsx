import { useState, useEffect } from 'react'
import { useLang } from '../context/LanguageContext'
import MetricCard from '../components/MetricCard'
import PortfolioHero from '../components/PortfolioHero'
import PropertyCards from '../components/PropertyCards'
import PerformanceChart from '../components/PerformanceChart'
import DealsTable from '../components/DealsTable'
import HotLeads from '../components/HotLeads'
import TopAgents from '../components/TopAgents'
import AlertsPanel from '../components/AlertsPanel'
import { Building2, Handshake, Users, TrendingUp, DollarSign } from 'lucide-react'
import api from '../lib/api'
import { mapLead, mapDeal } from '../lib/mappers'

function useDashboard() {
  const [summary,    setSummary]    = useState(null)
  const [revenue,    setRevenue]    = useState([])
  const [topAgents,  setTopAgents]  = useState([])
  const [closing,    setClosing]    = useState([])
  const [properties, setProperties] = useState([])
  const [hotLeads,   setHotLeads]   = useState([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/api/dashboard'),
      api.get('/api/dashboard/revenue?months=12'),
      api.get('/api/dashboard/top-agents'),
      api.get('/api/dashboard/closing-soon?days=30'),
      api.get('/api/properties?per_page=4'),
      api.get('/api/leads?sort=score&per_page=5'),
    ]).then(([sum, rev, agents, close, props, leads]) => {
      setSummary(sum.data)
      setRevenue(rev.data || [])
      setTopAgents(agents.data || [])
      setClosing((close.data || []).map(mapDeal))
      setProperties(props.data || [])
      setHotLeads((leads.data || []).map(mapLead))
    }).catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return { summary, revenue, topAgents, closing, properties, hotLeads, loading }
}

function formatRevenue(data) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  if (Array.isArray(data) && data.length) {
    return data.map((d, i) => {
      let month = months[i % 12]
      if (d.month) {
        const idx = parseInt(d.month.slice(5, 7), 10) - 1
        if (idx >= 0 && idx <= 11) month = months[idx]
      }
      return {
        month,
        revenue: d.totalValue || d.revenue || d.amount || d.value || 0,
        target:  d.target || 0,
      }
    })
  }
  return months.map(month => ({ month, revenue: 0, target: 0 }))
}

export default function DashboardPage() {
  const { t } = useLang()
  const { summary, revenue, topAgents, closing, properties, hotLeads, loading } = useDashboard()

  const kpis        = summary?.kpis    || {}
  const alerts      = summary?.alerts  || []
  const chartData   = formatRevenue(revenue)
  const prevValue   = kpis.portfolioValue ? kpis.portfolioValue * 0.97 : 43800000
  const returnPct   = kpis.portfolioValue
    ? (((kpis.portfolioValue - prevValue) / prevValue) * 100).toFixed(1)
    : 0
  const returnAbs   = kpis.portfolioValue ? kpis.portfolioValue - prevValue : 0

  const mappedAgents = (topAgents || []).map(a => ({
    ...a,
    revenue:        a.revenueYTD       || 0,
    revenueYTD:     a.revenueYTD       || 0,
    dealsThisMonth: a.dealsClosedMonth || 0,
    dealsClosedYTD: a.dealsClosedMonth || 0,
    trend:          a.revenueGrowthPct || 0,
    conversionRate: a.conversionRate   || 0,
    npsScore:       a.npsScore         || 0,
  }))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-white text-xl font-bold tracking-tight">{t('dashboard.title')}</h1>
        <p className="text-slate-400 text-sm mt-0.5">{t('dashboard.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
        <div className="lg:col-span-2">
          <PortfolioHero
            value={kpis.portfolioValue || 0}
            returnPct={parseFloat(returnPct)}
            returnAbs={returnAbs}
          />
        </div>
        <div className="lg:col-span-3">
          <PropertyCards properties={properties} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
        <MetricCard label={t('dashboard.activeDeals')}    value={kpis.activeDeals    || 0} prefix=""  trend={4.2}  icon={Handshake}   accent="blue"   to="/deals" />
        <MetricCard label={t('dashboard.pipelineValue')} value={kpis.pipelineValue  || 0}            trend={8.5}  icon={DollarSign}  accent="green"  to="/deals" />
        <MetricCard label={t('dashboard.activeListings')}value={kpis.activeListings || 0} prefix=""  trend={2.3}  icon={Building2}   accent="purple" to="/properties" />
        <MetricCard label={t('dashboard.totalLeads')}    value={kpis.totalLeads     || 0} prefix=""  trend={-1.4} icon={Users}       accent="amber"  to="/leads" />
        <MetricCard label={t('dashboard.revenueYTD')}    value={kpis.revenueYTD     || 0}            trend={8.5}  icon={DollarSign}  accent="rose"   to="/analytics" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2">
          <PerformanceChart data={chartData} />
        </div>
        <div>
          <TopAgents agents={mappedAgents} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <DealsTable deals={closing} filter="All" />
        </div>
        <div className="space-y-4">
          <HotLeads leads={hotLeads} />
          <AlertsPanel alerts={alerts} />
        </div>
      </div>
    </div>
  )
}
