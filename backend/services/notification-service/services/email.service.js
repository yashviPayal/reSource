import { Resend } from 'resend'

const resendApiKey = process.env.RESEND_API_KEY
const resendFrom = process.env.RESEND_FROM_EMAIL || 'reSource <noreply@resource.mentalorbit.tech>'
const appName = process.env.APP_NAME || 'reSource'
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

const resend = resendApiKey ? new Resend(resendApiKey) : null

if (!resend) {
  console.warn('[EmailService] RESEND_API_KEY is not set. Email delivery will be simulated in console.')
}

export class EmailService {
  /**
   * Send notification to listing owner when an item request (claim) is created
   */
  static async sendClaimCreatedNotification(payload) {
    const {
      ownerEmail,
      ownerName,
      requesterName,
      requesterEmail,
      resourceTitle,
      message,
    } = payload

    if (!ownerEmail) {
      console.warn('[EmailService] Skipping claim created email: ownerEmail is missing.', payload)
      return { skipped: true, reason: 'missing_owner_email' }
    }

    const title = resourceTitle || 'Item'
    const subject = `New Request: "${title}" on ${appName} 📦`
    const requestMessage = message ? `"${message}"` : 'No message included'

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; margin: 0; padding: 20px; color: #1f2937; }
          .card { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .header { display: flex; align-items: center; margin-bottom: 24px; border-bottom: 2px solid #10b981; padding-bottom: 16px; }
          .title { font-size: 20px; font-weight: 700; color: #111827; margin: 0; }
          .badge { background: #ecfdf5; color: #047857; font-weight: 600; font-size: 13px; padding: 4px 10px; border-radius: 9999px; margin-left: auto; }
          .msg-box { background: #f3f4f6; border-left: 4px solid #10b981; padding: 14px 18px; border-radius: 6px; margin: 20px 0; font-style: italic; color: #374151; }
          .cta-btn { display: inline-block; background: #10b981; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; margin-top: 16px; text-align: center; }
          .footer { margin-top: 32px; font-size: 12px; color: #9ca3af; text-align: center; border-top: 1px solid #f3f4f6; padding-top: 16px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h2 class="title">${appName}</h2>
            <span class="badge">New Request</span>
          </div>
          <p>Hi <strong>${ownerName || 'there'}</strong>,</p>
          <p><strong>${requesterName || 'A community member'}</strong> (${requesterEmail || 'Anonymous'}) requested your listed item: <strong>${title}</strong>.</p>
          <div class="msg-box">
            ${requestMessage}
          </div>
          <p>You can review this request, communicate with the requester, and accept or decline directly from your dashboard.</p>
          <a href="${frontendUrl}/claims" class="cta-btn">View & Manage Request</a>
          <div class="footer">
            <p>You received this automated notification because your item is listed on ${appName}.</p>
          </div>
        </div>
      </body>
      </html>
    `

    if (!resend) {
      console.log(`[EmailService Simulated] To: ${ownerEmail} | Subject: ${subject}`)
      return { simulated: true }
    }

    try {
      const response = await resend.emails.send({
        from: resendFrom,
        to: ownerEmail,
        subject,
        html,
      })
      console.log(`[EmailService] Sent claim created notification to ${ownerEmail}. Response ID: ${response.data?.id || 'ok'}`)
      return response
    } catch (err) {
      console.error(`[EmailService] Failed to send email to ${ownerEmail}:`, err.message)
      throw err
    }
  }

  /**
   * Send notification to requester when claim status is approved or rejected
   */
  static async sendClaimStatusNotification(payload) {
    const {
      requesterEmail,
      requesterName,
      resourceTitle,
      status,
    } = payload

    if (!requesterEmail) {
      console.warn('[EmailService] Skipping claim status email: requesterEmail is missing.', payload)
      return { skipped: true, reason: 'missing_requester_email' }
    }

    const isApproved = status === 'approved'
    const title = resourceTitle || 'Item'
    const subject = isApproved
      ? `Great news! Your request for "${title}" was approved 🎉`
      : `Update: Your request for "${title}" on ${appName}`

    const bannerBg = isApproved ? '#ecfdf5' : '#fef2f2'
    const bannerColor = isApproved ? '#047857' : '#b91c1c'
    const bannerText = isApproved ? 'Status: Approved ✅' : 'Status: Declined ❌'
    const description = isApproved
      ? `The listing owner approved your request for <strong>${title}</strong>. You can now coordinate handover or pickup details.`
      : `The listing owner was unable to fulfill your request for <strong>${title}</strong> at this time. Please explore more available items on ${appName}.`

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; margin: 0; padding: 20px; color: #1f2937; }
          .card { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .header { border-bottom: 2px solid ${isApproved ? '#10b981' : '#ef4444'}; padding-bottom: 16px; margin-bottom: 24px; }
          .title { font-size: 20px; font-weight: 700; color: #111827; margin: 0; }
          .status-banner { background: ${bannerBg}; color: ${bannerColor}; padding: 14px 18px; border-radius: 8px; font-weight: bold; margin: 20px 0; font-size: 15px; }
          .cta-btn { display: inline-block; background: #10b981; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; margin-top: 16px; }
          .footer { margin-top: 32px; font-size: 12px; color: #9ca3af; text-align: center; border-top: 1px solid #f3f4f6; padding-top: 16px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h2 class="title">${appName} Request Update</h2>
          </div>
          <p>Hi <strong>${requesterName || 'there'}</strong>,</p>
          <div class="status-banner">
            ${bannerText}
          </div>
          <p>${description}</p>
          <a href="${frontendUrl}/claims" class="cta-btn">View My Requests</a>
          <div class="footer">
            <p>You received this automated notification because you submitted a request on ${appName}.</p>
          </div>
        </div>
      </body>
      </html>
    `

    if (!resend) {
      console.log(`[EmailService Simulated] To: ${requesterEmail} | Subject: ${subject}`)
      return { simulated: true }
    }

    try {
      const response = await resend.emails.send({
        from: resendFrom,
        to: requesterEmail,
        subject,
        html,
      })
      console.log(`[EmailService] Sent status update email to ${requesterEmail}. Response ID: ${response.data?.id || 'ok'}`)
      return response
    } catch (err) {
      console.error(`[EmailService] Failed to send status update email to ${requesterEmail}:`, err.message)
      throw err
    }
  }
}
