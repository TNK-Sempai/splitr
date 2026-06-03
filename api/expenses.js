import { Router } from 'express'
import db from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

const VALID_CATEGORIES = [
  'logement', 'energie', 'telecom', 'assurance',
  'remboursement', 'courses', 'transport', 'loisirs',
  'sante', 'autre',
]

async function getMonthWithAccess(monthId, userId) {
  const month = await db.month.findUnique({
    where: { id: Number(monthId) },
    include: { group: { include: { members: true } } },
  })

  if (!month) return { month: null, allowed: false }

  const allowed = month.group.members.some(m => m.userId === userId)
  return { month, allowed }
}

async function getExpenseWithAccess(expenseId, userId) {
  const expense = await db.expense.findUnique({
    where: { id: Number(expenseId) },
    include: {
      month: { include: { group: { include: { members: true } } } },
    },
  })

  if (!expense) return { expense: null, allowed: false }

  const allowed = expense.month.group.members.some(m => m.userId === userId)
  return { expense, allowed }
}

function validateExpenseFields(fields) {
  const { label, amount, payerId, pct, category } = fields
  const errors = []

  if (label !== undefined) {
    if (!label || label.trim().length === 0 || label.length > 100) {
      errors.push('Label invalide (1-100 caractères)')
    }
  }

  if (amount !== undefined) {
    const a = parseFloat(amount)
    if (isNaN(a) || a <= 0) errors.push('Montant invalide (> 0)')
  }

  if (pct !== undefined) {
    const p = parseInt(pct)
    if (isNaN(p) || p < 0 || p > 100) errors.push('pct invalide (0-100)')
  }

  if (category !== undefined && !VALID_CATEGORIES.includes(category)) {
    errors.push('Catégorie invalide')
  }

  return errors
}

router.get('/months/:monthId/expenses', requireAuth, async (req, res) => {
  try {
    const { month, allowed } = await getMonthWithAccess(req.params.monthId, req.user.id)

    if (!month) return res.status(404).json({ ok: false, error: 'Mois introuvable' })
    if (!allowed) return res.status(403).json({ ok: false, error: 'Accès refusé' })

    const expenses = await db.expense.findMany({
      where: { monthId: month.id },
      include: { payer: { select: { id: true, name: true, color: true } } },
      orderBy: { createdAt: 'asc' },
    })

    return res.status(200).json({ ok: true, data: expenses })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ ok: false, error: 'Erreur serveur' })
  }
})

router.post('/months/:monthId/expenses', requireAuth, async (req, res) => {
  try {
    const { month, allowed } = await getMonthWithAccess(req.params.monthId, req.user.id)

    if (!month) return res.status(404).json({ ok: false, error: 'Mois introuvable' })
    if (!allowed) return res.status(403).json({ ok: false, error: 'Accès refusé' })

    const { label, amount, payerId, pct = 50, category = 'autre', note = '' } = req.body

    if (!label || amount === undefined || !payerId) {
      return res.status(400).json({ ok: false, error: 'Champs manquants (label, amount, payerId)' })
    }

    const errors = validateExpenseFields({ label, amount, payerId, pct, category })
    if (errors.length) return res.status(400).json({ ok: false, error: errors.join(', ') })

    const isMember = month.group.members.some(m => m.userId === Number(payerId))
    if (!isMember) return res.status(400).json({ ok: false, error: 'payerId invalide' })

    const expense = await db.expense.create({
      data: {
        monthId: month.id,
        payerId: Number(payerId),
        label: label.trim(),
        amount: Math.round(parseFloat(amount) * 100) / 100,
        pct: parseInt(pct),
        category,
        note: note ?? '',
      },
      include: { payer: { select: { id: true, name: true, color: true } } },
    })

    return res.status(201).json({ ok: true, data: expense })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ ok: false, error: 'Erreur serveur' })
  }
})

router.put('/expenses/:id', requireAuth, async (req, res) => {
  try {
    const { expense, allowed } = await getExpenseWithAccess(req.params.id, req.user.id)

    if (!expense) return res.status(404).json({ ok: false, error: 'Dépense introuvable' })
    if (!allowed) return res.status(403).json({ ok: false, error: 'Accès refusé' })

    const { label, amount, payerId, pct, category, note } = req.body

    const errors = validateExpenseFields({ label, amount, payerId, pct, category })
    if (errors.length) return res.status(400).json({ ok: false, error: errors.join(', ') })

    const updateData = {}
    if (label !== undefined) updateData.label = label.trim()
    if (amount !== undefined) updateData.amount = Math.round(parseFloat(amount) * 100) / 100
    if (payerId !== undefined) {
      const isMember = expense.month.group.members.some(m => m.userId === Number(payerId))
      if (!isMember) return res.status(400).json({ ok: false, error: 'payerId invalide' })
      updateData.payerId = Number(payerId)
    }
    if (pct !== undefined) updateData.pct = parseInt(pct)
    if (category !== undefined) updateData.category = category
    if (note !== undefined) updateData.note = note

    const updated = await db.expense.update({
      where: { id: expense.id },
      data: updateData,
      include: { payer: { select: { id: true, name: true, color: true } } },
    })

    return res.status(200).json({ ok: true, data: updated })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ ok: false, error: 'Erreur serveur' })
  }
})

router.delete('/expenses/:id', requireAuth, async (req, res) => {
  try {
    const { expense, allowed } = await getExpenseWithAccess(req.params.id, req.user.id)

    if (!expense) return res.status(404).json({ ok: false, error: 'Dépense introuvable' })
    if (!allowed) return res.status(403).json({ ok: false, error: 'Accès refusé' })

    await db.expense.delete({ where: { id: expense.id } })

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ ok: false, error: 'Erreur serveur' })
  }
})

router.post('/months/:monthId/expenses/import', requireAuth, async (req, res) => {
  try {
    const { month, allowed } = await getMonthWithAccess(req.params.monthId, req.user.id)

    if (!month) return res.status(404).json({ ok: false, error: 'Mois introuvable' })
    if (!allowed) return res.status(403).json({ ok: false, error: 'Accès refusé' })

    const { rows } = req.body
    if (!Array.isArray(rows)) {
      return res.status(400).json({ ok: false, error: 'rows doit être un tableau' })
    }

    const members = await db.groupMember.findMany({
      where: { groupId: month.groupId },
      include: { user: { select: { id: true, name: true } } },
    })

    let inserted = 0
    let skipped = 0

    for (const row of rows) {
      try {
        const { label, amount, payerName, pct = 50, category = 'autre', note = '' } = row

        if (!label || amount === undefined || !payerName) { skipped++; continue }

        const a = parseFloat(amount)
        if (isNaN(a) || a <= 0) { skipped++; continue }

        const p = parseInt(pct)
        if (isNaN(p) || p < 0 || p > 100) { skipped++; continue }

        if (!VALID_CATEGORIES.includes(category)) { skipped++; continue }

        const member = members.find(m => m.user.name.toLowerCase() === payerName.toLowerCase())
        if (!member) { skipped++; continue }

        await db.expense.create({
          data: {
            monthId: month.id,
            payerId: member.user.id,
            label: label.trim(),
            amount: Math.round(a * 100) / 100,
            pct: p,
            category,
            note: note ?? '',
          },
        })

        inserted++
      } catch {
        skipped++
      }
    }

    return res.status(200).json({ ok: true, data: { inserted, skipped } })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ ok: false, error: 'Erreur serveur' })
  }
})

export default router
