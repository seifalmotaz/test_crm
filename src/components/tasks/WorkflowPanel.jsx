import { Zap, ChevronRight, Plus } from 'lucide-react'
import { useLang } from '../../context/LanguageContext'

const categoryColors = {
  Deal:     'text-blue-400 bg-blue-500/10 border-blue-500/20',
  Lead:     'text-amber-400 bg-amber-500/10 border-amber-500/20',
  Property: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  Client:   'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
}

export default function WorkflowPanel({ templates }) {
  const { t } = useLang()
  return (
    <div className="bg-card card-border rounded-2xl p-4 glow-blue">
      <div className="flex items-center justify-between mb-3">
        <p className="text-white font-semibold text-xs">{t('ui.workflowTemplatesTitle')}</p>
        <Zap size={13} className="text-purple-400" />
      </div>

      <p className="text-slate-500 text-[10px] leading-relaxed mb-3">
        {t('ui.workflowDescription')}
      </p>

      <div className="space-y-2">
        {templates.map(tmpl => (
          <div key={tmpl.id} className="bg-white/3 border border-white/6 rounded-xl p-3 hover:bg-white/6 transition-all cursor-pointer group">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${categoryColors[tmpl.category]}`}>
                    {tmpl.category.toUpperCase()}
                  </span>
                </div>
                <p className="text-white text-[10px] font-semibold">{tmpl.name}</p>
                <p className="text-slate-500 text-[9px] mt-0.5">{tmpl.tasks} {t('ui.workflowTasksUnit')} · {tmpl.description}</p>
              </div>
              <ChevronRight size={11} className="text-slate-600 group-hover:text-slate-400 transition-colors flex-shrink-0 mt-0.5" />
            </div>

            <div className="flex items-center gap-0.5 flex-wrap">
              {tmpl.steps.map((step, i) => (
                <div key={step} className="flex items-center gap-0.5">
                  <span className="text-[8px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">{step}</span>
                  {i < tmpl.steps.length - 1 && <ChevronRight size={7} className="text-slate-700" />}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button className="w-full mt-3 py-2 border border-dashed border-white/15 rounded-xl text-[10px] text-slate-500 hover:text-slate-300 hover:border-white/25 transition-all flex items-center justify-center gap-1.5">
        <Plus size={11} />
        {t('ui.workflowCreateCustom')}
      </button>
    </div>
  )
}
