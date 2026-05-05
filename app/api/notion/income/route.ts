import { NextRequest, NextResponse } from 'next/server'

const NOTION_VERSION = '2022-06-28'

export async function POST(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { dbId, item, amount, account } = await req.json()

    if (!dbId || !item || !amount) {
      return NextResponse.json({ error: 'dbId, item, amount 필수' }, { status: 400 })
    }

    const today = new Date().toISOString().split('T')[0]

    const properties: Record<string, any> = {
      '수입원':   { title: [{ text: { content: item } }] },
      '수입금액': { number: Number(amount) },
      '수입날짜': { date: { start: today } },
      '결제 상태': { status: { name: '결제완료' } },
    }

    // 계좌 (Relation - account page id 필요)
    if (account) {
      properties['계좌'] = { relation: [{ id: account }] }
    }

    const res = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: notionHeaders(token),
      body: JSON.stringify({
        parent: { database_id: dbId },
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
