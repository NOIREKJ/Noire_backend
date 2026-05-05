import { NextRequest, NextResponse } from 'next/server'

const NOTION_VERSION = '2022-06-28'

export async function GET(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dbId  = req.nextUrl.searchParams.get('dbId')
  const year  = parseInt(req.nextUrl.searchParams.get('year')  ?? '')
  const month = parseInt(req.nextUrl.searchParams.get('month') ?? '')

  if (!dbId) return NextResponse.json({ error: 'dbId 필수' }, { status: 400 })

  const now = new Date()
  const y = isNaN(year)  ? now.getFullYear()   : year
  const m = isNaN(month) ? now.getMonth() + 1  : month

  const start   = `${y}-${String(m).padStart(2, '0')}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const end     = `${y}-${String(m).padStart(2, '0')}-${lastDay}`

  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: notionHeaders(token),
      body: JSON.stringify({
        filter: {
          and: [
            { property: '지출 날짜', date: { on_or_after:  start } },
            { property: '지출 날짜', date: { on_or_before: end   } },
          ],
        },
        sorts: [{ property: '지출 날짜', direction: 'descending' }],
        page_size: 100,
      }),
    })

    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: 'Notion error' }, { status: 400 })

    const items = (data.results as any[]).map(page => {
      const p = page.properties
      return {
        name:     p['지출 내용']?.title?.[0]?.plain_text ?? '',
        amount:   p['지출 금액']?.number ?? 0,
        category: p['지출 카테고리']?.relation?.[0]?.id ?? '',
        date:     p['지출 날짜']?.date?.start ?? '',
        gubun:    p['구분']?.select?.name ?? '',
      }
    }).filter(i => i.name && i.amount > 0)

    const total = items.reduce((sum, i) => sum + i.amount, 0)

    return NextResponse.json({ total, items, year: y, month: m })

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
