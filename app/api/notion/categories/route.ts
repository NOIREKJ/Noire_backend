import { NextRequest, NextResponse } from 'next/server'

const NOTION_VERSION = '2022-06-28'

export async function GET(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dbId = req.nextUrl.searchParams.get('dbId')
  if (!dbId) return NextResponse.json({ error: 'dbId 필수' }, { status: 400 })

  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: notionHeaders(token),
      body: JSON.stringify({ page_size: 100 }),
    })

    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: 'Notion error' }, { status: 400 })

    const categories = (data.results as any[]).map(page => ({
      id:   page.id,
      name: page.properties['지출 분류 카테고리']?.title?.[0]?.plain_text ?? '',
    })).filter(c => c.name)

    return NextResponse.json({ categories })

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
