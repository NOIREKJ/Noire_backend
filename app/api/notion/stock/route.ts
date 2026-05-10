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
      body: JSON.stringify({
        filter: {
          property: '자산분류',
          select: { does_not_equal: '그룹합계' }
        },
        page_size: 100,
      }),
    })

    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: 'Notion error' }, { status: 400 })

    const stocks = (data.results as any[]).map(page => {
      const p = page.properties
      return {
        id:           page.id,
        name:         p['계좌명']?.title?.[0]?.plain_text ?? '',
        ticker:       p['티커']?.rich_text?.[0]?.plain_text ?? '',
        currency:     p['통화']?.rich_text?.[0]?.plain_text ?? 'KRW',
        category:     p['자산분류']?.select?.name ?? '',
        broker:       p['증권사']?.select?.name ?? '',
        quantity:     p['수량']?.number ?? 0,
        avgPrice:     p['평균단가']?.number ?? 0,
        currentPrice: p['현재가']?.number ?? 0,
        principal:    p['투자원금']?.number ?? 0,
        evaluation:   p['평가금액']?.number ?? 0,
        profitAmount: p['수익금액']?.number ?? 0,
        profitRate:   p['수익률']?.number ?? 0,
        krwAmount:    p['원화 환산 금액']?.formula?.number ?? 0,
        updateDate:   p['업데이트']?.date?.start ?? '',
      }
    }).filter(s => s.name)

    // 요약 정보
    const totalKRW = stocks.reduce((sum, s) => sum + s.krwAmount, 0)
    const totalPrincipal = stocks.reduce((sum, s) => sum + s.principal, 0)
    const totalProfit = stocks.reduce((sum, s) => sum + s.profitAmount, 0)

    return NextResponse.json({
      stocks,
      summary: {
        totalKRW,
        totalPrincipal,
        totalProfit,
        profitRate: totalPrincipal > 0 ? (totalProfit / totalPrincipal) * 100 : 0,
      }
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
