import { NextRequest, NextResponse } from 'next/server'

const BASE_URL = process.env.KOREA_INVESTMENT_URL!

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type')

  // 토큰 발급
  const tokenRes = await fetch(`${BASE_URL}/oauth2/tokenP`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      appkey: process.env.KIS_APP_KEY,
      appsecret: process.env.KIS_APP_SECRET,
    }),
  })
  const { access_token } = await tokenRes.json()

  const kisHeaders = {
    'Content-Type': 'application/json',
    appkey: process.env.KIS_APP_KEY!,
    appsecret: process.env.KIS_APP_SECRET!,
    authorization: `Bearer ${access_token}`,
    custtype: 'P',
  }

  if (type === 'holdings') {
    const res = await fetch(
      `${BASE_URL}/uapi/domestic-stock/v1/trading/inquire-balance?CANO=${process.env.KIS_ACCOUNT_NO}&ACNT_PRDT_CD=${process.env.KIS_ACCOUNT_CODE}&AFHR_FLPR_YN=N&OFL_YN=N&INQR_DVSN=02&UNPR_DVSN=01&FUND_STTL_ICLD_YN=N&FNCG_AMT_AUTO_RDPT_YN=N&PRCS_DVSN=01&CTX_AREA_FK100=&CTX_AREA_NK100=`,
      { headers: { ...kisHeaders, tr_id: 'TTTC8434R' } }
    )
    return NextResponse.json(await res.json())
  }

  if (type === 'deposit') {
    const res = await fetch(
      `${BASE_URL}/uapi/domestic-stock/v1/trading/inquire-balance?CANO=${process.env.KIS_ACCOUNT_NO}&ACNT_PRDT_CD=${process.env.KIS_ACCOUNT_CODE}&AFHR_FLPR_YN=N&OFL_YN=N&INQR_DVSN=02&UNPR_DVSN=01&FUND_STTL_ICLD_YN=N&FNCG_AMT_AUTO_RDPT_YN=N&PRCS_DVSN=01&CTX_AREA_FK100=&CTX_AREA_NK100=`,
      { headers: { ...kisHeaders, tr_id: 'TTTC8434R' } }
    )
    return NextResponse.json(await res.json())
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}
