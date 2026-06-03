'use strict'

const router = require('express').Router()
const { authenticate } = require('../middleware/auth')
const ctrl = require('../controllers/chatController')

router.use(authenticate)

router.post('/upload',                      ...ctrl.uploadFile)
router.get('/users',                        ctrl.listChatUsers)
router.get('/conversations',                ctrl.listConversations)
router.post('/conversations/direct',        ctrl.createDirect)
router.post('/conversations/group',         ctrl.createGroup)
router.get('/conversations/:id/messages',    ctrl.getMessages)
router.post('/conversations/:id/messages',   ctrl.sendMessage)
router.post('/conversations/:id/messages/delete', ctrl.deleteMessages)
router.delete('/conversations/:id',               ctrl.deleteConversation)
router.post('/conversations/:id/read',       ctrl.markRead)

module.exports = router
