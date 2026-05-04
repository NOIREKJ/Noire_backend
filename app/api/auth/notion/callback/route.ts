import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')

  if (!code) {
    return NextResponse.redirect('noire://auth?error=no_code')
  }

  try {
    const credentials = Buffer.from(
      `${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`
    ).toString('base64')

    const res = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.NOTION_REDIRECT_URI,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      return NextResponse.redirect('noire://auth?error=oauth_failed')
    }

    const encoded = Buffer.from(data.access_token).toString('base64')
    const workspace = encodeURIComponent(data.workspace_name || '')
    return NextResponse.redirect(`noire://auth?token=${encoded}&workspace=${workspace}`)

  } catch {
    return NextResponse.redirect('noire://auth?error=server_error')
  }
}