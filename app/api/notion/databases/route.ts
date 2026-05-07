import { NextRequest, NextResponse } from 'next/server'

const NOTION_VERSION = '2022-06-28'

const DB_NAMES: Record<string, string[]> = {
  expense:         ['expenses db', 'expense db', '지출 db', '지출'],
  income:          ['income db', '수입 db', '수입'],
  accounts:        ['accounts db', '계좌 db', '계좌'],
  category:        ['category db', 'categories db', '카테고리 db', '카테고리'],
  stock:           ['stock db', 'stocks db', '주식 db', '주식'],
  networth:        ['net worth db', 'networth db', '자산 db', '순자산 db'],
  networthHistory: ['📈 net worth history', 'net worth history', 'networth history', '자산 추이', '자산추이'],
  todos:           ['todo db', 'todos db', 'to-do db', '할일 db', '할일'],
}


export async function GET(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // 1단계: search API로 모든 DB 가져오기
    const allDbs = await searchAll(token, 'database')
    
    // 2단계: 모든 페이지도 가져오기
    const allPages = await searchAll(token, 'page')
    
    console.log(`Total: ${allDbs.length} DBs, ${allPages.length} pages`)

    // 3단계: NOIRE 페이지 찾기 + 그 안의 모든 자식 DB 재귀 탐색
    const childDbs: any[] = []
    const visited = new Set<string>()
    
    const noirePage = allPages.find((p: any) => {
      const title = p.properties?.title?.title?.[0]?.plain_text 
                 ?? p.properties?.Name?.title?.[0]?.plain_text 
                 ?? ''
      const t = title.toLowerCase()
      return (t.includes('noire') && (t.includes('가계부') || t.includes('템플릿'))) || t.includes('배포용')
    })

    if (noirePage) {
      console.log('Found NOIRE page:', noirePage.id)
      // 재귀 탐색: NOIRE 페이지부터 모든 하위 페이지의 DB 찾기
      await collectChildDatabases(token, noirePage.id, childDbs, visited, 0)
      console.log('Total child DBs found via recursion:', childDbs.length)
      console.log('Child DB titles:', childDbs.map(d => d.title))
    }

    // 4단계: 매칭
    const found: Record<string, string> = {}
    const allTitles: string[] = []

    const dbCandidates = [
      ...allDbs.map((d: any) => ({ id: d.id, title: d.title?.[0]?.plain_text ?? '' })),
      ...childDbs,
    ]

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
    console.log('All DBs:', allTitles)
    console.log('Matched:', found)
    console.log('Missing:', Object.keys(DB_NAMES).filter(k => !found[k]))

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

// search API 페이지네이션 헬퍼
async function searchAll(token: string, type: 'page' | 'database'): Promise<any[]> {
  const all: any[] = []
  let cursor: string | undefined = undefined
  let hasMore = true

  while (hasMore) {
    const body: any = {
      filter: { value: type, property: 'object' },
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
      console.error('search error:', JSON.stringify(data))
      break
    }

    all.push(...(data.results as any[]))
    hasMore = data.has_more === true
    cursor = data.next_cursor
  }

  return all
}

// 페이지의 자식 블록 재귀 탐색해서 모든 child_database 찾기
async function collectChildDatabases(
  token: string,
  pageId: string,
  result: any[],
  visited: Set<string>,
  depth: number
): Promise<void> {
  if (visited.has(pageId) || depth > 5) return  // 무한루프/너무 깊은 탐색 방지
  visited.add(pageId)

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
      console.error(`children error for ${pageId}:`, JSON.stringify(data))
      return
    }

    for (const block of (data.results as any[])) {
      if (block.type === 'child_database') {
        result.push({
          id: block.id,
          title: block.child_database?.title ?? '',
        })
      } else if (block.type === 'child_page') {
        // 자식 페이지 재귀 탐색
        await collectChildDatabases(token, block.id, result, visited, depth + 1)
      } else if (block.has_children) {
        // toggle, callout 같은 컨테이너 블록도 탐색
        await collectChildDatabases(token, block.id, result, visited, depth + 1)
      }
    }

    hasMore = data.has_more === true
    cursor = data.next_cursor
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
