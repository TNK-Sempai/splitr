import { Router } from 'express'
import db from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'
import { calcMonth } from '../lib/calc.js'

const router = Router()

async function assertGroupMember(userId, groupId) {
  const member = await db.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId: Number(groupId) } },
  })
  return !!member
}

router.get('/groups/:groupId/months', requireAuth, async (req, res) => {
  try {
    const groupId = Number(req.params.groupId)

    const isMember = await assertGroupMember(req.user.id, groupId)
    if (!isMember) {
      return res.status(403).json({ ok: false, error: 'Accès refusé' })
    }

    const months = await db.month.findMany({
      where: { groupId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: {
        expenses: {
          include: { payer: { select: { id: true, name: true, color: true } } },
        },
      },
    })

    const data = months.map(m => {
      const balance = calcMonth(m.expenses)
      return {
        id: m.id,
        month: m.month,
        year: m.year,
        expenseCount: m.expenses.length,
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

router.get('/months/:id', requireAuth, async (req, res) => {
  try {
    const monthId = Number(req.params.id)

    const month = await db.month.findUnique({
      where: { id: monthId },
      include: {
        expenses: {
          include: { payer: { select: { id: true, name: true, color: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!month) {
      return res.status(404).json({ ok: false, error: 'Mois introuvable' })
    }

    const isMember = await assertGroupMember(req.user.id, month.groupId)
    if (!isMember) {
      return res.status(403).json({ ok: false, error: 'Accès refusé' })
    }

    const balance = calcMonth(month.expenses)

    return res.status(200).json({
      ok: true,
      data: {
        id: month.id,
        month: month.month,
        year: month.year,
        expenses: month.expenses,
        balance,
      },
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ ok: false, error: 'Erreur serveur' })
  }
})

router.post('/groups/:groupId/months', requireAuth, async (req, res) => {
  try {
    const groupId = Number(req.params.groupId)

    const isMember = await assertGroupMember(req.user.id, groupId)
    if (!isMember) {
      return res.status(403).json({ ok: false, error: 'Accès refusé' })
    }

    const { month, year } = req.body

    if (!month || !year) {
      return res.status(400).json({ ok: false, error: 'Champs manquants' })
    }

    const m = parseInt(month)
    const y = parseInt(year)

    if (isNaN(m) || m < 1 || m > 12) {
      return res.status(400).json({ ok: false, error: 'Mois invalide (1-12)' })
    }

    if (isNaN(y) || y < 2000 || y > 2099) {
      return res.status(400).json({ ok: false, error: 'Année invalide (2000-2099)' })
    }

    const existing = await db.month.findUnique({
      where: { groupId_month_year: { groupId, month: m, year: y } },
    })

    if (existing) {
      return res.status(409).json({ ok: false, error: 'Ce mois existe déjà pour ce groupe' })
    }

    const created = await db.month.create({
      data: { groupId, month: m, year: y },
    })

    return res.status(201).json({
      ok: true,
      data: { id: created.id, month: created.month, year: created.year, expenseCount: 0 },
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ ok: false, error: 'Erreur serveur' })
  }
})

router.delete('/months/:id', requireAuth, async (req, res) => {
  try {
    const monthId = Number(req.params.id)

    const month = await db.month.findUnique({ where: { id: monthId } })
    if (!month) {
      return res.status(404).json({ ok: false, error: 'Mois introuvable' })
    }

    const isMember = await assertGroupMember(req.user.id, month.groupId)
    if (!isMember) {
      return res.status(403).json({ ok: false, error: 'Accès refusé' })
    }

    await db.month.delete({ where: { id: monthId } })

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ ok: false, error: 'Erreur serveur' })
  }
})

router.post('/months/:id/duplicate', requireAuth, async (req, res) => {
  try {
    const monthId = Number(req.params.id)

    const sourceMonth = await db.month.findUnique({
      where: { id: monthId },
      include: { expenses: true },
    })

    if (!sourceMonth) {
      return res.status(404).json({ ok: false, error: 'Mois source introuvable' })
    }

    const isMember = await assertGroupMember(req.user.id, sourceMonth.groupId)
    if (!isMember) {
      return res.status(403).json({ ok: false, error: 'Accès refusé' })
    }

    const { targetMonth, targetYear } = req.body

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

router.get('/groups/:groupId/members', requireAuth, async (req, res) => {
  try {
    const groupId = Number(req.params.groupId)

    const isMember = await assertGroupMember(req.user.id, groupId)
    if (!isMember) {
      return res.status(403).json({ ok: false, error: 'Accès refusé' })
    }

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

export default router
