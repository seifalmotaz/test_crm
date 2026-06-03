'use strict'

let sgMail = null
const from = process.env.FROM_EMAIL || 'noreply@propcrm.app'

if (process.env.SENDGRID_API_KEY) {
  sgMail = require('@sendgrid/mail')
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
}

async function sendMail(to, subject, html) {
  if (!sgMail) {
    console.log(`[mailer] skipped (no SENDGRID_API_KEY) — to: ${to} | subject: ${subject}`)
    return
  }
  await sgMail.send({ to, from, subject, html, text: html.replace(/<[^>]+>/g, '') })
}

module.exports = { sendMail }
