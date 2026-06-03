'use strict'

/**
 * SendGrid email adapter
 *
 * Returns an async sender function, or null if SENDGRID_API_KEY is not set.
 * The returned function accepts (to, subject, htmlBody) — all plain strings.
 * Adapter is initialised once at startup; the API key is set a single time.
 */

function createEmailAdapter() {
  const apiKey = process.env.SENDGRID_API_KEY
  if (!apiKey) {
    console.warn('[email] SENDGRID_API_KEY not set — email delivery disabled')
    return null
  }

  const sgMail = require('@sendgrid/mail')
  sgMail.setApiKey(apiKey)

  const from = process.env.FROM_EMAIL || 'noreply@propcrm.app'

  return async function sendEmail(to, subject, htmlBody) {
    await sgMail.send({ to, from, subject, html: htmlBody, text: htmlBody })
  }
}

module.exports = { createEmailAdapter }
