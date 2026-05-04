import { NextRequest, NextResponse } from 'next/server'

const MODEL = 'gemini-2.5-flash'

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Gemini key missing' }, { status: 500 })

  try {
    const { text } = await req.json()
    if (!text) return NextResponse.json({ error: 'text 필수' }, { status: 400 })

    const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })

    const prompt = `현재 날짜/시각: ${now}
사용자 문장: "${text}"

intent 분류:
- expense: 돈 썼어, 결제, 샀어, 지출
- income: 돈 받았어, 입금, 월급, 수입
- balance: 잔액, 잔고, 얼마있어
- weather: 날씨, 기온, 비
- stock: 주식 시세, 코스피, 나스닥
- coin: 비트코인, 이더리움, 코인 시세
- todo_add: 할일 추가, ~해야해, ~할거야
- monthly: 이번달 지출, 월별 지출, 얼마 썼어
- chat: 그 외

순수 JSON만 반환 (코드블록 없이):
{"intent":"...","item":null,"amount":null,"account":null,"category":null,"query":null,"month":null}`

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        }),
      }
    )

    const data = await res.json()
    let raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    raw = raw.replace(/```json|```/g, '').trim()

    try {
      const parsed = JSON.parse(raw)
      return NextResponse.json(parsed)
    } catch {
      return NextResponse.json({ intent: 'chat' })
    }

  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}