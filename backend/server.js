require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const app  = require('./src/app');
const { prisma } = require('./src/config/database');

const scheduler       = require('./src/maintenance/scheduler');
const notificationSvc = require('./src/services/notificationService');

const { createEmailAdapter } = require('./src/adapters/email');
const { createSmsAdapter }   = require('./src/adapters/sms');
const { createPushAdapter }  = require('./src/adapters/push');

const PORT = process.env.PORT || 5001;

// ── Notification delivery adapters ────────────────────────────────────────────
// Each factory logs a warning and returns null when its env vars are absent.
// null adapters = in-app inbox only (notifications are always persisted to DB).

const rawEmail = createEmailAdapter();
const rawSms   = createSmsAdapter();
const rawPush  = createPushAdapter();

// deliver() passes agentId as the recipient — look up actual contact details here.
notificationSvc.setAdapters({
  email: rawEmail
    ? async (agentId, subject, body) => {
        const agent = await prisma.agent.findUnique({
          where:  { id: agentId },
          select: { email: true },
        });
        if (agent?.email) await rawEmail(agent.email, subject, body);
      }
    : null,

  sms: rawSms
    ? async (agentId, message) => {
        const agent = await prisma.agent.findUnique({
          where:  { id: agentId },
          select: { phone: true },
        });
        if (agent?.phone) await rawSms(agent.phone, message);
      }
    : null,

  // Push uses FCM topic messaging — no device token lookup required.
  // Mobile clients subscribe to `agent-{agentId}` on login.
  push: rawPush
    ? async (agentId, title, body) => {
        await rawPush(agentId, title, body);
      }
    : null,
});

const uploadDir = path.join(__dirname, process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

async function start() {
  try {
    await prisma.$connect();
    console.log('✓ Database connected');

    app.listen(PORT, () => {
      console.log(`✓ PropCRM API running on http://localhost:${PORT}`);
      console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    if (process.env.NODE_ENV !== 'test') {
      scheduler.start();
    }
  } catch (err) {
    console.error('✗ Failed to start server:', err.message);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  scheduler.stop();
  await prisma.$disconnect();
  process.exit(0);
});

start();
