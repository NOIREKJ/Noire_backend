import { supabaseAdmin } from './supabase'

export type AuthResult = 
  | { ok: true; userId: string }
  | { ok: false; error: string; status: number }

/**
 * 요청 헤더의 Bearer 토큰을 검증하고 user_id를 반환
 */
export async function verifyAuth(request: Request): Promise<AuthResult> {
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, error: 'Missing Authorization header', status: 401 }
  }
  
  const token = authHeader.replace('Bearer ', '')
  
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token)
    
    if (error || !data.user) {
      return { ok: false, error: 'Invalid token', status: 401 }
    }
    
    return { ok: true, userId: data.user.id }
  } catch (e) {
    return { ok: false, error: 'Auth check failed', status: 500 }
  }
}