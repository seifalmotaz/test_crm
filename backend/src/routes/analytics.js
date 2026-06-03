const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const c = require('../controllers/analyticsController');

const r = Router();
r.use(authenticate);

// ── Portfolio & revenue ───────────────────────────────────────────────────────
r.get('/portfolio',            c.getPortfolio);          // KPI snapshot
r.get('/revenue',              c.getRevenue);             // ?months=12&agentId=
r.get('/forecast',             c.getForecast);            // 30/90-day revenue forecast
r.post('/custom-report',       requireRole('manager'), c.generateReport);

// ── Market ────────────────────────────────────────────────────────────────────
r.get('/market',               c.getMarket);              // inventory + neighborhood breakdown

// ── Leads ─────────────────────────────────────────────────────────────────────
r.get('/leads',                c.getLeadAnalytics);       // funnel + source breakdown ?days=90
r.get('/leads/hot',            c.getHotLeads);            // score≥80 at over-capacity agents ?limit=10

// ── Deals ─────────────────────────────────────────────────────────────────────
r.get('/deals/pipeline',       c.getDealPipeline);        // stage breakdown with weighted value
r.get('/deals/risk',           c.getDealsAtRisk);         // prob<75% or closing<7d with risk factors

// ── Agents ────────────────────────────────────────────────────────────────────
r.get('/agents',               c.getAgentPerformance);    // full agent list from pre-computed metrics
r.get('/agents/leaderboard',   c.getAgentLeaderboard);    // window-function leaderboard ?limit=50
r.get('/agents/underperformers', requireRole('manager'), c.getAgentUnderperformers);

// ── Properties ────────────────────────────────────────────────────────────────
r.get('/properties/comps/:propertyId', c.getPropertyComps); // ?limit=5&months=6

// ── Commissions ───────────────────────────────────────────────────────────────
r.get('/commissions/pending',  c.getCommissionPipeline);  // hold+released records ?agentId=

// ── Channel ROI & agent cohort ────────────────────────────────────────────────
r.get('/channel-roi',          c.getChannelROI);   // lead source performance (roi = quality proxy)
r.get('/agent-cohort',         c.getAgentCohort);  // tier distribution with revenue breakdown

// ── Legacy (kept for frontend backwards compat) ───────────────────────────────
r.get('/dashboard',            c.getDashboard);

module.exports = r;
