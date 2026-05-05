import { NextRequest, NextResponse } from 'next/server'

const NOTION_VERSION = '2022-06-28'

export async function POST(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { dbId, item, amount, gubun, account, category, categoryDbId } = await req.json()

    if (!dbId || !item || !amount) {
      return NextResponse.json({ error: 'dbId, item, amount 필수' }, { status: 400 })
    }

    const today = new Date().toISOString().split('T')[0]

    const properties: Record<string, any> = {
      '지출 내용': { title: [{ text: { content: item } }] },
      '지출 금액': { number: Number(amount) },
      '지출 날짜': { date: { start: today } },
      '구분':     { select: { name: gubun || '변동' } },
      '결제 상태': { status: { name: '결제완료' } },
    }

    // 카테고리 (Relation - category page id 필요)
    if (category && categoryDbId) {
      const catId = await findCategoryId(token, categoryDbId, category)
      if (catId) {
        properties['지출 카테고리'] = { relation: [{ id: catId }] }
      }
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

// 카테고리 이름으로 page id 찾기
async function findCategoryId(token: string, categoryDbId: string, name: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${categoryDbId}/query`, {
      method: 'POST',
      headers: notionHeaders(token),
      body: JSON.stringify({
        filter: {
          property: '지출 분류 카테고리',
          title: { equals: name }
        }
      })
    })
    const data = await res.json()
    return data.results?.[0]?.id ?? null
  } catch {
    return null
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
