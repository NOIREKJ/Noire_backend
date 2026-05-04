import { NextRequest, NextResponse } from 'next/server'

const NOTION_VERSION = '2022-06-28'

export async function GET(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dbId = req.nextUrl.searchParams.get('dbId')
  const name = req.nextUrl.searchParams.get('name')

  if (!dbId) return NextResponse.json({ error: 'dbId 필수' }, { status: 400 })

  try {
    const body: Record<string, any> = { page_size: 100 }

    if (name) {
      body.filter = {
        property: '계좌명',
        title: { equals: name },
      }
    }

    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: notionHeaders(token),
      body: JSON.stringify(body),
    })

    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: 'Notion error' }, { status: 400 })

    const accounts = (data.results as any[]).map(page => {
      const p = page.properties
      return {
        id:      page.id,
        name:    p['계좌명']?.title?.[0]?.plain_text ?? '',
        balance: p['잔액']?.number ?? 0,
        type:    p['종류']?.select?.name ?? '',
      }
    }).filter(a => a.name)

    return NextResponse.json({ accounts })

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