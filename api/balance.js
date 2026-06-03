import 'dotenv/config'
import db from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'
import { calcMonth, calcGlobal } from '../lib/calc.js'

export default async function handler(req, res, next) {
  const url = (req.originalUrl || req.url).split('?')[0]
  const { method } = req
  let m

  // GET /api/groups/:groupId/balance
  if (method === 'GET' && (m = url.match(/^\/api\/groups\/(\d+)\/balance$/))) {
    const groupId = Number(m[1])
    return requireAuth(req, res, async () => {
      try {
        const member = await db.groupMember.findUnique({
          where: { userId_groupId: { userId: req.user.id, groupId } },
        })
        if (!member) return res.status(403).json({ ok: false, error: 'Accès refusé' })

        const months = await db.month.findMany({
          where: { groupId },
          orderBy: [{ year: 'asc' }, { month: 'asc' }],
          include: {
            expenses: {
              include: { payer: { select: { id: true, name: true, color: true } } },
            },
          },
        })

        const monthCalcs = months.map(mo => ({
          month: mo.month,
          year: mo.year,
          ...calcMonth(mo.expenses),
        }))

        return res.status(200).json({ ok: true, data: calcGlobal(monthCalcs) })
      } catch (err) {
        console.error(err)
        return res.status(500).json({ ok: false, error: 'Erreur serveur' })
      }
    })
  }

  if (typeof next === 'function') return next()
  return res.status(404).json({ ok: false, error: 'Route introuvable' })
}
