import jwt from 'jsonwebtoken'
import db from '../lib/db.js'

export async function requireAuth(req, res, next) {
  const token = req.cookies?.token
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
  next()
}
