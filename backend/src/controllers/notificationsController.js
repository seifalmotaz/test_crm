const { success, list } = require('../utils/response');
const { AppError }      = require('../utils/AppError');
const catchAsync        = require('../utils/catchAsync');
const notificationSvc   = require('../services/notificationService');
const { prisma }        = require('../config/database');

// GET /api/notifications
exports.list = catchAsync(async (req, res) => {
  const agentId   = req.agentId;
  if (!agentId) return list(res, [], { unreadCount: 0 });

  const unreadOnly = req.query.unread === 'true';
  const limit      = Math.min(parseInt(req.query.limit) || 50, 200);

  const notifications = await notificationSvc.getAgentNotifications(agentId, { unreadOnly, limit });
  const unreadCount   = await prisma.notification.count({
    where: { recipientId: agentId, readAt: null, status: { not: 'cancelled' } },
  });

  list(res, notifications, { unreadCount });
});

// PATCH /api/notifications/:id/read
exports.markRead = catchAsync(async (req, res) => {
  if (!req.agentId) return success(res, { marked: false });
  await notificationSvc.markAsRead(req.params.id, req.agentId);
  success(res, { marked: true });
});

// POST /api/notifications/read-all
exports.markAllRead = catchAsync(async (req, res) => {
  if (!req.agentId) return success(res, { updated: 0 });
  const result = await notificationSvc.markAllRead(req.agentId);
  success(res, { updated: result.count });
});
