import jwt from 'jsonwebtoken'
import db from '../lib/db.js'

function parseCookieHeader(header = '') {
  const cookies = {}
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    const key = part.slice(0, idx).trim()
    const val = part.slice(idx + 1).trim()
    if (key) cookies[key] = decodeURIComponent(val)
  }
  return cookies
}

export async function requireAuth(req, res, next) {
  const cookies = req.cookies ?? parseCookieHeader(req.headers.cookie)
  const token = cookies?.token

  if (!token) {
    return res.status(401).json({ ok: false, error: 'Non authentifié' })
  }

  let payload
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET)
  } catch {
    return res.status(401).json({ ok: false, error: 'Token invalide ou expiré' })
  }

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, name: true, color: true },
  })

  if (!user) {
    return res.status(401).json({ ok: false, error: 'Utilisateur introuvable' })
  }

  req.user = user
  return next()
}
