import { AlertTriangle, AlertCircle, Info, ChevronRight } from 'lucide-react'
import { useLang } from '../context/LanguageContext'

const priorityConfig = {
  high:   { icon: AlertTriangle, color: 'text-red-400',   bg: 'bg-red-500/10 border-red-500/20',     dot: 'bg-red-500'   },
  medium: { icon: AlertCircle,   color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-500' },
  low:    { icon: Info,          color: 'text-blue-400',  bg: 'bg-blue-500/10 border-blue-500/20',   dot: 'bg-blue-500'  },
}

export default function AlertsPanel({ alerts }) {
  const { t } = useLang()
  return (
    <div className="bg-card card-border rounded-2xl p-5 glow-blue">
      <div className="flex items-center justify-between mb-4">
        <p className="text-white font-semibold text-sm">{t('ui.alertsActions')}</p>
        <span className="text-[10px] bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full font-medium">
          {alerts.filter(a => a.priority === 'high').length} {t('ui.urgent')}
        </span>
      </div>
      <div className="space-y-2.5">
        {alerts.map((alert, i) => {
          const { icon: Icon, color, bg } = priorityConfig[alert.priority] ?? priorityConfig.low
          return (
            <div key={i}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer hover:brightness-110 transition-all ${bg}`}
            >
              <div className="flex-shrink-0 mt-0.5"><Icon size={14} className={color} /></div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-medium leading-snug">{alert.message}</p>
                <p className="text-slate-500 text-[10px] mt-0.5">{alert.action}</p>
              </div>
              <ChevronRight size={13} className="text-slate-600 flex-shrink-0 mt-0.5" />
            </div>
          )
        })}
      </div>
    </div>
  )
}
