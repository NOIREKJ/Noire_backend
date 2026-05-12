const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const MODEL = 'gemini-2.5-flash'

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>
    }
  }>
  error?: { message?: string }
}

export interface ChatHistoryItem {
  role: 'user' | 'ai'
  text: string
}

// 단일 메시지용 (이전 함수 유지 - 다른 곳에서 쓸지도 모르니)
export async function callGemini(user: string, system?: string): Promise<string> {
  return callGeminiWithHistory([], user, system)
}

// 대화 기록 포함 버전
export async function callGeminiWithHistory(
  history: ChatHistoryItem[],
  currentUserMessage: string,
  system?: string
): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set')
  }
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`
  
  // Gemini의 contents 형식으로 변환
  // role: 'user' or 'model'
  const contents = [
    ...history.map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }]
    })),
    {
      role: 'user',
      parts: [{ text: currentUserMessage }]
    }
  ]
  
  const body: any = { contents }
  if (system) {
    body.systemInstruction = { parts: [{ text: system }] }
  }
  
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Gemini API 오류 (${res.status}): ${errText}`)
  }
  
  const data: GeminiResponse = await res.json()
  
  if (data.error) {
    throw new Error(`Gemini 오류: ${data.error.message}`)
  }
  
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw new Error('Gemini 응답이 비어있어요')
  }
  
  return text.trim()
}