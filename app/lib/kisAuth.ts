import { supabaseAdmin } from './supabase'
import { decrypt } from './crypto'

// 한투 도메인 (실전 vs 모의)
function kisBaseUrl(isPaperTrading: boolean): string {
  return isPaperTrading
    ? 'https://openapivts.koreainvestment.com:29443'
    : 'https://openapi.koreainvestment.com:9443'
}

export interface KISCredentials {
  app_key: string
  app_secret: string
  account_number: string | null
  access_token: string | null
  access_token_expires_at: string | null
  is_paper_trading: boolean
}

/**
 * 사용자의 한투 자격증명을 가져오고, 필요하면 새 토큰 발급
 * 반환값: access_token + base_url (한투 API 호출에 바로 쓸 수 있는 것들)
 */
export async function getKISAccessToken(userId: string): Promise<{
  accessToken: string
  baseUrl: string
  credentials: KISCredentials
}> {
 // 1. DB에서 자격증명 조회
  const { data: cred, error } = await supabaseAdmin
    .from('kis_credentials')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  
  if (error) throw new Error(`DB 오류: ${error.message}`)
  if (!cred) throw new Error('한투 연동이 되어있지 않아요. 설정에서 등록해주세요.')
  
  // 2. 키 복호화
  let plainAppKey: string
  let plainAppSecret: string
  try {
    plainAppKey = decrypt(cred.app_key)
    plainAppSecret = decrypt(cred.app_secret)
  } catch (e: any) {
    throw new Error('키 복호화 실패. 한투 연동을 다시 설정해주세요.')
  }
  
  // 평문 키로 cred 객체 갱신 (이후 코드가 cred.app_key/secret 쓸 때 평문 쓰게)
  cred.app_key = plainAppKey
  cred.app_secret = plainAppSecret
  
  const baseUrl = kisBaseUrl(cred.is_paper_trading)
  
  // 2. 기존 토큰이 살아있고 30분 이상 남았으면 재사용
  if (cred.access_token && cred.access_token_expires_at) {
    const expiresAt = new Date(cred.access_token_expires_at)
    const now = new Date()
    const minutesLeft = (expiresAt.getTime() - now.getTime()) / 1000 / 60
    
    if (minutesLeft > 30) {
      return {
        accessToken: cred.access_token,
        baseUrl,
        credentials: cred
      }
    }
  }
  
  // 3. 새 토큰 발급
  const tokenRes = await fetch(`${baseUrl}/oauth2/tokenP`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      appkey: cred.app_key,
      appsecret: cred.app_secret
    })
  })
  
  if (!tokenRes.ok) {
    const errText = await tokenRes.text()
    throw new Error(`한투 토큰 발급 실패 (${tokenRes.status}): ${errText}`)
  }
  
  const tokenData = await tokenRes.json()
  const newToken = tokenData.access_token
  const expiresIn = tokenData.expires_in ?? 86400 // 기본 24시간 = 86400초
  const expiresAt = new Date(Date.now() + expiresIn * 1000)
  
  // 4. DB에 새 토큰 저장
  await supabaseAdmin
    .from('kis_credentials')
    .update({
      access_token: newToken,
      access_token_expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
  
  return {
    accessToken: newToken,
    baseUrl,
    credentials: { ...cred, access_token: newToken, access_token_expires_at: expiresAt.toISOString() }
  }
}