import { useMemo, useState } from 'react';
import { Flame, ChevronRight } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';

function ScoreBadge({ score }: { score: number }) {
  const style = score >= 90
    ? { background: 'rgba(192,128,144,0.14)', color: '#C08090' }
    : score >= 80
    ? { background: 'rgba(201,150,58,0.12)', color: '#C9963A' }
    : { background: 'rgba(107,158,199,0.12)', color: '#6B9EC7' };
  return <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={style}>{score}</span>;
}

interface Lead {
  id: string | number;
  name: string;
  interest?: string;
  budget?: string;
  score: number;
  change?: string;
  views?: number;
}

type FilterKey = 'most_viewed' | 'gainers' | 'losers';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'most_viewed', label: 'Most Viewed' },
  { key: 'gainers', label: 'Gainers' },
  { key: 'losers', label: 'Losers' },
];

function parseChange(change?: string): number {
  if (!change) return 0;
  const m = change.match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : 0;
}

export default function HotLeads({ leads }: { leads: Lead[] }) {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<FilterKey>('most_viewed');

  const filtered = useMemo(() => {
    const arr = [...leads];
    if (activeFilter === 'most_viewed') {
      arr.sort((a, b) => (b.views ?? b.score) - (a.views ?? a.score));
    } else if (activeFilter === 'gainers') {
      arr.sort((a, b) => parseChange(b.change) - parseChange(a.change));
    } else {
      arr.sort((a, b) => parseChange(a.change) - parseChange(b.change));
    }
    return arr;
  }, [leads, activeFilter]);

  return (
    <div className="bg-card card-border rounded-2xl p-5 glow-blue">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Flame size={15} className="text-amber-400" />
          <p className="text-white font-semibold text-sm">Hot Leads</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                aria-pressed={activeFilter === f.key}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${
                  activeFilter === f.key
                    ? 'bg-blue-500 text-white'
                    : 'text-slate-400 border border-white/10 hover:text-white hover:bg-white/5'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => navigate({ to: '/leads' })}
            className="flex items-center gap-1 text-blue-400 text-[10px] hover:text-white transition-colors"
            aria-label="Open all leads"
          >
            <ChevronRight size={12} />
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-slate-500 text-xs py-4 text-center">No leads to show</p>
        ) : (
          filtered.map((lead) => {
            const isPos = parseChange(lead.change) >= 0;
            return (
              <div
                key={lead.id}
                onClick={() => navigate({ to: '/leads' })}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
              >
                <div className="w-8 h-8 rounded-xl bg-blue-500/15 flex items-center justify-center text-blue-300 text-xs font-bold flex-shrink-0">
                  {lead.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-medium truncate">{lead.name}</p>
                  <p className="text-slate-500 text-[10px]">
                    {lead.interest} · Budget: {lead.budget}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-white text-xs font-semibold mb-0.5">
                    <ScoreBadge score={lead.score} />
                  </p>
                  <p
                    className="text-[10px] font-medium"
                    style={{ color: isPos ? '#6FBFA0' : '#C08090' }}
                  >
                    {lead.change}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}