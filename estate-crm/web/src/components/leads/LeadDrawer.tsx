import { useState } from 'react';
import { X, Phone, Mail, MapPin, Calendar, Edit2, Trash2, CheckCircle, GitBranch } from 'lucide-react';
import type {
  LeadResponseDto,
  UpdateLeadDto,
  ChangeLeadStageDto,
} from '../../api/types.gen';
import {
  LEAD_STAGE_LABELS,
  LEAD_TYPE_LABELS,
  LEAD_SOURCE_LABELS,
  LEAD_STAGE_COLUMNS,
  getLeadInitials,
  isLeadOverdue,
} from '../../types/leads';
import { useLead } from '../../hooks/useLeads';
import { useLeadActivities } from '../../hooks/useLeadActivities';
import { useLeadTags } from '../../hooks/useLeadTags';
import ActivityTimeline from './ActivityTimeline';
import AddActivityForm from './AddActivityForm';
import LeadTagsList from './LeadTagsList';
import DncToggle from './DncToggle';

type TabId = 'info' | 'activities' | 'tags';

interface LeadDrawerProps {
  lead: LeadResponseDto;
  onClose: () => void;
  onUpdate: (data: UpdateLeadDto) => Promise<unknown>;
  onDelete?: () => void;
  onChangeStage: (dto: ChangeLeadStageDto) => void;
  onConvert: () => void;
  canManage: boolean;
  canConvert: boolean; // agent + assigned, or manager/admin
  isOwner: boolean; // user is the lead's agent
}

export default function LeadDrawer({
  lead,
  onClose,
  onUpdate,
  onDelete,
  onChangeStage,
  onConvert,
  canManage,
  canConvert,
  isOwner,
}: LeadDrawerProps) {
  const [tab, setTab] = useState<TabId>('info');
  const [editing, setEditing] = useState(false);
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [editData, setEditData] = useState<UpdateLeadDto>({});

  // Fetch fresh lead data so DNC toggle updates reflect immediately
  const { data: freshLead } = useLead(lead.id);
  const currentLead = freshLead ?? lead;

  const { data: activitiesData, isLoading: activitiesLoading } = useLeadActivities(lead.id);
  const { data: tags = [] } = useLeadTags(lead.id);

  const activities = activitiesData?.data ?? [];
  const initials = getLeadInitials(currentLead.name);
  const overdue = isLeadOverdue(currentLead);

  function startEdit() {
    setEditData({
      name: currentLead.name,
      email: currentLead.email ?? '',
      phone: currentLead.phone,
      source: currentLead.source,
      type: currentLead.type,
      budgetMin: currentLead.budgetMin ?? undefined,
      budgetMax: currentLead.budgetMax ?? undefined,
      timeline: currentLead.timeline ?? undefined,
      preferredLocation: currentLead.preferredLocation ?? '',
      preferredType: currentLead.preferredType ?? '',
      notes: currentLead.notes ?? '',
      nextAction: currentLead.nextAction ?? '',
      score: currentLead.score,
    });
    setEditing(true);
  }

  async function saveEdit() {
    const dto: UpdateLeadDto = {
      ...editData,
      email: editData.email || undefined,
      preferredLocation: editData.preferredLocation || undefined,
      preferredType: editData.preferredType || undefined,
      notes: editData.notes || undefined,
      nextAction: editData.nextAction || undefined,
    };
    await onUpdate(dto);
    setEditing(false);
  }

  const canChangeStage = canManage || isOwner;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border-l border-white/5 flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-white/5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-300 text-sm font-bold flex-shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-white text-base font-semibold truncate">{currentLead.name}</h2>
                <p className="text-slate-400 text-xs truncate">{currentLead.email || currentLead.phone}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white">
              <X size={18} />
            </button>
          </div>

          {/* Status badges */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-medium">
              {LEAD_STAGE_LABELS[currentLead.stage] ?? currentLead.stage}
            </span>
            {currentLead.isDnc && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-medium">
                DNC
              </span>
            )}
            {currentLead.isClient && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-medium">
                Converted
              </span>
            )}
            {currentLead.previousAgentIds.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-300 font-medium">
                Reassigned {currentLead.previousAgentIds.length}×
              </span>
            )}
          </div>

          {/* Quick actions */}
          <div className="flex flex-wrap gap-1.5">
            {canChangeStage && (
              <select
                value={currentLead.stage}
                onChange={(e) => onChangeStage({ stage: e.target.value as any })}
                className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-[10px] focus:outline-none focus:border-blue-500/50"
              >
                {LEAD_STAGE_COLUMNS.map((col) => (
                  <option key={col.id} value={col.id} className="bg-slate-900">
                    {col.label}
                  </option>
                ))}
              </select>
            )}
            {canConvert && !currentLead.isClient && (
              <button
                onClick={onConvert}
                className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-300 text-[10px] font-medium rounded-lg hover:bg-amber-500/30"
              >
                <CheckCircle size={10} /> Convert
              </button>
            )}
            {(canManage || isOwner) && !editing && (
              <button
                onClick={startEdit}
                className="flex items-center gap-1 px-2 py-1 bg-white/5 text-slate-300 text-[10px] font-medium rounded-lg hover:bg-white/10"
              >
                <Edit2 size={10} /> Edit
              </button>
            )}
            {canManage && onDelete && (
              <button
                onClick={onDelete}
                className="flex items-center gap-1 px-2 py-1 bg-red-500/10 text-red-300 text-[10px] font-medium rounded-lg hover:bg-red-500/20"
              >
                <Trash2 size={10} /> Delete
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5">
          {(['info', 'activities', 'tags'] as TabId[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 px-3 py-2.5 text-xs font-medium capitalize transition-colors ${
                tab === t
                  ? 'text-white border-b-2 border-blue-500'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t}
              {t === 'activities' && activities.length > 0 && (
                <span className="ml-1 text-slate-500">({activities.length})</span>
              )}
              {t === 'tags' && tags.length > 0 && (
                <span className="ml-1 text-slate-500">({tags.length})</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {tab === 'info' && (
            <>
              {editing ? (
                <EditForm
                  data={editData}
                  onChange={setEditData}
                  onCancel={() => setEditing(false)}
                  onSave={saveEdit}
                  canEditScore={canManage}
                />
) : (
                <InfoView lead={currentLead} overdue={overdue} />
              )}

              <div className="pt-2">
                <DncToggle
                  leadId={currentLead.id}
                  isDnc={currentLead.isDnc}
                  dncReason={currentLead.dncReason}
                  canManage={canManage}
                />
              </div>
            </>
          )}

          {tab === 'activities' && (
            <>
              {!currentLead.isDnc && !showAddActivity && (
                <button
                  onClick={() => setShowAddActivity(true)}
                  className="w-full px-3 py-2 bg-blue-500/15 text-blue-300 text-xs font-medium rounded-xl hover:bg-blue-500/25"
                >
                  + Add activity
                </button>
              )}
              {currentLead.isDnc && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-2 text-[10px] text-red-300">
                  DNC active — activities are blocked.
                </div>
              )}
              {showAddActivity && (
                <AddActivityForm leadId={currentLead.id} onClose={() => setShowAddActivity(false)} />
              )}
              <ActivityTimeline activities={activities} isLoading={activitiesLoading} />
            </>
          )}

          {tab === 'tags' && (
            <LeadTagsList leadId={currentLead.id} tags={tags} canManage={canManage} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────

function InfoView({ lead, overdue }: { lead: LeadResponseDto; overdue: boolean }) {
  return (
    <div className="space-y-2 text-xs">
      <Row icon={Phone} label="Phone" value={lead.phone} />
      {lead.email && <Row icon={Mail} label="Email" value={lead.email} />}
      <Row icon={MapPin} label="Type" value={LEAD_TYPE_LABELS[lead.type] ?? lead.type} />
      <Row icon={GitBranch} label="Source" value={LEAD_SOURCE_LABELS[lead.source] ?? lead.source} />
      {(lead.budgetMin || lead.budgetMax) && (
        <Row
          icon={MapPin}
          label="Budget"
          value={`$${((lead.budgetMin ?? 0) / 100).toLocaleString()} – $${((lead.budgetMax ?? 0) / 100).toLocaleString()}`}
        />
      )}
      {lead.timeline && <Row icon={Calendar} label="Timeline" value={`${lead.timeline} months`} />}
      {lead.preferredLocation && <Row icon={MapPin} label="Prefers" value={`${lead.preferredLocation}${lead.preferredType ? ` (${LEAD_TYPE_LABELS[lead.preferredType]})` : ''}`} />}
      {lead.nextAction && (
        <Row
          icon={Calendar}
          label="Next action"
          value={`${lead.nextAction}${lead.nextActionDate ? ` — ${new Date(lead.nextActionDate).toLocaleString()}` : ''}`}
          highlight={overdue}
        />
      )}
      <Row icon={GitBranch} label="Score" value={`${lead.score}/100`} />
      {lead.notes && (
        <div className="pt-2 border-t border-white/5">
          <p className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold mb-1">Notes</p>
          <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{lead.notes}</p>
        </div>
      )}
    </div>
  );
}

function Row({ icon: Icon, label, value, highlight }: { icon: any; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={12} className="text-slate-500 mt-0.5 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-slate-500 text-[10px] uppercase tracking-wider">{label}</p>
        <p className={`break-words ${highlight ? 'text-red-300' : 'text-white'}`}>{value}</p>
      </div>
    </div>
  );
}

function EditForm({
  data,
  onChange,
  onCancel,
  onSave,
  canEditScore,
}: {
  data: UpdateLeadDto;
  onChange: (d: UpdateLeadDto) => void;
  onCancel: () => void;
  onSave: () => void;
  canEditScore: boolean;
}) {
  return (
    <div className="space-y-2 text-xs">
      <Input label="Name" value={data.name ?? ''} onChange={(v) => onChange({ ...data, name: v })} />
      <Input label="Email" type="email" value={data.email ?? ''} onChange={(v) => onChange({ ...data, email: v })} />
      <Input label="Phone" value={data.phone ?? ''} onChange={(v) => onChange({ ...data, phone: v })} />
      <Input label="Budget min" type="number" value={data.budgetMin ?? ''} onChange={(v) => onChange({ ...data, budgetMin: v ? Number(v) : undefined })} />
      <Input label="Budget max" type="number" value={data.budgetMax ?? ''} onChange={(v) => onChange({ ...data, budgetMax: v ? Number(v) : undefined })} />
      <Input label="Timeline (months)" type="number" value={data.timeline ?? ''} onChange={(v) => onChange({ ...data, timeline: v ? Number(v) : undefined })} />
      <Input label="Preferred location" value={data.preferredLocation ?? ''} onChange={(v) => onChange({ ...data, preferredLocation: v })} />
      <Input label="Next action" value={data.nextAction ?? ''} onChange={(v) => onChange({ ...data, nextAction: v })} />
      {canEditScore && (
        <Input label="Score" type="number" value={data.score ?? 0} onChange={(v) => onChange({ ...data, score: Math.min(100, Math.max(0, Number(v))) })} />
      )}
      <div>
        <label className="block text-slate-400 text-[10px] uppercase tracking-wider font-semibold mb-1">Notes</label>
        <textarea
          value={data.notes ?? ''}
          onChange={(e) => onChange({ ...data, notes: e.target.value })}
          rows={3}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500/50 resize-none"
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onCancel} className="px-3 py-1.5 text-slate-400 hover:text-white">
          Cancel
        </button>
        <button
          onClick={onSave}
          className="px-3 py-1.5 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: any; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-slate-400 text-[10px] uppercase tracking-wider font-semibold mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500/50"
      />
    </div>
  );
}
