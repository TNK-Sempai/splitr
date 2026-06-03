function round2(v) {
  return Math.round(v * 100) / 100
}

function formatCurrency(v) {
  return new Intl.NumberFormat('fr-BE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(v)
}


export function calcExpense(expense) {
  const amount = round2(parseFloat(expense.amount))
  const rawPct = parseInt(expense.pct)
  const pct = Math.max(0, Math.min(100, isNaN(rawPct) ? 50 : rawPct))
  const partPayeur = round2(amount * pct / 100)
  const partAutre  = round2(amount - partPayeur)
  const dueT = expense.payer.name.toLowerCase() === 'fox' ? partAutre : -partAutre
  return { partPayeur, partAutre, dueT }
}

export function calcMonth(expenses) {
  let avT = 0, avF = 0, solde = 0

  for (const expense of expenses) {
    const amt = round2(parseFloat(expense.amount))
    const { dueT } = calcExpense(expense)

    if (expense.payer.name.toLowerCase() === 'tanuki') avT = round2(avT + amt)
    else avF = round2(avF + amt)

    solde = round2(solde + dueT)
  }

  const totalFoyer = round2(avT + avF)
  const soldeLabel = Math.abs(solde) < 0.01
    ? 'Équilibré'
    : solde > 0
      ? `Tanuki doit ${formatCurrency(solde)} à Fox`
      : `Fox doit ${formatCurrency(Math.abs(solde))} à Tanuki`

  return { totalFoyer, avT, avF, solde, soldeLabel }
}

export function calcGlobal(months) {
  let totalFoyer = 0, avT = 0, avF = 0, solde = 0
  let soldeCumul = 0

  const byMonth = months.map(m => {
    totalFoyer = round2(totalFoyer + m.totalFoyer)
    avT = round2(avT + m.avT)
    avF = round2(avF + m.avF)
    solde = round2(solde + m.solde)
    soldeCumul = round2(soldeCumul + m.solde)

    return {
      key: `${m.year}-${String(m.month).padStart(2, '0')}`,
      month: m.month,
      year: m.year,
      totalFoyer: m.totalFoyer,
      avT: m.avT,
      avF: m.avF,
      solde: m.solde,
      soldeCumul,
    }
  })

  const soldeLabel = Math.abs(solde) < 0.01
    ? 'Équilibré'
    : solde > 0
      ? `Tanuki doit ${formatCurrency(solde)} à Fox`
      : `Fox doit ${formatCurrency(Math.abs(solde))} à Tanuki`

  return {
    totalFoyer,
    avT,
    avF,
    solde,
    soldeLabel,
    monthCount: months.length,
    byMonth,
  }
}
