import { NextResponse } from 'next/server'
import { verifyAuth } from '@/app/lib/auth'
import { getKISAccessToken } from '@/app/lib/kisAuth'

// GET /api/kis/quote/[ticker]
export async function GET(
  request: Request,
  context: { params: Promise<{ ticker: string }> }
) {
  // 1. 인증
  const authResult = await verifyAuth(request)
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }
  
  // 2. 종목코드 검증
  const { ticker } = await context.params
  if (!ticker || !/^\d{6}$/.test(ticker)) {
    return NextResponse.json(
      { error: '종목코드는 6자리 숫자여야 해요' },
      { status: 400 }
    )
  }
  
  // 3. 한투 토큰 확보
  let token: string
  let baseUrl: string
  let appKey: string
  let appSecret: string
  try {
    const kis = await getKISAccessToken(authResult.userId)
    token = kis.accessToken
    baseUrl = kis.baseUrl
    appKey = kis.credentials.app_key
    appSecret = kis.credentials.app_secret
  } catch (e: any) {
    // 한투 미연동은 명확한 코드로
    if (e.code === 'KIS_NOT_CONNECTED') {
      return NextResponse.json(
        { error: e.message, code: 'KIS_NOT_CONNECTED' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: e.message ?? 'KIS 인증 실패' },
      { status: 500 }
    )
  }
  
  // 4. 공통 헤더
  const commonHeaders = {
    'Content-Type': 'application/json',
    'authorization': `Bearer ${token}`,
    'appkey': appKey,
    'appsecret': appSecret
  }
  
  // 5. 두 API를 병렬로 호출
  // - 시세 (FHKST01010100): 가격 정보
  // - 종목정보 (CTPF1604R): 종목명
  const priceUrl = `${baseUrl}/uapi/domestic-stock/v1/quotations/inquire-price?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${ticker}`
  const infoUrl = `${baseUrl}/uapi/domestic-stock/v1/quotations/search-stock-info?PRDT_TYPE_CD=300&PDNO=${ticker}`
  
  let priceData: any
  let infoData: any
  
  try {
    const [priceRes, infoRes] = await Promise.all([
      fetch(priceUrl, {
        method: 'GET',
        headers: { ...commonHeaders, 'tr_id': 'FHKST01010100' }
      }),
      fetch(infoUrl, {
        method: 'GET',
        headers: { ...commonHeaders, 'tr_id': 'CTPF1604R' }
      })
    ])
    
    if (!priceRes.ok) {
      const errText = await priceRes.text()
      return NextResponse.json(
        { error: `한투 시세 API 오류 (${priceRes.status}): ${errText}` },
        { status: 502 }
      )
    }
    
    priceData = await priceRes.json()
    
    // 종목정보는 실패해도 시세는 살리기
    if (infoRes.ok) {
      infoData = await infoRes.json()
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: `한투 호출 실패: ${e.message}` },
      { status: 502 }
    )
  }
  
  // 6. 시세 응답 검증
  if (priceData.rt_cd !== '0') {
    return NextResponse.json(
      { error: `한투 응답 오류: ${priceData.msg1 ?? '알 수 없음'}` },
      { status: 502 }
    )
  }
  
  const priceOutput = priceData.output ?? {}
  
  // 7. 종목명 추출 (여러 후보 필드 확인)
  let name = ''
  if (infoData?.rt_cd === '0') {
    const infoOutput = infoData.output ?? {}
    name = infoOutput.prdt_name 
        ?? infoOutput.prdt_abrv_name 
        ?? infoOutput.hts_kor_isnm 
        ?? ''
  }
  
  // 8. 응답 정리
  return NextResponse.json({
    ticker,
    name,
    currentPrice: Number(priceOutput.stck_prpr ?? 0),
    change: Number(priceOutput.prdy_vrss ?? 0),
    changeRate: Number(priceOutput.prdy_ctrt ?? 0),
    volume: Number(priceOutput.acml_vol ?? 0),
    high: Number(priceOutput.stck_hgpr ?? 0),
    low: Number(priceOutput.stck_lwpr ?? 0),
    open: Number(priceOutput.stck_oprc ?? 0)
  })
}