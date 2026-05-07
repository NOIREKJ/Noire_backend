import { NextRequest, NextResponse } from 'next/server'

const NOTION_VERSION = '2022-06-28'

export async function GET(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dbId = req.nextUrl.searchParams.get('dbId')
  const name = req.nextUrl.searchParams.get('name')

  if (!dbId) return NextResponse.json({ error: 'dbId 필수' }, { status: 400 })

  try {
    const queryBody: any = {
      page_size: 100,
    }

    // 이름 필터 (있을 때만)
    if (name) {
      queryBody.filter = {
        property: '계좌명',
        title: { contains: name },
      }
    }

    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: notionHeaders(token),
      body: JSON.stringify(queryBody),
    })

    const data = await res.json()
    if (!res.ok) {
      console.error('Notion accounts error:', JSON.stringify(data))
      return NextResponse.json({ error: data.message ?? 'Notion error' }, { status: 400 })
    }

    const accounts = (data.results as any[]).map(page => {
      const p = page.properties
      
      // 계좌명 (Title)
      const accName = p['계좌명']?.title?.[0]?.plain_text ?? ''
      
      // 계좌번호 (Text)
      const accNumber = p['계좌번호']?.rich_text?.[0]?.plain_text ?? ''
      
      // 자산분류 (Select)
      const type = p['자산분류']?.select?.name ?? ''
      
      // 시작금액 (Number)
      const startAmount = p['시작금액']?.number ?? 0
      
     // 잔고 (Number 또는 Formula 둘 다 지원)
     let balance = 0
    if (p['잔고']?.type === 'number') {
     balance = p['잔고']?.number ?? 0
    } else if (p['잔고']?.type === 'formula') {
     balance = p['잔고']?.formula?.number ?? 0
    }

      
      // 현재 잔고 (Formula - string 타입, 이모지 포함)
      let balanceText = ''
      const balanceTextFormula = p['현재 잔고']?.formula
      if (balanceTextFormula?.type === 'string') {
        balanceText = balanceTextFormula.string ?? ''
      }
      
      return {
        id: page.id,
        name: accName,
        balance,
        balanceText,
        type,
        accountNumber: accNumber,
        startAmount,
      }
    }).filter(a => a.name)

    return NextResponse.json({ accounts })

  } catch (e: any) {
    console.error('accounts server error:', e)
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