import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12   // GCM 표준
const TAG_LENGTH = 16  // GCM 인증 태그

function getKey(): Buffer {
  const masterKey = process.env.ENCRYPTION_MASTER_KEY
  if (!masterKey) {
    throw new Error('ENCRYPTION_MASTER_KEY is not set')
  }
  // base64로 저장된 32바이트 키
  const key = Buffer.from(masterKey, 'base64')
  if (key.length !== 32) {
    throw new Error(`Master key must be 32 bytes (got ${key.length})`)
  }
  return key
}

/**
 * 문자열을 암호화해서 base64로 반환
 * 반환 형식: base64(IV + 인증태그 + 암호문)
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ])
  
  const tag = cipher.getAuthTag()
  
  // IV + tag + ciphertext 를 base64로 한 번에 묶음
  return Buffer.concat([iv, tag, ciphertext]).toString('base64')
}

/**
 * 암호화된 base64 문자열을 복호화
 */
export function decrypt(encoded: string): string {
  const key = getKey()
  const data = Buffer.from(encoded, 'base64')
  
  if (data.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error('Invalid encrypted data')
  }
  
  const iv = data.subarray(0, IV_LENGTH)
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH)
  
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ])
  
  return plaintext.toString('utf8')
}