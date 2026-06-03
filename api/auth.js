import 'dotenv/config'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import db from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'

function setAuthCookie(res, userId) {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' })
  const maxAge = 7 * 24 * 60 * 60
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader('Set-Cookie', `token=${token}; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Path=/${secure}`)
}

function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', 'token=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/')
}

export default async function handler(req, res) {
  const url = (req.originalUrl || req.url).split('?')[0]
  const { method } = req

  // POST /api/auth/register
  if (method === 'POST' && url === '/api/auth/register') {
    try {
      const { email, name, password } = req.body ?? {}

      if (!email || !name || !password) {
        return res.status(400).json({ ok: false, error: 'Champs manquants' })
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return res.status(400).json({ ok: false, error: 'Email invalide' })
      }

      if (name.trim().length < 1 || name.trim().length > 50) {
        return res.status(400).json({ ok: false, error: 'Nom invalide (1-50 caractères)' })
      }

      if (password.length < 8) {
        return res.status(400).json({ ok: false, error: 'Mot de passe trop court (minimum 8 caractères)' })
      }

      const existing = await db.user.findUnique({ where: { email } })
      if (existing) {
        return res.status(409).json({ ok: false, error: 'Email déjà utilisé' })
      }

      const hash = await bcrypt.hash(password, 10)

      const user = await db.user.create({
        data: { email, name: name.trim(), password: hash },
        select: { id: true, email: true, name: true, color: true },
      })

      await db.groupMember.create({
        data: { userId: user.id, groupId: 1, role: 'member' },
      })

      setAuthCookie(res, user.id)
      return res.status(201).json({ ok: true, data: user })
    } catch (err) {
      console.error(err)
      return res.status(500).json({ ok: false, error: 'Erreur serveur' })
    }
  }

  // POST /api/auth/login
  if (method === 'POST' && url === '/api/auth/login') {
    try {
      const { email, password } = req.body ?? {}

      if (!email || !password) {
        return res.status(400).json({ ok: false, error: 'Champs manquants' })
      }

      const user = await db.user.findUnique({ where: { email } })
      if (!user) {
        return res.status(401).json({ ok: false, error: 'Email ou mot de passe incorrect' })
      }

      const valid = await bcrypt.compare(password, user.password)
      if (!valid) {
        return res.status(401).json({ ok: false, error: 'Email ou mot de passe incorrect' })
      }

      setAuthCookie(res, user.id)
      return res.status(200).json({
        ok: true,
        data: { id: user.id, email: user.email, name: user.name, color: user.color },
      })
    } catch (err) {
      console.error(err)
      return res.status(500).json({ ok: false, error: 'Erreur serveur' })
    }
  }

  // POST /api/auth/logout
  if (method === 'POST' && url === '/api/auth/logout') {
    clearAuthCookie(res)
    return res.status(200).json({ ok: true })
  }

  // GET /api/auth/me
  if (method === 'GET' && url === '/api/auth/me') {
    return requireAuth(req, res, async () => {
      try {
        const member = await db.groupMember.findFirst({
          where: { userId: req.user.id },
          select: { groupId: true },
        })
        return res.status(200).json({
          ok: true,
          data: { ...req.user, groupId: member?.groupId ?? 1 },
        })
      } catch (err) {
        console.error(err)
        return res.status(500).json({ ok: false, error: 'Erreur serveur' })
      }
    })
  }

  return res.status(404).json({ ok: false, error: 'Route introuvable' })
}
