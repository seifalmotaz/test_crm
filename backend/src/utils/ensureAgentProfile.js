const { prisma } = require('../config/database');

/**
 * If a user has role 'agent' but no Agent profile yet (created via Users panel),
 * auto-create a minimal Agent record so they can own leads/properties/deals.
 * Returns the agentId to use (from body, from req, or newly created).
 */
async function ensureAgentProfile(req, bodyAgentId) {
  const agentId = bodyAgentId || req.agentId;
  if (agentId) return agentId;

  if (req.user.role !== 'agent') return null;

  const namePart = req.user.email.split('@')[0].replace(/[._\-]/g, ' ');
  const name     = namePart.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const avatar   = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'AG';

  // upsert so a race condition or retry never throws a unique-violation
  const newAgent = await prisma.agent.upsert({
    where:  { userId: req.user.id },
    update: {},
    create: {
      userId:         req.user.id,
      name,
      avatar,
      email:          req.user.email,
      phone:          '',
      region:         '',
      specialization: 'Residential',
    },
  });

  // Attach to req so subsequent middleware/handlers see it
  req.agentId = newAgent.id;
  return newAgent.id;
}

module.exports = ensureAgentProfile;
