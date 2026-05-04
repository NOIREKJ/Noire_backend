import { NextRequest, NextResponse } from 'next/server'

const NOTION_VERSION = '2022-06-28'

export async function POST(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { dbId, item, amount, category, account, memo } = await req.json()

    if (!dbId || !item || !amount) {
      return NextResponse.json({ error: 'dbId, item, amount 필수' }, { status: 400 })
    }

    const today = new Date().toISOString().split('T')[0]

    const properties: Record<string, any> = {
      '항목': { title: [{ text: { content: item } }] },
      '금액': { number: Number(amount) },
      '날짜': { date: { start: today } },
    }
    if (category) properties['카테고리'] = { select: { name: category } }
    if (account)  properties['계좌']     = { select: { name: account } }
    if (memo)     properties['메모']     = { rich_text: [{ text: { content: memo } }] }

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