import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get('city') ?? 'Seoul'
  const key  = process.env.OPENWEATHER_KEY

  if (!key) return NextResponse.json({ text: 'API key 없음' })

  try {
    const res  = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${key}&units=metric&lang=kr`
    )
    const d    = await res.json()
    const temp = d.main?.temp?.toFixed(1) ?? '-'
    const feel = d.main?.feels_like?.toFixed(1) ?? '-'
    const hum  = d.main?.humidity ?? '-'
    const desc = d.weather?.[0]?.description ?? ''
    const name = d.name ?? city
    const icon = desc.includes('맑') ? '☀️' :
                 desc.includes('구름') ? '☁️' :
                 desc.includes('비') ? '🌧️' :
                 desc.includes('눈') ? '❄️' : '🌤️'

    return NextResponse.json({
      text: `${icon} ${name} 날씨\n🌡️ ${temp}°C (체감 ${feel}°C)\n💧 습도 ${hum}%\n${desc}`
    })
  } catch {
    return NextResponse.json({ text: '날씨 조회 실패' })
  }
}