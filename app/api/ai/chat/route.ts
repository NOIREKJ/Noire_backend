import { NextResponse } from 'next/server'
import { verifyAuth } from '@/app/lib/auth'
import { callGeminiWithHistory } from '@/app/lib/gemini'

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
  
  const history: Array<{ role: 'user' | 'ai', text: string }> = body.history || []
  const message = (body.message || '').trim()
  if (!message) {
    return NextResponse.json({ error: 'message가 필요해요' }, { status: 400 })
  }
  
  const systemPrompt = `너는 NOIRE라는 개인 비서 앱의 AI야.
사용자의 자산, 가계부, 일정을 도와주는 친근하고 차분한 톤의 비서.
한국어로 짧고 명확하게 답해.

규칙:
- 실시간 정보 (오늘 날씨, 지금 주식 시세 등) 는 모른다고 솔직히 답하기
- 거래 입력처럼 보이는 메시지가 오면 정확한 분류는 분류 시스템이 처리하니, 너는 그냥 자연스럽게 대화만
- 사용자의 이전 메시지 맥락을 고려해서 자연스럽게 이어가기`
  
  let reply: string
  try {
    reply = await callGeminiWithHistory(history, message, systemPrompt)
  } catch (e: any) {
    return NextResponse.json(
      { error: `AI 호출 실패: ${e.message}` },
      { status: 502 }
    )
  }
  
  return NextResponse.json({ reply })
}