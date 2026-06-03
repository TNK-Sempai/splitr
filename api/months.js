import 'dotenv/config'
import db from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'
import { calcMonth } from '../lib/calc.js'

async function assertGroupMember(userId, groupId) {
  const member = await db.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId: Number(groupId) } },
  })
  return !!member
}

export default async function handler(req, res, next) {
  const url = (req.originalUrl || req.url).split('?')[0]
  const { method } = req
  let m

  // GET /api/groups/:groupId/months
  if (method === 'GET' && (m = url.match(/^\/api\/groups\/(\d+)\/months$/))) {
    const groupId = Number(m[1])
    return requireAuth(req, res, async () => {
      try {
        const isMember = await assertGroupMember(req.user.id, groupId)
        if (!isMember) return res.status(403).json({ ok: false, error: 'Accès refusé' })

        const months = await db.month.findMany({
          where: { groupId },
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
          include: {
            expenses: {
              include: { payer: { select: { id: true, name: true, color: true } } },
            },
          },
        })

        const data = months.map(mo => {
          const balance = calcMonth(mo.expenses)
          return {
            id: mo.id,
            month: mo.month,
            year: mo.year,
            expenseCount: mo.expenses.length,
            totalFoyer: balance.totalFoyer,
            avT: balance.avT,
            avF: balance.avF,
            solde: balance.solde,
          }
        })

        return res.status(200).json({ ok: true, data })
      } catch (err) {
        console.error(err)
        return res.status(500).json({ ok: false, error: 'Erreur serveur' })
      }
    })
  }

  // POST /api/groups/:groupId/months
  if (method === 'POST' && (m = url.match(/^\/api\/groups\/(\d+)\/months$/))) {
    const groupId = Number(m[1])
    return requireAuth(req, res, async () => {
      try {
        const isMember = await assertGroupMember(req.user.id, groupId)
        if (!isMember) return res.status(403).json({ ok: false, error: 'Accès refusé' })

        const { month, year } = req.body ?? {}

        if (!month || !year) {
          return res.status(400).json({ ok: false, error: 'Champs manquants' })
        }

        const mo = parseInt(month)
        const yr = parseInt(year)

        if (isNaN(mo) || mo < 1 || mo > 12) {
          return res.status(400).json({ ok: false, error: 'Mois invalide (1-12)' })
        }
        if (isNaN(yr) || yr < 2000 || yr > 2099) {
          return res.status(400).json({ ok: false, error: 'Année invalide (2000-2099)' })
        }

        const existing = await db.month.findUnique({
          where: { groupId_month_year: { groupId, month: mo, year: yr } },
        })
        if (existing) {
          return res.status(409).json({ ok: false, error: 'Ce mois existe déjà pour ce groupe' })
        }

        const created = await db.month.create({ data: { groupId, month: mo, year: yr } })
        return res.status(201).json({
          ok: true,
          data: { id: created.id, month: created.month, year: created.year, expenseCount: 0 },
        })
      } catch (err) {
        console.error(err)
        return res.status(500).json({ ok: false, error: 'Erreur serveur' })
      }
    })
  }

  // GET /api/groups/:groupId/members
  if (method === 'GET' && (m = url.match(/^\/api\/groups\/(\d+)\/members$/))) {
    const groupId = Number(m[1])
    return requireAuth(req, res, async () => {
      try {
        const isMember = await assertGroupMember(req.user.id, groupId)
        if (!isMember) return res.status(403).json({ ok: false, error: 'Accès refusé' })

        const members = await db.groupMember.findMany({
          where: { groupId },
          include: { user: { select: { id: true, name: true, color: true } } },
        })

        return res.status(200).json({ ok: true, data: members })
      } catch (err) {
        console.error(err)
        return res.status(500).json({ ok: false, error: 'Erreur serveur' })
      }
    })
  }

  // GET /api/months/:id
  if (method === 'GET' && (m = url.match(/^\/api\/months\/(\d+)$/))) {
    const monthId = Number(m[1])
    return requireAuth(req, res, async () => {
      try {
        const month = await db.month.findUnique({
          where: { id: monthId },
          include: {
            expenses: {
              include: { payer: { select: { id: true, name: true, color: true } } },
              orderBy: { createdAt: 'asc' },
            },
          },
        })

        if (!month) return res.status(404).json({ ok: false, error: 'Mois introuvable' })

        const isMember = await assertGroupMember(req.user.id, month.groupId)
        if (!isMember) return res.status(403).json({ ok: false, error: 'Accès refusé' })

        const balance = calcMonth(month.expenses)
        return res.status(200).json({
          ok: true,
          data: { id: month.id, month: month.month, year: month.year, expenses: month.expenses, balance },
        })
      } catch (err) {
        console.error(err)
        return res.status(500).json({ ok: false, error: 'Erreur serveur' })
      }
    })
  }

  // DELETE /api/months/:id
  if (method === 'DELETE' && (m = url.match(/^\/api\/months\/(\d+)$/))) {
    const monthId = Number(m[1])
    return requireAuth(req, res, async () => {
      try {
        const month = await db.month.findUnique({ where: { id: monthId } })
        if (!month) return res.status(404).json({ ok: false, error: 'Mois introuvable' })

        const isMember = await assertGroupMember(req.user.id, month.groupId)
        if (!isMember) return res.status(403).json({ ok: false, error: 'Accès refusé' })

        await db.month.delete({ where: { id: monthId } })
        return res.status(200).json({ ok: true })
      } catch (err) {
        console.error(err)
        return res.status(500).json({ ok: false, error: 'Erreur serveur' })
      }
    })
  }

  // POST /api/months/:id/duplicate
  if (method === 'POST' && (m = url.match(/^\/api\/months\/(\d+)\/duplicate$/))) {
    const monthId = Number(m[1])
    return requireAuth(req, res, async () => {
      try {
        const sourceMonth = await db.month.findUnique({
          where: { id: monthId },
          include: { expenses: true },
        })
        if (!sourceMonth) return res.status(404).json({ ok: false, error: 'Mois source introuvable' })

        const isMember = await assertGroupMember(req.user.id, sourceMonth.groupId)
        if (!isMember) return res.status(403).json({ ok: false, error: 'Accès refusé' })

        const { targetMonth, targetYear } = req.body ?? {}
        const tm = parseInt(targetMonth)
        const ty = parseInt(targetYear)

        if (isNaN(tm) || tm < 1 || tm > 12) {
          return res.status(400).json({ ok: false, error: 'Mois cible invalide (1-12)' })
        }
        if (isNaN(ty) || ty < 2000 || ty > 2099) {
          return res.status(400).json({ ok: false, error: 'Année cible invalide (2000-2099)' })
        }

        let target = await db.month.findUnique({
          where: { groupId_month_year: { groupId: sourceMonth.groupId, month: tm, year: ty } },
        })
        if (!target) {
          target = await db.month.create({
            data: { groupId: sourceMonth.groupId, month: tm, year: ty },
          })
        }

        const copies = sourceMonth.expenses.map(e => ({
          monthId: target.id,
          payerId: e.payerId,
          label: e.label,
          amount: e.amount,
          pct: e.pct,
          category: e.category,
          note: e.note,
        }))

        await db.expense.createMany({ data: copies })
        return res.status(200).json({
          ok: true,
          data: { targetMonthId: target.id, copied: copies.length },
        })
      } catch (err) {
        console.error(err)
        return res.status(500).json({ ok: false, error: 'Erreur serveur' })
      }
    })
  }

  if (typeof next === 'function') return next()
  return res.status(404).json({ ok: false, error: 'Route introuvable' })
}
