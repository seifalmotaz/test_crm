/**
 * Analytics Service — Optimized Raw SQL Queries
 *
 * WHY RAW SQL HERE:
 *  Prisma ORM can't express window functions, correlated subqueries with FILTER,
 *  or STRING_AGG cleanly. These queries are hand-tuned for the actual indexes and
 *  column statistics on the production schema.
 *
 * SCHEMA CONVENTIONS:
 *  Table names  : lowercase snake_case plural (Prisma default mapping)
 *                 e.g. deals, leads, properties, agents, commission_records
 *  Column names : camelCase, MUST be double-quoted in SQL
 *                 e.g. "agentId", "isDeleted", "targetCloseDate"
 *
 * PARAMETER SAFETY:
 *  All user-supplied values are bound via Prisma's Prisma.sql template, which
 *  emits PostgreSQL positional parameters ($1, $2, ...) — no string interpolation
 *  ever touches user input.
 *
 * INTERVAL CONSTRUCTION:
 *  Never use (${n} || ' days')::interval — PostgreSQL can't concat int + text
 *  via a bound param. Use INTERVAL '1 day' * ${n} instead.
 *
 * BIGINT NOTE:
 *  PostgreSQL COUNT/SUM return bigint. Prisma returns these as JS BigInt.
 *  serialize() converts them to Number before JSON serialisation.
 */

const { prisma } = require('../config/database');
const { Prisma } = require('@prisma/client');

function serialize(rows) {
  return JSON.parse(
    JSON.stringify(rows, (_, v) => (typeof v === 'bigint' ? Number(v) : v))
  );
}

// ─── 1. PORTFOLIO SUMMARY ─────────────────────────────────────────────────────
//
// Single-row KPI snapshot built from scalar subqueries.
// Each subquery hits a narrow index — no full-table scans.
// Expected: < 50 ms on 50k rows.
//
// Indexes used:
//   properties(status, "isDeleted")
//   deals(stage, "isDeleted", "agentId")
//   leads("isDeleted", "agentId")
//   tasks(status, "isDeleted", "assigneeId")

async function getPortfolioSummary(agentId = null) {
  const propAgent  = agentId ? Prisma.sql`AND "agentId" = ${agentId}` : Prisma.empty;
  const leadAgent  = agentId ? Prisma.sql`AND "agentId" = ${agentId}` : Prisma.empty;
  const dealAgent  = agentId ? Prisma.sql`AND "agentId" = ${agentId}` : Prisma.empty;
  const taskAgent  = agentId ? Prisma.sql`AND "assigneeId" = ${agentId}` : Prisma.empty;

  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT
      (SELECT COUNT(*)::int
         FROM properties
         WHERE "isDeleted" = false ${propAgent})                              AS "totalProperties",

      (SELECT COUNT(*)::int
         FROM properties
         WHERE status = 'Active' AND "isDeleted" = false ${propAgent})        AS "activeListings",

      (SELECT COALESCE(SUM(price), 0)
         FROM properties
         WHERE status = 'Active' AND "isDeleted" = false ${propAgent})        AS "portfolioValue",

      (SELECT COUNT(*)::int
         FROM deals
         WHERE stage NOT IN ('closed','lost') AND "isDeleted" = false
               ${dealAgent})                                                  AS "activeDeals",

      (SELECT COALESCE(SUM(value * "closingProbability"::float / 100), 0)
         FROM deals
         WHERE stage NOT IN ('closed','lost') AND "isDeleted" = false
               ${dealAgent})                                                  AS "pipelineValue",

      (SELECT COALESCE(SUM(value * "commissionRate" / 100), 0)
         FROM deals
         WHERE stage = 'closed'
           AND "isDeleted" = false
           AND "updatedAt" >= date_trunc('year', NOW())
               ${dealAgent})                                                  AS "revenueYTD",

      (SELECT COUNT(*)::int
         FROM leads
         WHERE "isDeleted" = false ${leadAgent})                              AS "totalLeads",

      (SELECT COUNT(*)::int
         FROM leads
         WHERE score >= 80 AND "isDeleted" = false ${leadAgent})              AS "hotLeads",

      (SELECT COUNT(*)::int
         FROM tasks
         WHERE status = 'overdue' AND "isDeleted" = false ${taskAgent})       AS "overdueTasks"
  `);

  return serialize(rows)[0];
}

// ─── 2. CLOSING SOON ─────────────────────────────────────────────────────────
//
// Deals closing in the next N days, ordered by date.
// Confidence tier (high/medium/low) based on closingProbability.
// Expected: < 30 ms.
// Index: deals("targetCloseDate", stage, "isDeleted")

async function getClosingSoon(days = 30, agentId = null) {
  const agentClause = agentId ? Prisma.sql`AND d."agentId" = ${agentId}` : Prisma.empty;

  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT
      d.id,
      p.address,
      p.neighborhood,
      d.value,
      d.stage,
      d."closingProbability",
      d."targetCloseDate",
      EXTRACT(DAY FROM d."targetCloseDate" - NOW())::int        AS "daysToClose",
      a.name                                                    AS "agentName",
      a.id                                                      AS "agentId",
      CASE
        WHEN d."closingProbability" >= 90 THEN 'high'
        WHEN d."closingProbability" >= 75 THEN 'medium'
        ELSE 'low'
      END                                                       AS "closingConfidence",
      (SELECT COUNT(*)::int
         FROM tasks t
         WHERE t."dealId" = d.id
           AND t.status != 'completed'
           AND t."isDeleted" = false)                           AS "pendingTasks"
    FROM deals d
    JOIN properties p ON d."propertyId" = p.id
    JOIN agents    a ON d."agentId"    = a.id
    WHERE d.stage NOT IN ('closed','lost')
      AND d."isDeleted" = false
      AND d."targetCloseDate" BETWEEN NOW() AND NOW() + INTERVAL '1 day' * ${days}
      ${agentClause}
    ORDER BY d."targetCloseDate" ASC
  `);

  return serialize(rows);
}

// ─── 3. PROPERTY COMPARABLES ──────────────────────────────────────────────────
//
// Similar properties by type, neighborhood, bed/bath count.
// Ordered by price proximity (best comp first).
// Expected: < 50 ms.
// Index: properties(type, status, "isDeleted")

async function getPropertyComps(opts) {
  const {
    excludeId,
    type,
    neighborhood,
    beds,
    baths,
    targetPrice,
    limit = 5,
    monthsBack = 6,
  } = opts;

  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT
      p.id,
      p.address,
      p.neighborhood,
      p.price,
      p.beds,
      p.baths,
      p.sqft,
      p.status,
      p."createdAt",
      CASE WHEN p.sqft > 0
        THEN ROUND((p.price / p.sqft)::numeric, 2)
        ELSE NULL
      END                                                       AS "pricePerSqft",
      ROUND(
        (p.price - ${targetPrice})::numeric
          / NULLIF(${targetPrice}::numeric, 0) * 100,
        1
      )                                                         AS "priceVariancePct"
    FROM properties p
    WHERE p.type = ${type}::"PropertyType"
      AND p.neighborhood ILIKE ${`%${neighborhood}%`}
      AND ABS(p.beds  - ${beds})  <= 1
      AND ABS(p.baths - ${baths}) <= 0.5
      AND p.status IN ('Active','Sold')
      AND p."isDeleted" = false
      AND p.id != ${excludeId}
      AND p."createdAt" >= NOW() - INTERVAL '1 month' * ${monthsBack}
    ORDER BY
      ABS(p.price - ${targetPrice}) ASC,
      p."createdAt" DESC
    LIMIT ${limit}
  `);

  return serialize(rows);
}

// ─── 4. LEAD CONVERSION FUNNEL ────────────────────────────────────────────────
//
// Stage breakdown with percentage-of-total (window function) and
// average time a lead has been in the system.
// Expected: < 30 ms.
// Index: leads(stage, "isDeleted", "agentId")

async function getLeadFunnel(agentId = null, days = 90) {
  const agentClause = agentId ? Prisma.sql`AND "agentId" = ${agentId}` : Prisma.empty;

  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT
      stage,
      COUNT(*)::int                                              AS count,
      ROUND(
        COUNT(*)::numeric * 100.0
          / NULLIF(SUM(COUNT(*)) OVER (), 0),
        1
      )                                                         AS "pctOfTotal",
      ROUND(
        AVG(EXTRACT(EPOCH FROM (NOW() - "createdAt")) / 86400)::numeric,
        1
      )                                                         AS "avgDaysInStage",
      ROUND(AVG(score)::numeric, 1)                             AS "avgScore"
    FROM leads
    WHERE "isDeleted" = false
      AND "createdAt" >= NOW() - INTERVAL '1 day' * ${days}
      ${agentClause}
    GROUP BY stage
    ORDER BY
      CASE stage
        WHEN 'freshLead'      THEN 1
        WHEN 'qualified'      THEN 2
        WHEN 'callBack'       THEN 3
        WHEN 'followUp'       THEN 4
        WHEN 'reservation'    THEN 5
        WHEN 'notInterested'  THEN 6
        WHEN 'lowBudget'      THEN 7
        ELSE 8
      END
  `);

  return serialize(rows);
}

// ─── 5. HOT LEADS AT OVER-CAPACITY AGENTS ────────────────────────────────────
//
// Score ≥ 80 leads whose assigned agent is already at max capacity (≥15 leads).
// These need immediate reassignment.
// Expected: < 20 ms (index on score).
// Index: leads(score, "isDeleted", stage)

async function getHotUnassignedLeads(limit = 10) {
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT
      l.id,
      l.name,
      l.email,
      l.phone,
      l.score,
      l.budget,
      l."budgetMin",
      l.interest,
      l.location,
      l.timeline,
      l."preApproved",
      l."createdAt",
      a.name                AS "agentName",
      a."leadsAssigned"     AS "agentLoad"
    FROM leads l
    JOIN agents a ON l."agentId" = a.id
    WHERE l.score >= 80
      AND l."isDeleted" = false
      AND l.stage IN ('freshLead','qualified')
      AND a."leadsAssigned" >= 15
    ORDER BY l.score DESC, l."createdAt" ASC
    LIMIT ${limit}
  `);

  return serialize(rows);
}

// ─── 6. DEALS AT RISK ─────────────────────────────────────────────────────────
//
// Deals with probability < 75 OR closing in < 7 days.
// STRING_AGG collects multiple risk factors into one column per row.
// The correlated subqueries use their own indexes for counting documents/tasks.
// Expected: < 100 ms.
// Indexes: deals("closingProbability", stage, "isDeleted")
//          deals("targetCloseDate", stage, "isDeleted")

async function getDealsAtRisk(agentId = null) {
  const agentClause = agentId ? Prisma.sql`AND d."agentId" = ${agentId}` : Prisma.empty;

  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT
      d.id,
      p.address,
      p.neighborhood,
      d.value,
      d.stage,
      d."closingProbability",
      d."targetCloseDate",
      EXTRACT(DAY FROM d."targetCloseDate" - NOW())::int        AS "daysToClose",
      a.name                                                    AS "agentName",
      CASE
        WHEN d."closingProbability" < 50 THEN 'critical'
        WHEN d."closingProbability" < 75 THEN 'high'
        ELSE 'medium'
      END                                                       AS "riskLevel",
      (
        SELECT STRING_AGG(factor, ', ' ORDER BY factor)
        FROM (
          SELECT 'Probability ' || d."closingProbability" || '%' AS factor
            WHERE d."closingProbability" < 75
          UNION ALL
          SELECT 'Closing in < 7 days'
            WHERE EXTRACT(DAY FROM d."targetCloseDate" - NOW()) < 7
          UNION ALL
          SELECT 'No documents uploaded'
            WHERE d.stage IN ('inspection','appraisal','closing')
              AND NOT EXISTS (
                SELECT 1 FROM deal_documents WHERE "dealId" = d.id
              )
          UNION ALL
          SELECT 'Overdue tasks'
            WHERE EXISTS (
              SELECT 1 FROM tasks t
              WHERE t."dealId" = d.id
                AND t.status = 'overdue'
                AND t."isDeleted" = false
            )
        ) f(factor)
      )                                                         AS "riskFactors",
      (SELECT COUNT(*)::int FROM deal_documents WHERE "dealId" = d.id)
                                                               AS "documentCount",
      (SELECT COUNT(*)::int FROM tasks
         WHERE "dealId" = d.id AND status = 'overdue' AND "isDeleted" = false)
                                                               AS "overdueTasks"
    FROM deals d
    JOIN properties p ON d."propertyId" = p.id
    JOIN agents    a ON d."agentId"    = a.id
    WHERE d."isDeleted" = false
      AND d.stage NOT IN ('closed','lost')
      AND (
        d."closingProbability" < 75
        OR EXTRACT(DAY FROM d."targetCloseDate" - NOW()) < 7
      )
      ${agentClause}
    ORDER BY
      CASE
        WHEN d."closingProbability" < 50 THEN 1
        WHEN d."closingProbability" < 75 THEN 2
        ELSE 3
      END,
      d."targetCloseDate" ASC
  `);

  return serialize(rows);
}

// ─── 7. DEAL PIPELINE BY STAGE ────────────────────────────────────────────────
//
// Stage breakdown with total and probability-weighted values.
// Single GROUP BY scan. Expected: < 20 ms.
// Index: deals(stage, "isDeleted", "agentId")

async function getDealPipeline(agentId = null) {
  const agentClause = agentId ? Prisma.sql`AND "agentId" = ${agentId}` : Prisma.empty;

  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT
      stage,
      COUNT(*)::int                                              AS "dealCount",
      COALESCE(SUM(value), 0)                                    AS "totalValue",
      COALESCE(
        SUM(value * "closingProbability"::float / 100),
        0
      )                                                         AS "weightedValue",
      ROUND(AVG("closingProbability")::numeric, 1)               AS "avgProbability"
    FROM deals
    WHERE "isDeleted" = false
      AND stage NOT IN ('closed','lost')
      ${agentClause}
    GROUP BY stage
    ORDER BY
      CASE stage
        WHEN 'offer'       THEN 1
        WHEN 'negotiation' THEN 2
        WHEN 'inspection'  THEN 3
        WHEN 'appraisal'   THEN 4
        WHEN 'closing'     THEN 5
        ELSE 6
      END
  `);

  return serialize(rows);
}

// ─── 8. AGENT LEADERBOARD ─────────────────────────────────────────────────────
//
// Full leaderboard with rank (ROW_NUMBER), gap-to-leader, and MoM growth.
// Reads entirely from pre-computed agent metrics — no joins to deals/leads.
// Expected: < 30 ms (agents table is tiny, typically < 100 rows).
// Index: agents(rank), agents("revenueYTD")

async function getAgentLeaderboard(limit = 50) {
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT
      a.id,
      a.name,
      a.avatar,
      a.color,
      a.tier,
      a.rank,
      a.region,
      a.specialization,
      a."revenueYTD",
      a."revenuePrev",
      a."dealsClosedYTD",
      a."dealsClosedMonth",
      a."conversionRate",
      a."avgDaysToClose",
      a."npsScore",
      a."leadsAssigned",
      a."activeDeals",
      a."retentionRisk",
      a."responseTimeAvg",
      ROW_NUMBER() OVER (ORDER BY a."revenueYTD" DESC)         AS "leaderboardRank",
      ROUND(
        (a."revenueYTD"
          - FIRST_VALUE(a."revenueYTD") OVER (ORDER BY a."revenueYTD" DESC)
        )::numeric * 100.0
          / NULLIF(FIRST_VALUE(a."revenueYTD") OVER (ORDER BY a."revenueYTD" DESC)::numeric, 0),
        1
      )                                                        AS "gapToLeaderPct",
      CASE
        WHEN a."revenuePrev" = 0 THEN NULL
        ELSE ROUND(
          (a."revenueYTD" - a."revenuePrev")::numeric * 100.0
            / NULLIF(a."revenuePrev"::numeric, 0),
          1
        )
      END                                                      AS "revenueGrowthPct"
    FROM agents a
    JOIN users u ON a."userId" = u.id
    WHERE u."isActive" = true
    ORDER BY a."revenueYTD" DESC
    LIMIT ${limit}
  `);

  return serialize(rows);
}

// ─── 9. AGENT UNDERPERFORMERS ─────────────────────────────────────────────────
//
// Agents breaching any performance threshold:
//   - Revenue drop > 20% vs previous month
//   - Conversion rate < 20% (minimum 5 leads to avoid noise)
//   - Avg response time > 24 hours
// Expected: < 20 ms.

async function getAgentUnderperformers() {
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT
      a.id,
      a.name,
      a.tier,
      a."revenueYTD",
      a."revenuePrev",
      CASE WHEN a."revenuePrev" > 0
        THEN ROUND(
          (a."revenuePrev" - a."revenueYTD")::numeric * 100.0 / a."revenuePrev", 1
        )
        ELSE NULL
      END                          AS "revenueDropPct",
      a."conversionRate",
      a."responseTimeAvg",
      a."leadsAssigned",
      a."activeDeals",
      a."retentionRisk",
      ARRAY_REMOVE(ARRAY[
        CASE WHEN a."revenuePrev" > 0
              AND (a."revenuePrev" - a."revenueYTD")
                    / NULLIF(a."revenuePrev", 0) > 0.20
             THEN 'Revenue dropped > 20% vs previous month'
        END,
        CASE WHEN a."conversionRate" < 20 AND a."leadsAssigned" >= 5
             THEN 'Conversion rate ' || ROUND(a."conversionRate"::numeric, 1)::text || '% < 20%'
        END,
        CASE WHEN a."responseTimeAvg" > 24
             THEN 'Response time ' || ROUND(a."responseTimeAvg"::numeric, 1)::text || 'h > 24h'
        END
      ], NULL)                     AS "alertReasons"
    FROM agents a
    JOIN users u ON a."userId" = u.id
    WHERE u."isActive" = true
      AND (
        (a."revenuePrev" > 0
          AND (a."revenuePrev" - a."revenueYTD") / NULLIF(a."revenuePrev", 0) > 0.20)
        OR (a."conversionRate" < 20 AND a."leadsAssigned" >= 5)
        OR  a."responseTimeAvg" > 24
      )
    ORDER BY a."conversionRate" ASC, a."revenueYTD" ASC
  `);

  return serialize(rows);
}

// ─── 10. COMMISSION PIPELINE ──────────────────────────────────────────────────
//
// All hold + released commission records with release countdown.
// paymentStatus distinguishes records that are held but past their release date
// (scheduler may not have run yet) from those still in the hold window.
// Expected: < 30 ms.
// Index: commission_records(status, "releaseDate", "agentId")

async function getCommissionPipeline(agentId = null) {
  const agentClause = agentId ? Prisma.sql`AND cr."agentId" = ${agentId}` : Prisma.empty;

  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT
      cr.id,
      cr."dealId",
      cr."agentId",
      a.name                                                    AS "agentName",
      p.address                                                 AS "propertyAddress",
      d.value                                                   AS "dealValue",
      d.type                                                    AS "dealType",
      cr.amount,
      cr."ratePct",
      cr.status,
      cr."closeDate",
      cr."releaseDate",
      cr."releasedAt",
      cr."payrollBatchId",
      EXTRACT(DAY FROM cr."releaseDate" - NOW())::int           AS "daysUntilRelease",
      CASE
        WHEN cr.status = 'hold' AND NOW() >= cr."releaseDate"
          THEN 'ready_to_release'
        WHEN cr.status = 'hold'
          THEN 'in_hold'
        ELSE cr.status
      END                                                       AS "paymentStatus"
    FROM commission_records cr
    JOIN agents     a ON cr."agentId"  = a.id
    JOIN deals      d ON cr."dealId"   = d.id
    LEFT JOIN properties p ON d."propertyId" = p.id
    WHERE cr.status IN ('hold','released')
      ${agentClause}
    ORDER BY cr."releaseDate" ASC
  `);

  return serialize(rows);
}

// ─── 11. REVENUE TREND (monthly) ─────────────────────────────────────────────
//
// Month-by-month closed deal revenue + commission.
// Uses date_trunc for bucket grouping — single index scan.
// Expected: < 50 ms.
// Index: deals(stage, "updatedAt", "isDeleted")

async function getRevenueTrend(agentId = null, months = 12) {
  const agentClause = agentId ? Prisma.sql`AND "agentId" = ${agentId}` : Prisma.empty;
  const lookback    = months - 1;

  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT
      TO_CHAR(date_trunc('month', "updatedAt"), 'YYYY-MM')      AS month,
      COUNT(*)::int                                             AS "dealCount",
      COALESCE(SUM(value), 0)                                   AS "totalValue",
      COALESCE(SUM(value * "commissionRate" / 100), 0)          AS "totalCommission",
      ROUND(AVG(value)::numeric, 0)                             AS "avgDealValue"
    FROM deals
    WHERE stage = 'closed'
      AND "isDeleted" = false
      AND "updatedAt" >= date_trunc('month', NOW() - INTERVAL '1 month' * ${lookback})
      ${agentClause}
    GROUP BY date_trunc('month', "updatedAt")
    ORDER BY date_trunc('month', "updatedAt") ASC
  `);

  return serialize(rows);
}

// ─── 12. LEAD SOURCE PERFORMANCE ─────────────────────────────────────────────
//
// Which sources yield the best conversion rates and lead quality.
// Single GROUP BY scan with FILTER aggregates (PostgreSQL 9.4+).
// Expected: < 30 ms.
// Index: leads(source, "isDeleted")

async function getLeadSourcePerformance(agentId = null) {
  const agentClause = agentId ? Prisma.sql`AND "agentId" = ${agentId}` : Prisma.empty;

  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT
      source,
      COUNT(*)::int                                                    AS "totalLeads",
      COUNT(*) FILTER (WHERE stage = 'reservation')::int              AS "closedLeads",
      ROUND(
        COUNT(*) FILTER (WHERE stage = 'reservation')::numeric * 100.0
          / NULLIF(COUNT(*), 0),
        1
      )                                                               AS "conversionRate",
      ROUND(AVG(score)::numeric, 1)                                   AS "avgScore",
      ROUND(AVG(budget)::numeric, 0)                                  AS "avgBudget",
      COUNT(*) FILTER (WHERE "preApproved" = true)::int               AS "preApprovedCount"
    FROM leads
    WHERE "isDeleted" = false
      ${agentClause}
    GROUP BY source
    ORDER BY "closedLeads" DESC, "avgScore" DESC
  `);

  return serialize(rows);
}

module.exports = {
  getPortfolioSummary,
  getClosingSoon,
  getPropertyComps,
  getLeadFunnel,
  getHotUnassignedLeads,
  getDealsAtRisk,
  getDealPipeline,
  getAgentLeaderboard,
  getAgentUnderperformers,
  getCommissionPipeline,
  getRevenueTrend,
  getLeadSourcePerformance,
};
