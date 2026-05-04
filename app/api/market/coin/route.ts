import { NextRequest, NextResponse } from 'next/server'

const COIN_MAP: Record<string, string> = {
  '비트코인': 'bitcoin',  'BTC':  'bitcoin',
  '이더리움': 'ethereum', 'ETH':  'ethereum',
  '리플':     'ripple',   'XRP':  'ripple',
  '솔라나':   'solana',   'SOL':  'solana',
  '도지':     'dogecoin', 'DOGE': 'dogecoin',
  '에이다':   'cardano',  'ADA':  'cardano',
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q') ?? ''
  const coinId = Object.entries(COIN_MAP).find(([k]) => query.includes(k))?.[1] ?? 'bitcoin'

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=krw,usd&include_24hr_change=true`
    )
    const data = await res.json()
    const coin = data[coinId]

    const krw   = coin?.krw ?? 0
    const usd   = coin?.usd ?? 0
    const chg   = coin?.krw_24h_change ?? 0
    const sign  = chg >= 0 ? '+' : ''
    const arrow = chg >= 0 ? '📈' : '📉'
    const name  = Object.entries(COIN_MAP).find(([, v]) => v === coinId)?.[0] ?? query

    return NextResponse.json({
      text: `${arrow} ${name}\n₩${krw.toLocaleString()} | $${usd.toFixed(2)}\n24h: ${sign}${chg.toFixed(2)}%`
    })
  } catch {
    return NextResponse.json({ text: '코인 시세 조회 실패' })
  }
}