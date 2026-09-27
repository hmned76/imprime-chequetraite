const LIC_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAlKsb5mZUY6K+ZTzKYvYA
6qH2Z80CLlJuGXGcMegYsvfyU4R1sSrDw3XLljkJlz3UAzdQ8Xl6E/Mdh2MFQ/EK
PYY9UHdMVmgeB4BZrUSXow/hjU/l4Uzgf8kVKvOOOzvm9ig0YkIfD3T7qz9Iujpm
jLRaa78SaNQaD6IZAVF1Vj+6T6PoZ8oPN9NkT2rX3ivfmVDgHHhDxF1BnJy/0/JX
4ddWQOHGcgwDsncNyEG31QUN2tXgO82eNqyzWj1cDpWB9DFd2wMootEitwSs1fLw
MAhBAA4M3uKmz/63qwTtXtY8ls+lFD/5mDLvu9DTPc49XrY+k7KRbbCQPYNxjPFK
mQIDAQAB
-----END PUBLIC KEY-----`

const PREFIX = 'ICT1'
const LS_KEY = 'ict_license'

function b64ToBytes(s: string): Uint8Array<ArrayBuffer> {
  let b = String(s || '').replace(/-/g, '+').replace(/_/g, '/')
  while (b.length % 4) b += '='
  const bin = atob(b)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function normalizeName(s: string): string {
  return String(s || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

let pubKeyPromise: Promise<CryptoKey> | null = null
function publicKey(): Promise<CryptoKey> {
  if (!pubKeyPromise) {
    const b64 = LIC_PUBLIC_KEY.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')
    pubKeyPromise = crypto.subtle.importKey(
      'spki',
      b64ToBytes(b64),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    )
  }
  return pubKeyPromise
}

export interface LicenceInfo {
  company: string
  key: string
  type: 'trial' | 'permanent'
  expiresAt: string | null
  issuedAt: string
  licenseId: string
  date: string
}

export type LicenceError = 'invalid' | 'company' | 'expired'

export async function validateLicenceKey(
  companyName: string,
  key: string,
): Promise<{ ok: boolean; reason: string; licence?: LicenceInfo }> {
  try {
    const parts = String(key || '').trim().split('.')
    if (parts.length !== 3 || parts[0] !== PREFIX) return { ok: false, reason: 'invalid' }
    const payload = JSON.parse(new TextDecoder().decode(b64ToBytes(parts[1])))
    if (!payload || payload.companyNorm !== normalizeName(companyName)) return { ok: false, reason: 'company' }
    if (payload.type !== 'trial' && payload.type !== 'permanent') return { ok: false, reason: 'invalid' }
    const valid = await crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5' },
      await publicKey(),
      b64ToBytes(parts[2]),
      new TextEncoder().encode(parts[1]),
    )
    if (!valid) return { ok: false, reason: 'invalid' }
    if (payload.type === 'trial' && (!payload.expiresAt || Date.now() > Date.parse(payload.expiresAt))) {
      return { ok: false, reason: 'expired', licence: payloadToLicence(payload) }
    }
    return { ok: true, reason: '', licence: payloadToLicence(payload) }
  } catch {
    return { ok: false, reason: 'invalid' }
  }
}

function payloadToLicence(payload: any): LicenceInfo {
  return {
    company: String(payload.company || ''),
    key: '',
    type: payload.type === 'permanent' ? 'permanent' : 'trial',
    expiresAt: payload.expiresAt || null,
    issuedAt: payload.issuedAt || new Date().toISOString(),
    licenseId: String(payload.id || ''),
    date: new Date().toISOString(),
  }
}

export function readStoredLicence(): LicenceInfo | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function storeLicence(companyName: string, key: string, payload: any) {
  const info: LicenceInfo = {
    company: companyName,
    key,
    type: payload.type === 'permanent' ? 'permanent' : 'trial',
    expiresAt: payload.expiresAt || null,
    issuedAt: payload.issuedAt || new Date().toISOString(),
    licenseId: String(payload.id || ''),
    date: new Date().toISOString(),
  }
  localStorage.setItem(LS_KEY, JSON.stringify(info))
}

export function clearLicence() {
  localStorage.removeItem(LS_KEY)
}