import { Flame, TrendingUp, TrendingDown, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../context/LanguageContext'

function ScoreBadge({ score }) {
  const color = score >= 90 ? 'text-red-400 bg-red-500/15' : score >= 80 ? 'text-amber-400 bg-amber-500/15' : 'text-blue-400 bg-blue-500/15'
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{score}</span>
}

export default function HotLeads({ leads }) {
  const { t } = useLang()
  const navigate = useNavigate()
  const filters = [t('ui.mostViewed'), t('ui.gainers'), t('ui.losers')]

  return (
    <div className="bg-card card-border rounded-2xl p-5 glow-blue">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Flame size={15} className="text-amber-400" />
          <p className="text-white font-semibold text-sm">{t('ui.hotLeads')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {filters.map((f, i) => (
              <button key={f}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${
                  i === 0 ? 'bg-blue-500 text-white' : 'text-slate-400 border border-white/10 hover:text-white hover:bg-white/5'
                }`}
              >{f}</button>
            ))}
          </div>
          <button
            onClick={() => navigate('/leads')}
            className="flex items-center gap-1 text-blue-400 text-[10px] hover:text-[#E53935] transition-colors"
          >
            <ChevronRight size={12} />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {leads.map((lead) => {
          const isPos = (lead.change ?? '').startsWith('+')
          return (
            <div key={lead.id}
              onClick={() => navigate('/leads')}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 hover:border-[#E53935]/20 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-blue-500/15 flex items-center justify-center text-blue-300 text-xs font-bold flex-shrink-0">
                {lead.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-medium truncate">{lead.name}</p>
                <p className="text-slate-500 text-[10px]">{lead.interest} · {t('ui.budget')}: {lead.budget}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-white text-xs font-semibold mb-0.5"><ScoreBadge score={lead.score} /></p>
                <p className={`text-[10px] font-medium ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>{lead.change}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
