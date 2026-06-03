import { Router } from 'express'
import db from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'
import { calcMonth, calcGlobal } from '../lib/calc.js'

const router = Router()

router.get('/groups/:groupId/balance', requireAuth, async (req, res) => {
  try {
    const groupId = Number(req.params.groupId)

    const member = await db.groupMember.findUnique({
      where: { userId_groupId: { userId: req.user.id, groupId } },
    })

    if (!member) {
      return res.status(403).json({ ok: false, error: 'Accès refusé' })
    }

    const months = await db.month.findMany({
      where: { groupId },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
      include: {
        expenses: {
          include: { payer: { select: { id: true, name: true, color: true } } },
        },
      },
    })

    const monthCalcs = months.map(m => ({
      month: m.month,
      year: m.year,
      ...calcMonth(m.expenses),
    }))

    const data = calcGlobal(monthCalcs)

    return res.status(200).json({ ok: true, data })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ ok: false, error: 'Erreur serveur' })
  }
})

export default router
