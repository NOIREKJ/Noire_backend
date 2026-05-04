import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  if (!code) {
    return NextResponse.json({ error: 'No code' }, { status: 400 })
  }

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
    return NextResponse.json({ error: data }, { status: 400 })
  }

  const appRedirect = `noire://auth?token=${data.access_token}`
  return NextResponse.redirect(appRedirect)
}
