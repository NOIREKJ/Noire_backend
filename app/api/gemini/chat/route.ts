import { NextRequest, NextResponse } from 'next/server'

const MODEL = 'gemini-2.5-flash'
const SYSTEM = `너는 주인님의 만능 개인 비서 'NOIRE'야.
할 수 있는 일: 가계부 기록, 코인/주식 시세, 날씨, 재테크 상담, 일반 대화.
항상 한국어로 짧고 친근하게 대답해. 이모지를 적절히 사용해.`

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Gemini key missing' }, { status: 500 })

  try {
    const { message, history } = await req.json()
    if (!message) return NextResponse.json({ error: 'message 필수' }, { status: 400 })

    const contents = [
      ...(history ?? []),
      { role: 'user', parts: [{ text: message }] },
    ]

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents,
        }),
      }
    )

    const data = await res.json()
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '응답 실패'

    return NextResponse.json({ reply })

  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}