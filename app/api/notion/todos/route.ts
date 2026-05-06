import { NextRequest, NextResponse } from 'next/server'

const NOTION_VERSION = '2022-06-28'

function getToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') ?? ''
  return auth.startsWith('Bearer ') ? auth.slice(7) : null
}

function notionHeaders(token: string) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VERSION,
  }
}

// GET: 할일 목록 조회 (미완료만)
export async function GET(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 })
  
  const dbId = req.nextUrl.searchParams.get('dbId')
  if (!dbId) return NextResponse.json({ error: 'dbId required' }, { status: 400 })
  
  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: notionHeaders(token),
      body: JSON.stringify({
        filter: {
          property: '완료',
          checkbox: { equals: false }
        },
        sorts: [{ property: '마감일', direction: 'ascending' }],
        page_size: 50
      }),
    })
    
    const data = await res.json()
    if (!res.ok) {
      console.error('Todo fetch error:', JSON.stringify(data))
      return NextResponse.json({ error: data.message ?? 'Notion error' }, { status: 400 })
    }
    
    const todos = (data.results as any[]).map(page => {
      const p = page.properties
      return {
        id: page.id,
        title:    p['To-do']?.title?.[0]?.plain_text ?? '',
        isDone:   p['완료']?.checkbox ?? false,
        priority: p['중요도']?.select?.name ?? '',
        urgency:  p['긴급도']?.select?.name ?? '',
        label:    p['라벨']?.select?.name ?? '',
        dueDate:  p['마감일']?.date?.start ?? '',
      }
    })
    
    return NextResponse.json({ todos })
  } catch (e: any) {
    console.error('Todo server error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST: 할일 추가
export async function POST(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 })
  
  try {
    const { dbId, title, priority, urgency, label, dueDate } = await req.json()
    if (!dbId || !title) {
      return NextResponse.json({ error: 'dbId, title required' }, { status: 400 })
    }
    
    const props: any = {
      'To-do': { title: [{ text: { content: title } }] },
      '완료': { checkbox: false }
    }
    
    if (priority) props['중요도'] = { select: { name: priority } }
    if (urgency)  props['긴급도'] = { select: { name: urgency } }
    if (label)    props['라벨']   = { select: { name: label } }
    if (dueDate)  props['마감일'] = { date: { start: dueDate } }
    
    const res = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: notionHeaders(token),
      body: JSON.stringify({
        parent: { database_id: dbId },
        properties: props
      }),
    })
    
    const data = await res.json()
    if (!res.ok) {
      console.error('Todo add error:', JSON.stringify(data))
      return NextResponse.json({ error: data.message ?? 'Notion error' }, { status: 400 })
    }
    
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('Todo server error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PATCH: 할일 토글/삭제
export async function PATCH(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 })
  
  try {
    const { pageId, isDone, archived } = await req.json()
    if (!pageId) return NextResponse.json({ error: 'pageId required' }, { status: 400 })
    
    const body: any = archived === true
      ? { archived: true }
      : { properties: { '완료': { checkbox: isDone } } }
    
    const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: 'PATCH',
      headers: notionHeaders(token),
      body: JSON.stringify(body),
    })
    
    const data = await res.json()
    if (!res.ok) {
      console.error('Todo update error:', JSON.stringify(data))
      return NextResponse.json({ error: data.message ?? 'Notion error' }, { status: 400 })
    }
    
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('Todo server error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}