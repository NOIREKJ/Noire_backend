import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

function getToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

// GET: 할일 목록 조회 (미완료만)
export async function GET(req: NextRequest) {
  const token = getToken(req);
  if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
  
  const dbId = req.nextUrl.searchParams.get('dbId');
  if (!dbId) return NextResponse.json({ error: 'dbId required' }, { status: 400 });
  
  try {
    const notion = new Client({ auth: token });
    const response = await notion.databases.query({
      database_id: dbId,
      filter: {
        property: '완료',
        checkbox: { equals: false }
      },
      sorts: [{ property: '마감일', direction: 'ascending' }],
      page_size: 50
    });
    
    const todos = response.results.map((page: any) => {
      const props = page.properties;
      const title = props['To-do']?.title?.[0]?.plain_text || '';
      const isDone = props['완료']?.checkbox || false;
      const priority = props['중요도']?.select?.name || '';
      const urgency = props['긴급도']?.select?.name || '';
      const label = props['라벨']?.select?.name || '';
      const dueDate = props['마감일']?.date?.start || '';
      
      return {
        id: page.id,
        title,
        isDone,
        priority,
        urgency,
        label,
        dueDate
      };
    });
    
    return NextResponse.json({ todos });
  } catch (e: any) {
    console.error('Todo fetch error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: 할일 추가
export async function POST(req: NextRequest) {
  const token = getToken(req);
  if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
  
  try {
    const { dbId, title, priority, urgency, label, dueDate } = await req.json();
    if (!dbId || !title) {
      return NextResponse.json({ error: 'dbId, title required' }, { status: 400 });
    }
    
    const notion = new Client({ auth: token });
    
    const props: any = {
      'To-do': { title: [{ text: { content: title } }] },
      '완료': { checkbox: false }
    };
    
    if (priority) props['중요도'] = { select: { name: priority } };
    if (urgency)  props['긴급도'] = { select: { name: urgency } };
    if (label)    props['라벨']   = { select: { name: label } };
    if (dueDate)  props['마감일'] = { date: { start: dueDate } };
    
    await notion.pages.create({
      parent: { database_id: dbId },
      properties: props
    });
    
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('Todo add error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PATCH: 할일 토글/삭제
export async function PATCH(req: NextRequest) {
  const token = getToken(req);
  if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
  
  try {
    const { pageId, isDone, archived } = await req.json();
    if (!pageId) return NextResponse.json({ error: 'pageId required' }, { status: 400 });
    
    const notion = new Client({ auth: token });
    
    if (archived === true) {
      await notion.pages.update({ page_id: pageId, archived: true });
    } else {
      await notion.pages.update({
        page_id: pageId,
        properties: {
          '완료': { checkbox: isDone }
        }
      });
    }
    
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('Todo update error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
