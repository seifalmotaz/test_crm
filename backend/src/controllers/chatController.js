'use strict'

const path      = require('path')
const multer    = require('multer')
const { prisma }    = require('../config/database')
const { success, list } = require('../utils/response')
const { AppError }  = require('../utils/AppError')
const catchAsync    = require('../utils/catchAsync')
const notifSvc      = require('../services/notificationService')

const chatStorage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.bin'
    cb(null, `chat-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)
  },
})
const chatUpload = multer({
  storage: chatStorage,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 25) * 1024 * 1024 },
})

// POST /api/chat/upload
exports.uploadFile = [
  chatUpload.single('file'),
  catchAsync(async (req, res) => {
    if (!req.file) throw AppError.badRequest('No file uploaded')
    success(res, {
      url:      `/uploads/${req.file.filename}`,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileMime: req.file.mimetype,
    }, 201)
  }),
]

// GET /api/chat/users  — all authenticated users can fetch the user list for chat display
exports.listChatUsers = catchAsync(async (req, res) => {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, email: true, role: true, isActive: true },
  })
  success(res, users)
})

// GET /api/chat/conversations
exports.listConversations = catchAsync(async (req, res) => {
  const userId = req.user.id

  const convos = await prisma.conversation.findMany({
    where: { participants: { some: { userId } } },
    include: {
      participants: { include: { user: { select: { id: true, email: true, role: true } } } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Add unread count for each conversation
  const withUnread = await Promise.all(convos.map(async c => {
    const unread = await prisma.chatMessage.count({
      where: {
        conversationId: c.id,
        senderId: { not: userId },
        NOT: { readBy: { has: userId } },
      },
    })
    return { ...c, unread }
  }))

  list(res, withUnread, {})
})

// POST /api/chat/conversations/direct
exports.createDirect = catchAsync(async (req, res) => {
  const { targetUserId } = req.body
  const userId = req.user.id
  if (!targetUserId) throw AppError.badRequest('targetUserId required')
  if (targetUserId === userId) throw AppError.badRequest('Cannot DM yourself')

  // Check if direct convo already exists
  const existing = await prisma.conversation.findFirst({
    where: {
      type: 'direct',
      AND: [
        { participants: { some: { userId } } },
        { participants: { some: { userId: targetUserId } } },
      ],
    },
    include: {
      participants: { include: { user: { select: { id: true, email: true, role: true } } } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  })
  if (existing) return success(res, { ...existing, unread: 0 })

  const convo = await prisma.conversation.create({
    data: {
      type: 'direct',
      participants: {
        create: [{ userId }, { userId: targetUserId }],
      },
    },
    include: {
      participants: { include: { user: { select: { id: true, email: true, role: true } } } },
      messages: true,
    },
  })
  success(res, { ...convo, unread: 0 }, 201)
})

// POST /api/chat/conversations/group
exports.createGroup = catchAsync(async (req, res) => {
  const { name, memberIds } = req.body
  const userId = req.user.id
  if (!name?.trim()) throw AppError.badRequest('Group name required')
  if (!Array.isArray(memberIds) || !memberIds.length) throw AppError.badRequest('memberIds required')

  const allMembers = [...new Set([userId, ...memberIds])]
  const convo = await prisma.conversation.create({
    data: {
      type: 'group',
      name: name.trim(),
      participants: { create: allMembers.map(id => ({ userId: id })) },
    },
    include: {
      participants: { include: { user: { select: { id: true, email: true, role: true } } } },
      messages: true,
    },
  })
  success(res, { ...convo, unread: 0 }, 201)
})

// GET /api/chat/conversations/:id/messages
exports.getMessages = catchAsync(async (req, res) => {
  const { id } = req.params
  const userId = req.user.id
  const limit  = Math.min(parseInt(req.query.limit) || 50, 200)
  const before = req.query.before // cursor: createdAt ISO string

  // Verify user is participant
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId: id, userId } },
  })
  if (!participant) throw AppError.forbidden()

  const messages = await prisma.chatMessage.findMany({
    where: {
      conversationId: id,
      ...(before && { createdAt: { lt: new Date(before) } }),
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })

  list(res, messages, {})
})

// POST /api/chat/conversations/:id/messages
exports.sendMessage = catchAsync(async (req, res) => {
  const { id }  = req.params
  const userId  = req.user.id
  const { type = 'text', text, fileUrl, fileName, fileSize, fileMime } = req.body

  if (!text?.trim() && !fileUrl) throw AppError.badRequest('text or fileUrl required')

  // Verify participant
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId: id, userId } },
  })
  if (!participant) throw AppError.forbidden()

  const message = await prisma.chatMessage.create({
    data: {
      conversationId: id,
      senderId: userId,
      type,
      text: text?.trim() || null,
      fileUrl:  fileUrl  || null,
      fileName: fileName || null,
      fileSize: fileSize || null,
      fileMime: fileMime || null,
      readBy: [userId],
    },
  })

  // Notify other participants (fire-and-forget)
  prisma.conversationParticipant.findMany({
    where: { conversationId: id, userId: { not: userId } },
    include: { user: { select: { email: true, agent: { select: { id: true } } } } },
  }).then(async others => {
    const sender = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
    const senderName = sender?.email?.split('@')[0] || 'Someone'
    const preview = type === 'text' ? (text?.trim() || '') : (fileName || 'Sent a file')
    for (const p of others) {
      const agentId = p.user?.agent?.id
      if (agentId) notifSvc.notifyNewMessage(agentId, senderName, preview, id).catch(() => {})
    }
  }).catch(() => {})

  success(res, message, 201)
})

// DELETE /api/chat/conversations/:id/messages  — delete specific messages
exports.deleteMessages = catchAsync(async (req, res) => {
  const { id }  = req.params
  const { messageIds } = req.body
  const userId  = req.user.id

  if (!Array.isArray(messageIds) || !messageIds.length) throw AppError.badRequest('messageIds required')

  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId: id, userId } },
  })
  if (!participant) throw AppError.forbidden()

  await prisma.chatMessage.deleteMany({
    where: { id: { in: messageIds }, conversationId: id },
  })
  success(res, { deleted: messageIds.length })
})

// DELETE /api/chat/conversations/:id  — delete entire conversation
exports.deleteConversation = catchAsync(async (req, res) => {
  const { id }  = req.params
  const userId  = req.user.id

  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId: id, userId } },
  })
  if (!participant) throw AppError.forbidden()

  await prisma.chatMessage.deleteMany({ where: { conversationId: id } })
  await prisma.conversationParticipant.deleteMany({ where: { conversationId: id } })
  await prisma.conversation.delete({ where: { id } })
  success(res, { deleted: true })
})

// POST /api/chat/conversations/:id/read
exports.markRead = catchAsync(async (req, res) => {
  const { id } = req.params
  const userId = req.user.id

  await prisma.chatMessage.updateMany({
    where: {
      conversationId: id,
      senderId: { not: userId },
      NOT: { readBy: { has: userId } },
    },
    data: { readBy: { push: userId } },
  })
  success(res, { ok: true })
})
