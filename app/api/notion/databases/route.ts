import { NextRequest, NextResponse } from 'next/server'

const NOTION_VERSION = '2022-06-28'

const DB_NAMES = {
  expense:  '지출',
  income:   '수입',
  accounts: '계좌',
  todos:    '할일',
}

export async function GET(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const res = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: notionHeaders(token),
      body: JSON.stringify({
        filter: { value: 'database', property: 'object' },
        page_size: 50,
      }),
    })

    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: 'Notion API error' }, { status: 400 })

    const results = data.results as any[]
    const found: Record<string, string> = {}

    for (const db of results) {
      const title = db.title?.[0]?.plain_text ?? ''
      for (const [key, name] of Object.entries(DB_NAMES)) {
        if (title === name) found[key] = db.id
      }
    }

    const allFound = Object.keys(DB_NAMES).every(k => found[k])

    return NextResponse.json({
      found,
      allFound,
      missing: Object.entries(DB_NAMES)
        .filter(([k]) => !found[k])
        .map(([, name]) => name),
    })

  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

function getToken(req: NextRequest) {
  const auth = req.headers.get('Authorization') ?? ''
  return auth.startsWith('Bearer ') ? auth.slice(7) : null
}

function notionHeaders(token: string) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VERSION,
  }
}