import { NextRequest, NextResponse } from 'next/server'

const NOTION_VERSION = '2022-06-28'

// Net Worth History 조회
export async function GET(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const historyDbId = req.nextUrl.searchParams.get('historyDbId')
  if (!historyDbId) return NextResponse.json({ error: 'historyDbId 필수' }, { status: 400 })

  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${historyDbId}/query`, {
      method: 'POST',
      headers: notionHeaders(token),
      body: JSON.stringify({
        sorts: [{ property: '날짜', direction: 'descending' }],
        page_size: 24, // 최근 24개월
      }),
    })

    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: 'Notion error' }, { status: 400 })

    const history = (data.results as any[]).map(page => {
      const p = page.properties
      return {
        id:        page.id,
        title:     p['기준일']?.title?.[0]?.plain_text ?? '',
        cash:      p['현금']?.number ?? 0,
        invest:    p['투자자산']?.number ?? 0,
        total:     p['총자산']?.formula?.number ?? 0,
        prevTotal: p['이전달 총자산']?.number ?? 0,
        change:    p['증감']?.formula?.number ?? 0,
        trend:     p['증가율 추세']?.formula?.string ?? '',
        date:      p['날짜']?.date?.start ?? '',
      }
    }).filter(h => h.title)

    return NextResponse.json({ history })

  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// Net Worth 스냅샷 추가
export async function POST(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { historyDbId, cash, invest } = await req.json()

    if (!historyDbId) {
      return NextResponse.json({ error: 'historyDbId 필수' }, { status: 400 })
    }

    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const title = `${now.getFullYear()}년 ${String(now.getMonth() + 1).padStart(2, '0')}월`

    // 이전달 총자산 가져오기
    const prevRes = await fetch(`https://api.notion.com/v1/databases/${historyDbId}/query`, {
      method: 'POST',
      headers: notionHeaders(token),
      body: JSON.stringify({
        sorts: [{ property: '날짜', direction: 'descending' }],
        page_size: 1,
      }),
    })
    const prevData = await prevRes.json()
    const prevTotal = prevData.results?.[0]?.properties?.['총자산']?.formula?.number ?? 0

    const properties: Record<string, any> = {
      '기준일':     { title: [{ text: { content: title } }] },
      '현금':       { number: Number(cash) || 0 },
      '투자자산':   { number: Number(invest) || 0 },
      '이전달 총자산': { number: prevTotal },
      '날짜':       { date: { start: today } },
    }

    const res = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: notionHeaders(token),
      body: JSON.stringify({
        parent: { database_id: historyDbId },
        properties,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      return NextResponse.json({ error: err }, { status: 400 })
    }

    return NextResponse.json({ success: true })

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
