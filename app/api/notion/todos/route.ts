import { NextRequest, NextResponse } from 'next/server'

const NOTION_VERSION = '2022-06-28'

// 할일 목록 조회
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
        sorts: [{ property: '마감일', direction: 'ascending' }],
        page_size: 100,
      }),
    })

    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: 'Notion error' }, { status: 400 })

    const todos = (data.results as any[]).map(page => {
      const p = page.properties
      return {
        id:       page.id,
        title:    p['할 일']?.title?.[0]?.plain_text ?? '',
        isDone:   p['완료']?.checkbox ?? false,
        priority: p['우선순위']?.select?.name ?? '',
        dueDate:  p['마감일']?.date?.start ?? '',
      }
    }).filter(t => t.title)

    return NextResponse.json({ todos })

  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// 할일 추가
export async function POST(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { dbId, title, priority, dueDate } = await req.json()
    if (!dbId || !title) return NextResponse.json({ error: 'dbId, title 필수' }, { status: 400 })

    const properties: Record<string, any> = {
      '할 일': { title: [{ text: { content: title } }] },
      '완료':  { checkbox: false },
    }
    if (priority) properties['우선순위'] = { select: { name: priority } }
    if (dueDate)  properties['마감일']   = { date: { start: dueDate } }

    const res = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: notionHeaders(token),
      body: JSON.stringify({ parent: { database_id: dbId }, properties }),
    })

    if (!res.ok) return NextResponse.json({ error: 'Notion error' }, { status: 400 })
    return NextResponse.json({ success: true })

  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// 할일 수정 (완료 토글 / 삭제)
export async function PATCH(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { pageId, isDone, archived } = await req.json()
    if (!pageId) return NextResponse.json({ error: 'pageId 필수' }, { status: 400 })

    const body: Record<string, any> = {}
    if (archived !== undefined) {
      body.archived = archived
    } else {
      body.properties = { '완료': { checkbox: isDone } }
    }

    const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: 'PATCH',
      headers: notionHeaders(token),
      body: JSON.stringify(body),
    })

    if (!res.ok) return NextResponse.json({ error: 'Notion error' }, { status: 400 })
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