import { NextResponse } from 'next/server'
import { verifyAuth } from '@/app/lib/auth'
import { callGeminiWithHistory } from '@/app/lib/gemini'
import { supabaseAdmin } from '@/app/lib/supabase'

export async function POST(request: Request) {
  const auth = await verifyAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  
  // 새 입력: history (이전 메시지들) + 현재 메시지
  const history: Array<{ role: 'user' | 'ai', text: string }> = body.history || []
  const text = (body.text || '').trim()
  if (!text) {
    return NextResponse.json({ error: 'text가 필요해요' }, { status: 400 })
  }
  
  // 사용자의 카테고리/계좌 목록
  const [catRes, accRes] = await Promise.all([
    supabaseAdmin
      .from('categories')
      .select('id, name, type')
      .eq('user_id', auth.userId),
    supabaseAdmin
      .from('accounts')
      .select('id, name, type')
      .eq('user_id', auth.userId)
  ])
  
  const categories = catRes.data || []
  const accounts = accRes.data || []
  
  const categoryNames = categories.map(c => `${c.name}(${c.type})`).join(', ')
  const accountNames = accounts.map(a => a.name).join(', ')
  
  const systemPrompt = `너는 가계부 자동 분류 도우미야. 사용자의 메시지를 거래로 분류해서 반드시 JSON으로만 답해.

가능한 카테고리: ${categoryNames || '(없음)'}
가능한 계좌: ${accountNames || '(없음)'}

응답 형식 (다른 텍스트 없이 JSON만):
{
  "type": "income" 또는 "expense",
  "amount": 숫자,
  "category": "카테고리 이름" (위 목록 중 정확히 하나, 못 찾으면 null),
  "account": "계좌 이름" (위 목록 중 정확히 하나, 못 찾으면 null),
  "memo": "사용자가 적은 메모 또는 키워드",
  "confidence": 0~1 사이 숫자
}

규칙:
- "오천원", "5천원", "5,000원" 다 5000으로
- "만원" = 10000, "1.5만" = 15000
- 명확히 수입 아니면 expense
- "카드" 라고 하면 카드 종류 계좌 (위 목록에서) 매칭. 비슷한 키워드면 가장 가까운 거 선택
- 거래가 아닌 메시지면 amount를 0으로
- 대화 맥락이 있으면 그것도 고려. 이전에 거래 얘기 중이었고 사용자가 "5000원으로 바꿔" 같이 정정하면, 마지막 거래 정보를 가져와서 금액만 5000으로 갱신해서 응답
- 메모는 사용자 표현 그대로 간결하게`
  
  let aiText: string
  try {
    aiText = await callGeminiWithHistory(history, text, systemPrompt)
  } catch (e: any) {
    return NextResponse.json(
      { error: `AI 호출 실패: ${e.message}` },
      { status: 502 }
    )
  }
  
  const cleaned = aiText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  
  let parsed: any
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    return NextResponse.json(
      { error: 'AI 응답을 이해할 수 없어요', raw: aiText },
      { status: 502 }
    )
  }
  
  const matchedCategory = categories.find(
    c => c.name === parsed.category && c.type === parsed.type
  )
  const matchedAccount = accounts.find(a => a.name === parsed.account)
  
  return NextResponse.json({
    type: parsed.type,
    amount: Number(parsed.amount) || 0,
    memo: parsed.memo || '',
    confidence: Number(parsed.confidence) || 0,
    category_id: matchedCategory?.id ?? null,
    category_name: matchedCategory?.name ?? null,
    account_id: matchedAccount?.id ?? null,
    account_name: matchedAccount?.name ?? null
  })
}