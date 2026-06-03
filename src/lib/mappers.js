export function mapLead(lead) {
  return {
    ...lead,
    stage: lead.stage || 'freshLead',
    agent: lead.agent?.name || lead.agentId || '',
    readinessFactors: lead.readinessFactors || [],
    suggestedProperties: lead.suggestedProperties || [],
    opportunities: lead.opportunities || [],
    concerns: lead.concerns || [],
    scoreBreakdown: lead.scoreBreakdown || {},
    tags: lead.tags || [],
    previousAgentIds: lead.previousAgentIds || [],
    history: (lead.interactions || []).map(i => ({
      type: i.type || 'action',
      action: i.action || '',
      date: i.date ? new Date(i.date).toLocaleDateString() : '',
    })),
  };
}

export function mapProperty(p) {
  return {
    ...p,
    coverUrl:        p.coverUrl        || null,
    images:          p.images          || ['🏠'],
    tags:            p.tags            || [],
    concerns:        p.concerns        || [],
    comps:           p.comps           || [],
    agent:           (typeof p.agent === 'object' ? p.agent?.name : p.agent) || '',
    status:          p.status          || 'Active',
    matchScore:      p.matchScore      ?? 0,
    daysOnMarket:    p.daysOnMarket    ?? 0,
    views:           p.views           ?? 0,
    appreciationYoY: p.appreciationYoY ?? 0,
    beds:            p.beds            ?? 0,
    baths:           p.baths           ?? 0,
    sqft:            p.sqft            || 1,
    yearBuilt:       p.yearBuilt       || '—',
    description:     p.description     || '',
    recommendation:  p.recommendation  || '',
  };
}

export function mapAgent(a) {
  return {
    ...a,
    color:              a.color              || '#3b82f6',
    avatar:             a.avatar             || (a.name ? a.name.split(' ').map(w => w[0]).join('').slice(0, 2) : '??'),
    tier:               a.tier               || 'developing',
    specialization:     a.specialization     || '',
    region:             a.region             || '',
    rank:               a.rank               ?? 99,
    rankRevenue:        a.rankRevenue        ?? 99,
    rankConversion:     a.rankConversion     ?? 99,
    rankSpeed:          a.rankSpeed          ?? 99,
    rankNPS:            a.rankNPS            ?? 99,
    revenueYTD:         a.revenueYTD         ?? 0,
    revenuePrev:        a.revenuePrev        ?? 0,
    monthlyRevenue:     a.monthlyRevenue     || [],
    conversionRate:     a.conversionRate     ?? 0,
    prevConversionRate: a.prevConversionRate ?? 0,
    dealsClosedYTD:     a.dealsClosedYTD     ?? 0,
    dealsClosedMonth:   a.dealsClosedMonth   ?? 0,
    avgDaysToClose:     a.avgDaysToClose     ?? 0,
    activeDeals:        a.activeDeals        ?? 0,
    npsScore:           a.npsScore           ?? 0,
    repeatClientRate:   a.repeatClientRate   ?? 0,
    tenure:             a.tenure             ?? 0,
    dealVelocity:       ['increasing', 'stable', 'decreasing'].includes(a.dealVelocity) ? a.dealVelocity : 'stable',
    retentionRisk:      ['high', 'medium', 'low'].includes(a.retentionRisk)   ? a.retentionRisk   : 'low',
    strengths:          a.strengths          || [],
    developmentAreas:   a.developmentAreas   || [],
    recentDeals:        a.recentDeals        || [],
    recommendation:     a.recommendation     || '',
    coachingPlan:       a.coachingPlan       || '',
    email:              a.email              || '',
    phone:              a.phone              || '',
  };
}

const DEAL_ICONS = { Villa: '🏡', Apartment: '🏙️', Commercial: '🏢', Land: '🌳', Townhouse: '🏘️' };

export function mapDeal(deal) {
  const now = new Date();
  const closeDate = deal.targetCloseDate ? new Date(deal.targetCloseDate) : null;
  const offerDate  = deal.offerDate       ? new Date(deal.offerDate)       : null;

  const daysUntilClose = closeDate ? Math.round((closeDate - now) / 86400000) : 0;
  const daysElapsed    = offerDate  ? Math.round((now - offerDate)  / 86400000) : 0;

  const stage = deal.stage || 'offer';
  const stageOrder = ['offer', 'negotiation', 'inspection', 'appraisal', 'closing', 'closed'];
  const idx = stageOrder.indexOf(stage);

  return {
    ...deal,
    property:        deal.property?.address || deal.address   || '',
    buyer:           deal.client?.name      || deal.clientName || '',
    agent:           deal.agent?.name       || deal.agentName  || '',
    listPrice:       deal.listPrice         || deal.value      || 0,
    offerDate:       offerDate  ? offerDate.toISOString().slice(0, 10)  : '',
    targetCloseDate: closeDate  ? closeDate.toISOString().slice(0, 10)  : '',
    daysUntilClose:  daysUntilClose,
    daysElapsed:     daysElapsed,
    icon:            DEAL_ICONS[deal.type] || '🏡',
    risk:            deal.risk || 'low',
    milestones:      (deal.milestones || []).map(m => ({
      ...m,
      due: m.due ? new Date(m.due).toISOString().slice(0, 10) : '',
    })),
    progress:        deal.progress || {
      offer_accepted:       idx >= 1,
      negotiation_complete: idx >= 2,
      inspection_clear:     idx >= 3,
      appraisal_complete:   idx >= 4,
      financing_approved:   idx >= 5,
      docs_signed:          idx >= 5,
    },
    positives:   deal.positives   || [],
    risks:       deal.risks       || [],
    nextActions: deal.nextActions || [],
  };
}

export function mapTask(task) {
  const now = new Date();
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const daysOverdue = (dueDate && dueDate < now && task.status !== 'completed')
    ? Math.max(0, Math.round((now - dueDate) / 86400000))
    : 0;

  return {
    ...task,
    dueDate:        task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '',
    assignee:       task.assignee?.name   || '',
    assigneeAvatar: task.assignee?.avatar || '??',
    assigneeColor:  task.assignee?.color  || '#3b82f6',
    daysOverdue,
    subtasks:       task.subtasks || [],
    tags:           task.tags     || [],
  };
}

export function mapClient(c) {
  return {
    ...c,
    tags: c.tags || [],
    transactions: (c.transactions || []).map(t => ({
      ...t,
      date: t.date ? new Date(t.date).toISOString().slice(0, 10) : '',
    })),
  };
}
