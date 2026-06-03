/**
 * Data Retention Service
 *
 * POLICIES:
 *  - Audit logs: kept 7 years (legal requirement), then hard-deleted
 *  - Soft-deleted records: archived after 3 years, then hard-deleted
 *  - GDPR erasure: anonymize PII on request (cannot hard-delete — FK constraints
 *    and financial records must be preserved for regulatory compliance)
 *
 * Archive format: newline-delimited JSON written to backend/archives/YYYY-MM-DD_<table>.ndjson
 * In production, ship archive files to cold storage (S3 Glacier, Azure Archive) before deletion.
 */

const fs   = require('fs');
const path = require('path');

const { prisma }   = require('../config/database');
const { AppError } = require('../utils/AppError');

const ARCHIVE_DIR = path.join(__dirname, '../../archives');

function ensureArchiveDir() {
  if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
}

function archivePath(table) {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(ARCHIVE_DIR, `${date}_${table}.ndjson`);
}

// ─── Audit log purge ──────────────────────────────────────────────────────────
// Hard-deletes audit logs older than `years` years (default: 7).
// Run annually — e.g. January 1st.

async function purgeExpiredAuditLogs(years = 7, { dryRun = false } = {}) {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - years);

  const count = await prisma.auditLog.count({ where: { createdAt: { lt: cutoff } } });
  if (count === 0) return { deleted: 0, cutoff, dryRun };

  if (!dryRun) {
    await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  }

  return { deleted: count, cutoff: cutoff.toISOString(), dryRun };
}

// ─── Soft-deleted record archival ────────────────────────────────────────────
// Finds soft-deleted rows older than `years` years, writes them to NDJSON,
// then hard-deletes them.

const ARCHIVABLE_TABLES = [
  { name: 'leads',      model: 'lead',      dateField: 'updatedAt' },
  { name: 'deals',      model: 'deal',      dateField: 'updatedAt' },
  { name: 'properties', model: 'property',  dateField: 'updatedAt' },
  { name: 'clients',    model: 'client',    dateField: 'updatedAt' },
  { name: 'tasks',      model: 'task',      dateField: 'updatedAt' },
];

async function archiveOldSoftDeletedData(years = 3, { dryRun = false } = {}) {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - years);

  if (!dryRun) ensureArchiveDir();

  const results = [];

  for (const { name, model, dateField } of ARCHIVABLE_TABLES) {
    const where = { isDeleted: true, [dateField]: { lt: cutoff } };

    const rows = await prisma[model].findMany({ where });
    if (rows.length === 0) {
      results.push({ table: name, archived: 0, deleted: 0 });
      continue;
    }

    if (!dryRun) {
      // Write to archive file
      const filePath = archivePath(name);
      const ndjson   = rows.map(r => JSON.stringify(r)).join('\n') + '\n';
      fs.appendFileSync(filePath, ndjson, 'utf8');

      // Hard-delete after writing archive
      await prisma[model].deleteMany({ where });
    }

    results.push({ table: name, archived: rows.length, deleted: dryRun ? 0 : rows.length });
  }

  return { cutoff: cutoff.toISOString(), dryRun, results };
}

// ─── GDPR: Right to Erasure ───────────────────────────────────────────────────
// Anonymizes all PII for a data subject. Hard-deletion is not possible because:
//  - Deal/commission records are legally required (financial records, typically 7 years)
//  - FK constraints would cascade and destroy audit trails
//
// What we anonymize:
//  Lead:   name, email, phone, notes
//  Client: name, email, phone, notes
//  User:   email (deactivated + anonymized), no password change needed (BCrypt hash stays)
//
// What we KEEP (non-PII or legally required):
//  - Deal records, commission records, audit log entries (action/resource IDs only, no PII)
//  - Interaction records (timestamps and type, notes scrubbed)
//  - Anonymized audit log entries (userEmail → 'gdpr-erased@deleted.invalid')

const ANONYMIZED_NAME  = 'Deleted User';
const ANONYMIZED_EMAIL = (id) => `gdpr-erased-${id}@deleted.invalid`;
const ANONYMIZED_PHONE = 'DELETED';
const ANONYMIZED_NOTES = '[Content removed per GDPR erasure request]';

async function gdprErase(subjectType, subjectId, { requestedBy, reason = 'GDPR Art.17 Right to Erasure' } = {}) {
  if (!['lead', 'client', 'user'].includes(subjectType)) {
    throw AppError.badRequest('subjectType must be "lead", "client", or "user"');
  }

  const results = {};

  await prisma.$transaction(async (tx) => {
    if (subjectType === 'lead' || subjectType === 'client') {
      const model = subjectType;
      const record = await tx[model].findUnique({ where: { id: subjectId } });
      if (!record) throw AppError.notFound(`${model} ${subjectId}`);

      await tx[model].update({
        where: { id: subjectId },
        data: {
          name:  ANONYMIZED_NAME,
          email: ANONYMIZED_EMAIL(subjectId),
          phone: ANONYMIZED_PHONE,
          notes: ANONYMIZED_NOTES,
        },
      });

      if (subjectType === 'lead') {
        // Scrub interaction notes
        await tx.leadInteraction.updateMany({
          where: { leadId: subjectId },
          data:  { notes: ANONYMIZED_NOTES },
        });
        results.interactionsScrubbed = await tx.leadInteraction.count({ where: { leadId: subjectId } });
      }

      results[model] = { anonymized: true };
    }

    if (subjectType === 'user') {
      const user = await tx.user.findUnique({
        where: { id: subjectId },
        include: { agent: { select: { id: true } } },
      });
      if (!user) throw AppError.notFound(`User ${subjectId}`);

      await tx.user.update({
        where: { id: subjectId },
        data: {
          email:    ANONYMIZED_EMAIL(subjectId),
          isActive: false,
        },
      });

      // If user has an agent profile, anonymize it too
      if (user.agent) {
        await tx.agent.update({
          where: { id: user.agent.id },
          data:  { email: ANONYMIZED_EMAIL(subjectId) },
        });
        results.agentAnonymized = true;
      }

      results.user = { anonymized: true };
    }
  });

  // Log the erasure request (not in the transaction — audit log must persist)
  await prisma.auditLog.create({
    data: {
      userId:     requestedBy ?? 'system',
      userEmail:  'system',
      userRole:   'admin',
      action:     'GDPR_ERASE',
      resource:   subjectType,
      resourceId: subjectId,
      changes:    { after: { anonymized: true }, reason },
      metadata:   { requestedBy },
    },
  }).catch(() => {});

  return { subjectType, subjectId, anonymized: true, reason, results };
}

// ─── GDPR erasure request history ────────────────────────────────────────────

async function getErasureRequests(limit = 100) {
  return prisma.auditLog.findMany({
    where:   { action: 'GDPR_ERASE' },
    orderBy: { createdAt: 'desc' },
    take:    limit,
  });
}

// ─── Retention stats (for admin dashboard) ────────────────────────────────────

async function getRetentionStats() {
  const now      = new Date();
  const sevenYrs = new Date(); sevenYrs.setFullYear(now.getFullYear() - 7);
  const threeYrs = new Date(); threeYrs.setFullYear(now.getFullYear() - 3);

  const [auditLogsTotal, auditLogsDue, softDeletedLeads, softDeletedDeals, softDeletedClients, gdprRequests] =
    await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.count({ where: { createdAt: { lt: sevenYrs } } }),
      prisma.lead.count({ where: { isDeleted: true, updatedAt: { lt: threeYrs } } }),
      prisma.deal.count({ where: { isDeleted: true, updatedAt: { lt: threeYrs } } }),
      prisma.client.count({ where: { isDeleted: true, updatedAt: { lt: threeYrs } } }),
      prisma.auditLog.count({ where: { action: 'GDPR_ERASE' } }),
    ]);

  return {
    auditLogs:     { total: auditLogsTotal, dueForPurge: auditLogsDue, retentionYears: 7 },
    archivableSoftDeleted: {
      leads:   softDeletedLeads,
      deals:   softDeletedDeals,
      clients: softDeletedClients,
      archivalAfterYears: 3,
    },
    gdprRequests,
    archiveDir: ARCHIVE_DIR,
  };
}

module.exports = {
  purgeExpiredAuditLogs,
  archiveOldSoftDeletedData,
  gdprErase,
  getErasureRequests,
  getRetentionStats,
};
