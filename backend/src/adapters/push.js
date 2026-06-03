'use strict'

/**
 * Firebase Cloud Messaging push adapter
 *
 * Returns an async sender function, or null if FIREBASE_SERVICE_ACCOUNT_JSON is absent.
 * The returned function accepts (agentId, title, body).
 *
 * Delivery uses FCM topic messaging: each agent's devices subscribe to the topic
 * `agent-{agentId}` from the mobile app. No device tokens are stored server-side.
 *
 * Required env var:
 *   FIREBASE_SERVICE_ACCOUNT_JSON — base64-encoded service account JSON downloaded
 *                                   from Firebase Console → Project Settings → Service Accounts
 *
 * To encode: base64 -i serviceAccount.json -o -
 */

function createPushAdapter() {
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!encoded) {
    console.warn('[push] FIREBASE_SERVICE_ACCOUNT_JSON not set — push delivery disabled')
    return null
  }

  let serviceAccount
  try {
    serviceAccount = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'))
  } catch {
    console.warn('[push] FIREBASE_SERVICE_ACCOUNT_JSON is not valid base64 JSON — push disabled')
    return null
  }

  const admin = require('firebase-admin')
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
  }

  return async function sendPush(agentId, title, body) {
    await admin.messaging().send({
      topic:        `agent-${agentId}`,
      notification: { title, body },
    })
  }
}

module.exports = { createPushAdapter }
