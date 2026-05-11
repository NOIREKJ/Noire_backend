import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'
import { verifyAuth } from '@/app/lib/auth'
import { encrypt } from '@/app/lib/crypto'

// POST: 한투 자격증명 등록/업데이트
export async function POST(request: Request) {
  // 1. 인증 확인
  const auth = await verifyAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  
  // 2. 요청 본문 파싱
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  
  const { app_key, app_secret, account_number, is_paper_trading } = body
  
  // 3. 필수 필드 검증
  if (!app_key || !app_secret) {
    return NextResponse.json(
      { error: 'app_key and app_secret are required' },
      { status: 400 }
    )
  }
  
  // 4. 키 암호화
  let encryptedKey: string
  let encryptedSecret: string
  try {
    encryptedKey = encrypt(app_key)
    encryptedSecret = encrypt(app_secret)
  } catch (e: any) {
    return NextResponse.json(
      { error: `암호화 실패: ${e.message}` },
      { status: 500 }
    )
  }
  
  // 5. DB에 upsert
  const { error } = await supabaseAdmin
    .from('kis_credentials')
    .upsert({
      user_id: auth.userId,
      app_key: encryptedKey,
      app_secret: encryptedSecret,
      account_number: account_number || null,
      is_paper_trading: is_paper_trading ?? false,
      access_token: null,
      access_token_expires_at: null,
      updated_at: new Date().toISOString()
    })
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json({ ok: true })
}

// DELETE: 자격증명 삭제
export async function DELETE(request: Request) {
  const auth = await verifyAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  
  const { error } = await supabaseAdmin
    .from('kis_credentials')
    .delete()
    .eq('user_id', auth.userId)
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json({ ok: true })
}

// GET: 현재 자격증명 상태 확인 (실제 키 값은 안 돌려줌)
export async function GET(request: Request) {
  const auth = await verifyAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  
  const { data, error } = await supabaseAdmin
    .from('kis_credentials')
    .select('account_number, is_paper_trading, updated_at')
    .eq('user_id', auth.userId)
    .maybeSingle()
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json({
    connected: !!data,
    account_number: data?.account_number ?? null,
    is_paper_trading: data?.is_paper_trading ?? false,
    updated_at: data?.updated_at ?? null
  })
}