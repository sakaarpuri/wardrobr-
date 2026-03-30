import { NextRequest, NextResponse } from 'next/server'
import sgMail from '@sendgrid/mail'
import { Product } from '@/lib/types'

function buildEmailHtml(title: string, occasion: string | undefined, products: Product[]): string {
  const productRows = products
    .map(
      (p) => `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #222;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="80">
              <img src="${p.imageUrl}" width="80" height="100" style="object-fit:cover; border-radius:8px; display:block;" alt="${p.name}" />
            </td>
            <td style="padding-left:16px; vertical-align:top;">
              <p style="margin:0 0 2px 0; color:#888; font-size:11px; text-transform:uppercase; letter-spacing:1px;">${p.brand}</p>
              <p style="margin:0 0 4px 0; color:#fff; font-size:14px; font-weight:500;">${p.name}</p>
              <p style="margin:0 0 8px 0; color:#fff; font-size:16px; font-weight:700;">
                ${new Intl.NumberFormat('en-GB', { style: 'currency', currency: p.currency ?? 'GBP' }).format(p.price)}
              </p>
              <a href="${p.affiliateUrl}" style="background:#fff; color:#000; text-decoration:none; padding:6px 14px; border-radius:6px; font-size:12px; font-weight:600; display:inline-block;">
                Shop at ${p.storeName} →
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>`
    )
    .join('')

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0; padding:0; background:#0a0a0a; color:#fff; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; padding:32px 16px;">
    <tr>
      <td>
        <p style="margin:0 0 4px 0; color:#888; font-size:12px;">Your look from Wardrobr.ai</p>
        <h1 style="margin:0 0 4px 0; font-size:24px; font-weight:700; color:#fff;">${title}</h1>
        ${occasion ? `<p style="margin:0 0 24px 0; color:#666; font-size:14px;">${occasion}</p>` : '<div style="margin-bottom:24px"></div>'}

        <table width="100%" cellpadding="0" cellspacing="0">
          ${productRows}
        </table>

        <p style="margin:32px 0 0 0; color:#444; font-size:12px; text-align:center;">
          Styled by <a href="https://wardrobr.ai" style="color:#666;">wardrobr.ai</a> ·
          <a href="https://wardrobr.ai/?workspace=1" style="color:#666;">Build another look</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  try {
    const { email, products, title, occasion } = (await req.json()) as {
      email: string
      products: Product[]
      title: string
      occasion?: string
    }

    if (!email || !products?.length || !title) {
      return NextResponse.json({ error: 'email, products, and title are required' }, { status: 400 })
    }

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    const apiKey = process.env.SENDGRID_API_KEY
    if (!apiKey) {
      // Soft failure in development — log but don't error
      console.log('[email] SENDGRID_API_KEY not set — email not sent to', email)
      return NextResponse.json({ success: true, dev: true })
    }

    sgMail.setApiKey(apiKey)
    const fromEmail = process.env.SENDGRID_FROM_EMAIL ?? 'hi@wardrobr.ai'

    await sgMail.send({
      from: { email: fromEmail, name: 'Wardrobr.ai' },
      to: email,
      subject: `Your look: ${title}`,
      html: buildEmailHtml(title, occasion, products),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Email route error:', error)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
