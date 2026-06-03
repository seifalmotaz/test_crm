'use strict'

/**
 * Twilio SMS adapter
 *
 * Returns an async sender function, or null if any required env var is absent.
 * The returned function accepts (toNumber, message) — E.164 phone number + text.
 * The Twilio client is created once at startup.
 *
 * Required env vars:
 *   TWILIO_ACCOUNT_SID   — Account SID from the Twilio console
 *   TWILIO_AUTH_TOKEN    — Auth token from the Twilio console
 *   TWILIO_FROM_NUMBER   — Verified Twilio phone number in E.164 format (+15550001234)
 */

function createSmsAdapter() {
  const sid   = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from  = process.env.TWILIO_FROM_NUMBER

  if (!sid || !token || !from) {
    const missing = [
      !sid   && 'TWILIO_ACCOUNT_SID',
      !token && 'TWILIO_AUTH_TOKEN',
      !from  && 'TWILIO_FROM_NUMBER',
    ].filter(Boolean).join(', ')
    console.warn(`[sms] Missing env vars (${missing}) — SMS delivery disabled`)
    return null
  }

  const twilio = require('twilio')
  const client = twilio(sid, token)

  return async function sendSms(to, message) {
    await client.messages.create({ body: message, from, to })
  }
}

module.exports = { createSmsAdapter }
