import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type') // holdings, deposit

  // 1. 토큰 발급
  const tokenRes = await fetch(
    `${process.env.KOREA_INVESTMENT_URL}/oauth2/tokenP`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        appkey: process.env.KOREA_INVESTMENT_REAL_KEY,
        appsecret: process.env.KOREA_INVESTMENT_REAL_SECRET,
      }),
    }
  )
  const { access_token } = await tokenRes.json()

  // 2. 보유주식 조회
  if (type === 'holdings') {
    const res = await fetch(
      `${process.env.KOREA_INVESTMENT_URL}/uapi/domestic-stock/v1/trading/inquire-balance?CANO=${process.env.KIS_ACCOUNT_NO}&ACNT_PRDT_CD=01&AFHR_FLPR_YN=N&OFL_YN=N&INQR_DVSN=02&UNPR_DVSN=01&FUND_STTL_ICLD_YN=N&FNCG_AMT_AUTO_RDPT_YN=N&PRCS_DVSN=01&CTX_AREA_FK100=&CTX_AREA_NK100=`,
      {
        headers: {
          'Content-Type': 'application/json',
          appkey: process.env.KOREA_INVESTMENT_REAL_KEY!,
          appsecret: process.env.KOREA_INVESTMENT_REAL_SECRET!,
          authorization: `Bearer ${access_token}`,
          tr_id: 'TTTC8434R',
          custtype: 'P',
        },
      }
    )
    const data = await res.json()
    return NextResponse.json(data)
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}
