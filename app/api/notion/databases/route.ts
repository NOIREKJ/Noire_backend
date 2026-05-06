import { NextRequest, NextResponse } from 'next/server'

const NOTION_VERSION = '2022-06-28'

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
    // 1단계: search API로 모든 DB 가져오기 (start_cursor로 페이지네이션)
    const allDbs: any[] = []
    let cursor: string | undefined = undefined
    let hasMore = true

    while (hasMore) {
      const body: any = {
        filter: { value: 'database', property: 'object' },
        page_size: 100,
      }
      if (cursor) body.start_cursor = cursor

      const res = await fetch('https://api.notion.com/v1/search', {
        method: 'POST',
        headers: notionHeaders(token),
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) {
        console.error('Notion search error:', JSON.stringify(data))
        return NextResponse.json({ error: 'Notion API error' }, { status: 400 })
      }

      allDbs.push(...(data.results as any[]))
      hasMore = data.has_more === true
      cursor = data.next_cursor
    }

    // 2단계: 페이지도 검색해서 부모 페이지 찾기
    const allPages: any[] = []
    cursor = undefined
    hasMore = true

    while (hasMore) {
      const body: any = {
        filter: { value: 'page', property: 'object' },
        page_size: 100,
      }
      if (cursor) body.start_cursor = cursor

      const res = await fetch('https://api.notion.com/v1/search', {
        method: 'POST',
        headers: notionHeaders(token),
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (res.ok) {
        allPages.push(...(data.results as any[]))
        hasMore = data.has_more === true
        cursor = data.next_cursor
      } else {
        hasMore = false
      }
    }

    // 3단계: 부모 페이지에서 child_database 블록 찾기
    const noirePage = allPages.find((p: any) => {
      const title = p.properties?.title?.title?.[0]?.plain_text 
                 ?? p.properties?.Name?.title?.[0]?.plain_text 
                 ?? ''
      return title.includes('NOIRE') && title.includes('가계부')
    })

    let childDbs: any[] = []
    if (noirePage) {
      console.log('Found NOIRE page:', noirePage.id)
      // 부모 페이지의 children 블록 가져오기
      childDbs = await fetchChildDatabases(token, noirePage.id)
      console.log('Child DBs in NOIRE page:', childDbs.map(d => ({ id: d.id, title: d.title })))
    }

    // 4단계: 매칭
    const found: Record<string, string> = {}
    const allTitles: string[] = []
    
    // search 결과 + child blocks 결과 합침
    const dbCandidates = [
      ...allDbs.map(d => ({ id: d.id, title: d.title?.[0]?.plain_text ?? '' })),
      ...childDbs,
    ]

    // 중복 제거
    const seen = new Set<string>()
    const uniqueDbs = dbCandidates.filter(d => {
      if (seen.has(d.id)) return false
      seen.add(d.id)
      return true
    })

    for (const db of uniqueDbs) {
      if (!db.title) continue
      allTitles.push(db.title)
      const normTitle = db.title.toLowerCase().trim()

      for (const [key, names] of Object.entries(DB_NAMES)) {
        if (found[key]) continue
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
    console.log('All DBs found:', allTitles)
    console.log('Matched:', found)
    console.log('Missing keys:', Object.keys(DB_NAMES).filter(k => !found[k]))

    return NextResponse.json({
      found,
      allFound,
      allTitles,
      missing: Object.keys(DB_NAMES).filter(k => !found[k]),
    })

  } catch (e: any) {
    console.error('databases server error:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// 페이지 안의 child_database 블록을 모두 찾기
async function fetchChildDatabases(token: string, pageId: string): Promise<any[]> {
  const dbs: any[] = []
  let cursor: string | undefined = undefined
  let hasMore = true

  while (hasMore) {
    const url = new URL(`https://api.notion.com/v1/blocks/${pageId}/children`)
    url.searchParams.set('page_size', '100')
    if (cursor) url.searchParams.set('start_cursor', cursor)

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: notionHeaders(token),
    })

    const data = await res.json()
    if (!res.ok) {
      console.error('children fetch error:', JSON.stringify(data))
      break
    }

    for (const block of (data.results as any[])) {
      if (block.type === 'child_database') {
        dbs.push({
          id: block.id,
          title: block.child_database?.title ?? '',
        })
      }
    }

    hasMore = data.has_more === true
    cursor = data.next_cursor
  }

  return dbs
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
