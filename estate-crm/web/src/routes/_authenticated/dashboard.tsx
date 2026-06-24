import { Building2, Handshake, Users, DollarSign } from 'lucide-react'
import MetricCard from '../../components/dashboard/MetricCard'
import PortfolioHero from '../../components/dashboard/PortfolioHero'
import PropertyCards from '../../components/dashboard/PropertyCards'
import PerformanceChart from '../../components/dashboard/PerformanceChart'
import DealsTable from '../../components/dashboard/DealsTable'
import HotLeads from '../../components/dashboard/HotLeads'
import TopAgents from '../../components/dashboard/TopAgents'
import AlertsPanel from '../../components/dashboard/AlertsPanel'

const chartData = [
  { month: 'Jan', revenue: 3200000 },
  { month: 'Feb', revenue: 4100000 },
  { month: 'Mar', revenue: 3800000 },
  { month: 'Apr', revenue: 5200000 },
  { month: 'May', revenue: 4900000 },
  { month: 'Jun', revenue: 6100000 },
  { month: 'Jul', revenue: 5800000 },
  { month: 'Aug', revenue: 7200000 },
  { month: 'Sep', revenue: 6900000 },
  { month: 'Oct', revenue: 8100000 },
  { month: 'Nov', revenue: 7600000 },
  { month: 'Dec', revenue: 9200000 },
]

const mockProperties = [
  { id: 1, address: '245 Marina Heights', price: 2450000 },
  { id: 2, address: '18 Palm Vista Tower', price: 1800000 },
  { id: 3, address: '92 Skyline Penthouse', price: 5200000 },
  { id: 4, address: '7 Green Valley', price: 980000 },
]

const mockDeals = [
  { id: 1, property: 'Marina Heights #245', type: 'Penthouse', agent: 'Sarah Chen', listPrice: 2450000, stage: 'Closing', changePct: 3.2, volume: '3 units', sparkTrend: 'up' as const, closingInDays: 2 },
  { id: 2, property: 'Palm Vista #18', type: 'Apartment', agent: 'Ahmed Ali', listPrice: 1800000, stage: 'Negotiation', changePct: -1.5, volume: '1 unit', sparkTrend: 'down' as const, closingInDays: 14 },
  { id: 3, property: 'Skyline Penthouse', type: 'Penthouse', agent: 'Maria Lopez', listPrice: 5200000, stage: 'Due Diligence', changePct: 8.1, volume: '1 unit', sparkTrend: 'up' as const, closingInDays: 30 },
  { id: 4, property: 'Green Valley #7', type: 'Villa', agent: 'James Park', listPrice: 980000, stage: 'Inspection', changePct: -0.8, volume: '2 units', sparkTrend: 'down' as const, closingInDays: 5 },
  { id: 5, property: 'Harbor View #33', type: 'Commercial', agent: 'Sarah Chen', listPrice: 3400000, stage: 'Offer Sent', changePct: 5.4, volume: '1 unit', sparkTrend: 'up' as const, closingInDays: 21 },
];

const mockHotLeads = [
  { id: 1, name: 'John Martinez', interest: 'Apartment', budget: '$1.2M', score: 95, change: '+12%', views: 42 },
  { id: 2, name: 'Emily Watson', interest: 'Villa', budget: '$3.5M', score: 88, change: '+8%', views: 35 },
  { id: 3, name: 'Omar Hassan', interest: 'Commercial', budget: '$5M', score: 82, change: '-3%', views: 21 },
  { id: 4, name: 'Lisa Chen', interest: 'Penthouse', budget: '$2.8M', score: 79, change: '+5%', views: 28 },
  { id: 5, name: 'David Kim', interest: 'Townhouse', budget: '$800K', score: 76, change: '-1%', views: 12 },
];

const mockAgents = [
  { id: 1, name: 'Sarah Chen', avatar: 'SC', color: '#3b82f6', region: 'Downtown', dealsThisMonth: 8, revenue: 420000, trend: 12.5 },
  { id: 2, name: 'Ahmed Ali', avatar: 'AA', color: '#10b981', region: 'Marina', dealsThisMonth: 6, revenue: 380000, trend: 8.2 },
  { id: 3, name: 'Maria Lopez', avatar: 'ML', color: '#f59e0b', region: 'Harbor', dealsThisMonth: 5, revenue: 310000, trend: -2.1 },
  { id: 4, name: 'James Park', avatar: 'JP', color: '#8b5cf6', region: 'Valley', dealsThisMonth: 4, revenue: 250000, trend: 15.3 },
]

const mockAlerts = [
  { priority: 'high' as const, message: '3 leads have not been contacted in 7+ days', action: 'Review neglected leads', linkTo: '/leads' as const },
  { priority: 'high' as const, message: 'Marina Heights deal closing in 2 days — docs pending', action: 'Upload pending documents', linkTo: '/deals' as const },
  { priority: 'medium' as const, message: 'Agent Sarah Chen exceeded monthly target by 120%', action: 'View performance report', linkTo: '/agents' as const },
  { priority: 'low' as const, message: '5 new properties added to the MLS feed', action: 'Review new listings', linkTo: '/properties' as const },
]

export default function DashboardPage() {
  const kpis = {
    activeDeals: 24,
    pipelineValue: 18500000,
    activeListings: 42,
    totalLeads: 156,
    revenueYTD: 4200000,
    portfolioValue: 43800000,
  }

  const prevValue = kpis.portfolioValue * 0.97
  const returnPct = parseFloat((((kpis.portfolioValue - prevValue) / prevValue) * 100).toFixed(1))
  const returnAbs = kpis.portfolioValue - prevValue

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-white text-xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-0.5">Your real estate portfolio overview</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4 items-stretch">
        <div className="lg:col-span-2 flex flex-col">
          <PortfolioHero value={kpis.portfolioValue} returnPct={returnPct} returnAbs={returnAbs} />
        </div>
        <div className="lg:col-span-3 flex flex-col">
          <PropertyCards properties={mockProperties} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
        <MetricCard label="Active Deals" value={kpis.activeDeals} prefix="" trend={4.2} icon={Handshake} accent="blue" to="/deals" />
        <MetricCard label="Pipeline Value" value={kpis.pipelineValue} trend={8.5} icon={DollarSign} accent="green" to="/deals" />
        <MetricCard label="Active Listings" value={kpis.activeListings} prefix="" trend={2.3} icon={Building2} accent="purple" to="/properties" />
        <MetricCard label="Total Leads" value={kpis.totalLeads} prefix="" trend={-1.4} icon={Users} accent="amber" to="/leads" />
        <MetricCard label="Revenue YTD" value={kpis.revenueYTD} trend={8.5} icon={DollarSign} accent="rose" to="/analytics" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4 items-start">
        <div className="lg:col-span-2">
          <PerformanceChart data={chartData} />
        </div>
        <div>
          <TopAgents agents={mockAgents} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <DealsTable deals={mockDeals} />
        </div>
        <div className="space-y-4">
          <HotLeads leads={mockHotLeads} />
          <AlertsPanel alerts={mockAlerts} />
        </div>
      </div>
    </div>
  )
}
