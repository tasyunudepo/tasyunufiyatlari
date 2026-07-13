import 'server-only'

import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'

type AdminMutationAuthResult =
  | { ok: true; user: string }
  | { ok: false; response: NextResponse }

type OfficeReadAuthResult =
  | { ok: true; user: string }
  | { ok: false; response: NextResponse }

function secureEqual(candidate: string, expected: string): boolean {
  const candidateDigest = createHash('sha256').update(candidate, 'utf8').digest()
  const expectedDigest = createHash('sha256').update(expected, 'utf8').digest()

  return timingSafeEqual(candidateDigest, expectedDigest)
}

function parseBasicAuthorization(header: string | null): {
  user: string
  password: string
} | null {
  if (!header) return null

  const match = header.match(/^Basic\s+([^\s]+)$/i)
  if (!match) return null

  const token = match[1]
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(token)) return null

  const decoded = Buffer.from(token, 'base64').toString('utf8')
  const separatorIndex = decoded.indexOf(':')

  if (separatorIndex <= 0) return null

  return {
    user: decoded.slice(0, separatorIndex),
    password: decoded.slice(separatorIndex + 1),
  }
}

function deniedResponse(status: 401 | 403 | 503, error: string): NextResponse {
  const headers = new Headers({ 'Cache-Control': 'no-store' })

  if (status === 401) {
    headers.set('WWW-Authenticate', 'Basic realm="Yönetim Paneli"')
  }

  return NextResponse.json({ ok: false, error }, { status, headers })
}

/**
 * Service-role kullanan admin mutasyonları için handler seviyesinde yetki kapısı.
 * Proxy korumasına ek olarak çalışır; patron hesabı salt okunur kalır.
 */
export function requireAdminMutationAuth(
  request: Pick<Request, 'headers'>,
): AdminMutationAuthResult {
  const adminUser = process.env.ADMIN_USER?.trim() || 'admin'
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminPassword) {
    return {
      ok: false,
      response: deniedResponse(
        503,
        'Yönetim yetkilendirmesi yapılandırılmamış.',
      ),
    }
  }

  const credentials = parseBasicAuthorization(
    request.headers.get('authorization'),
  )

  if (!credentials) {
    return {
      ok: false,
      response: deniedResponse(401, 'Kimlik doğrulaması gerekli.'),
    }
  }

  const patronPassword = process.env.PATRON_PASSWORD
  let isPatron = false

  if (patronPassword) {
    const patronUserMatches = secureEqual(credentials.user, 'patron')
    const patronPasswordMatches = secureEqual(
      credentials.password,
      patronPassword,
    )
    isPatron = patronUserMatches && patronPasswordMatches
  }

  if (isPatron) {
    return {
      ok: false,
      response: deniedResponse(
        403,
        'Bu hesap veri değiştirme yetkisine sahip değil.',
      ),
    }
  }

  const adminUserMatches = secureEqual(credentials.user, adminUser)
  const adminPasswordMatches = secureEqual(
    credentials.password,
    adminPassword,
  )
  const isAdmin = adminUserMatches && adminPasswordMatches

  if (!isAdmin) {
    return {
      ok: false,
      response: deniedResponse(401, 'Kimlik bilgileri geçersiz.'),
    }
  }

  return { ok: true, user: adminUser }
}

/**
 * Hassas ofis okumaları için proxy'ye ek, handler seviyesinde yetki kapısı.
 * Admin ve salt-okunur patron hesabı geçebilir; ortam yapılandırılmamışsa
 * endpoint açık kalmak yerine 503 ile kapanır.
 */
export function requireOfficeReadAuth(
  request: Pick<Request, 'headers'>,
): OfficeReadAuthResult {
  const adminUser = process.env.ADMIN_USER?.trim() || 'admin'
  const adminPassword = process.env.ADMIN_PASSWORD
  const patronPassword = process.env.PATRON_PASSWORD

  if (!adminPassword && !patronPassword) {
    return {
      ok: false,
      response: deniedResponse(
        503,
        'Yönetim yetkilendirmesi yapılandırılmamış.',
      ),
    }
  }

  const credentials = parseBasicAuthorization(
    request.headers.get('authorization'),
  )

  if (!credentials) {
    return {
      ok: false,
      response: deniedResponse(401, 'Kimlik doğrulaması gerekli.'),
    }
  }

  const isAdmin = Boolean(
    adminPassword
      && secureEqual(credentials.user, adminUser)
      && secureEqual(credentials.password, adminPassword),
  )
  const isPatron = Boolean(
    patronPassword
      && secureEqual(credentials.user, 'patron')
      && secureEqual(credentials.password, patronPassword),
  )

  if (!isAdmin && !isPatron) {
    return {
      ok: false,
      response: deniedResponse(401, 'Kimlik bilgileri geçersiz.'),
    }
  }

  return { ok: true, user: credentials.user }
}
