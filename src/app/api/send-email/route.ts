// src/app/api/send-email/route.ts
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY! 
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: Request) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_SITE_URL || '*',
  }

  let body
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers })
  }

  const { to, subject, html, templateId } = body || {}

  try {
    const { data: settings, error: settingsError } = await supabase
      .from('cv_email_settings')
      .select('resend_api_key, from_email, from_name')
      .single()

    if (settingsError) {
      console.error('Supabase settings fetch error:', settingsError)
      return new Response(JSON.stringify({ error: settingsError.message }), { status: 500, headers })
    }

    const apiKey = settings?.resend_api_key
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'No Resend API key configured' }), { status: 400, headers })
    }

    const from = `${settings.from_name || 'Recruit AI'} <${settings.from_email || 'onboarding@resend.dev'}>`

    const resend = new Resend(apiKey)
    const { error: resendError } = await resend.emails.send({
      from,
      to: [to],
      subject,
      html,
    })

    if (resendError) {
      console.error('Resend send error:', resendError)
      return new Response(JSON.stringify({ error: resendError }), { status: 500, headers })
    }

    if (templateId) {
      const { data: temp } = await supabase
        .from('cv_email_templates')
        .select('usedCount')
        .eq('id', templateId)
        .single()

      if (temp) {
        await supabase
          .from('cv_email_templates')
          .update({ usedCount: temp.usedCount + 1 })
          .eq('id', templateId)
      }
    }

    await supabase.from('cv_sent_emails').insert({
      to,
      subject,
      template_id: templateId,
      sent_at: new Date().toISOString(),
    })

    return new Response(JSON.stringify({ message: 'Email sent successfully' }), { status: 200, headers })
  } catch (err: any) {
    console.error('Unexpected error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers })
  }
}