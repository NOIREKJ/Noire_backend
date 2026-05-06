import { NextRequest, NextResponse } from 'next/server'

const NOTION_VERSION = '2022-06-28'

// NOIRE 새 템플릿 DB 이름들
const DB_NAMES: Record<string, string[]> = {
  expense:  ['expenses db', 'expense db', '지출 db', '지출'],
  income:   ['income db', '수입 db', '수입'],
  accounts: ['accounts db', '계좌 db', '계좌'],
  category: ['category db', 'categories db', '카테고리 db', '카테고리'],
  stock:    ['stock db', 'stocks db', '주식 db', '주식'],
  networth: ['net worth db', 'networth db', '자산 db', '순자산 db'],
  todos:    ['todo db', 'todos db', 'to-do db', '할일 db', '할일'],
}

export async function GET(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const res = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: notionHeaders(token),
      body: JSON.stringify({
        filter: { value: 'database', property: 'object' },
        page_size: 100,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      console.error('Notion search error:', JSON.stringify(data))
      return NextResponse.json({ error: 'Notion API error' }, { status: 400 })
    }

    const results = data.results as any[]
    const found: Record<string, string> = {}
    const allFoundTitles: string[] = []

    for (const db of results) {
      const title = db.title?.[0]?.plain_text ?? ''
      if (!title) continue
      
      allFoundTitles.push(title)
      const normTitle = title.toLowerCase().trim()
      
      // 각 DB 키별로 매칭되는 이름 배열 검사
      for (const [key, names] of Object.entries(DB_NAMES)) {
        if (found[key]) continue  // 이미 찾았으면 패스
        
        for (const name of names) {
          if (normTitle === name.toLowerCase().trim()) {
            found[key] = db.id
            break
          }
        }
      }
    }

    const allFound = Object.keys(DB_NAMES).every(k => found[k])
    
    console.log('=== DB Search ===')
    console.log('All DBs found in workspace:', allFoundTitles)
    console.log('Matched:', found)
    console.log('Missing keys:', Object.keys(DB_NAMES).filter(k => !found[k]))

    return NextResponse.json({
      found,
      allFound,
      allTitles: allFoundTitles,  // 디버그용
      missing: Object.keys(DB_NAMES).filter(k => !found[k]),
    })

  } catch (e: any) {
    console.error('databases server error:', e)
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