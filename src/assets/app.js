// ── State ────────────────────────────────────────────────────────────────────

const state = {
  currentUser: null,
  groupId: 1,
  months: [],
  balance: null,
  currentMonthId: null,
  currentMonth: null,
  members: [],
}

let editingExpenseId = null

// ── API wrapper ───────────────────────────────────────────────────────────────

async function api(method, path, body = null) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : null,
    credentials: 'include',
  })
  const json = await res.json()
  if (!json.ok) throw new Error(json.error || 'Erreur serveur')
  return json.data
}

// ── Boot ──────────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', async () => {
  try {
    state.currentUser = await api('GET', '/api/auth/me')
    state.groupId = state.currentUser.groupId || 1
    document.getElementById('app').style.display = ''
    document.getElementById('nav-status').textContent = state.currentUser.name

    await Promise.all([loadMonths(), loadBalance(), loadGroupMembers()])
    renderSidebar()
    showGlobalView()
  } catch {
    window.location.href = '/index.html'
  }
})

async function loadMonths() {
  state.months = await api('GET', `/api/groups/${state.groupId}/months`)
}

async function loadBalance() {
  state.balance = await api('GET', `/api/groups/${state.groupId}/balance`)
}

async function loadGroupMembers() {
  try {
    const data = await api('GET', `/api/groups/${state.groupId}/members`)
    state.members = data
  } catch {
    if (state.currentUser) {
      state.members = [{ userId: state.currentUser.id, user: state.currentUser }]
    }
  }
}

async function loadCurrentMonth(id) {
  state.currentMonth = await api('GET', `/api/months/${id}`)
  state.currentMonthId = id
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function renderSidebar() {
  const container = document.getElementById('sidebar-months')
  const globalBtn = document.getElementById('sidebar-global')

  globalBtn.classList.toggle('active', state.currentMonthId === null)

  container.innerHTML = state.months.map(m => {
    const label = monthLabel(m.month, m.year)
    const badge = Math.abs(m.solde) < 0.01
      ? `<span class="badge badge-ok">OK</span>`
      : m.solde > 0
        ? `<span class="badge badge-err">${fmtAmount(m.solde)}</span>`
        : `<span class="badge badge-ok">${fmtAmount(Math.abs(m.solde))}</span>`
    const active = m.id === state.currentMonthId ? 'active' : ''
    return `<button class="sidebar-item ${active}" onclick="navigateToMonth(${m.id})">
      <span class="sidebar-month-label">${label}</span>
      ${badge}
    </button>`
  }).join('')
}

// ── Global view ───────────────────────────────────────────────────────────────

function showGlobalView() {
  state.currentMonthId = null
  state.currentMonth = null
  renderSidebar()
  renderGlobalView()
}

function renderGlobalView() {
  const b = state.balance
  if (!b) {
    document.getElementById('main-content').innerHTML = '<div class="empty"><div class="spinner"></div></div>'
    return
  }

  const bannerClass = Math.abs(b.solde) < 0.01 ? 'zero' : b.solde > 0 ? 'positive' : 'negative'
  const amountDisplay = Math.abs(b.solde) < 0.01 ? '0,00 €' : formatEuro(Math.abs(b.solde))

  const rows = [...(b.byMonth || [])].reverse().map(m => {
    const monthId = getMonthIdByKey(m.key)
    const soldeStyle = Math.abs(m.solde) < 0.01 ? '' : m.solde > 0 ? 'color:var(--err)' : 'color:var(--ok)'
    const cumulStyle = Math.abs(m.soldeCumul) < 0.01 ? '' : m.soldeCumul > 0 ? 'color:var(--err)' : 'color:var(--ok)'
    return `<tr class="clickable" onclick="navigateToMonth(${monthId})">
      <td>${monthLabel(m.month, m.year)}</td>
      <td class="mono">${formatEuro(m.totalFoyer)}</td>
      <td class="mono" style="color:var(--acc)">${formatEuro(m.avT)}</td>
      <td class="mono" style="color:var(--fox)">${formatEuro(m.avF)}</td>
      <td class="mono" style="${soldeStyle}">${formatEuro(m.solde)}</td>
      <td class="mono" style="${cumulStyle}">${formatEuro(m.soldeCumul)}</td>
    </tr>`
  }).join('')

  document.getElementById('main-content').innerHTML = `
    <div class="view-header">
      <span class="view-title display">Vue globale</span>
    </div>

    <div class="balance-banner ${bannerClass}">
      <div class="amount display">${amountDisplay}</div>
      <div class="label">${escHtml(b.soldeLabel)}</div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total foyer</div>
        <div class="stat-value mono">${formatEuro(b.totalFoyer)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Tanuki</div>
        <div class="stat-value mono" style="color:var(--acc)">${formatEuro(b.avT)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Fox</div>
        <div class="stat-value mono" style="color:var(--fox)">${formatEuro(b.avF)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Mois suivis</div>
        <div class="stat-value mono">${b.monthCount}</div>
      </div>
    </div>

    ${b.monthCount === 0 ? `
      <div class="empty">
        <div class="empty-icon">📅</div>
        <div class="empty-title">Aucun mois</div>
        <div class="empty-desc">Cliquez sur "+ Mois" pour commencer.</div>
      </div>
    ` : `
      <div class="card" style="padding:0;overflow:hidden">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mois</th>
                <th>Total</th>
                <th>Tanuki</th>
                <th>Fox</th>
                <th>Solde mois</th>
                <th>Solde cumulé</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `}
  `
}

function getMonthIdByKey(key) {
  const [year, month] = key.split('-').map(Number)
  const m = state.months.find(x => x.year === year && x.month === month)
  return m ? m.id : 0
}

// ── Month view ────────────────────────────────────────────────────────────────

async function navigateToMonth(id) {
  if (!id) return
  document.getElementById('main-content').innerHTML = '<div class="empty"><div class="spinner"></div></div>'
  try {
    await loadCurrentMonth(id)
    renderSidebar()
    renderMonthView()
  } catch (err) {
    showMainError(err.message)
  }
}

function renderMonthView() {
  const m = state.currentMonth
  if (!m) return

  const b = m.balance
  const bannerClass = Math.abs(b.solde) < 0.01 ? 'zero' : b.solde > 0 ? 'positive' : 'negative'
  const amountDisplay = Math.abs(b.solde) < 0.01 ? '0,00 €' : formatEuro(Math.abs(b.solde))

  const tanukiExpenses = m.expenses.filter(e => e.payer.name.toLowerCase() === 'tanuki')
  const foxExpenses = m.expenses.filter(e => e.payer.name.toLowerCase() === 'fox')
  const otherExpenses = m.expenses.filter(e => !['tanuki', 'fox'].includes(e.payer.name.toLowerCase()))

  document.getElementById('main-content').innerHTML = `
    <div class="view-header">
      <span class="view-title display">${monthLabel(m.month, m.year)}</span>
      <div class="view-actions">
        <button class="btn btn-ghost btn-sm" onclick="openDuplicateModal()">Dupliquer</button>
        <button class="btn btn-danger btn-sm" onclick="confirmDeleteMonth(${m.id})">Supprimer</button>
        <button class="btn btn-primary btn-sm" onclick="openExpenseModal()">+ Charge</button>
      </div>
    </div>

    <div class="balance-banner ${bannerClass}">
      <div class="amount display">${amountDisplay}</div>
      <div class="label">${escHtml(b.soldeLabel)}</div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total foyer</div>
        <div class="stat-value mono">${formatEuro(b.totalFoyer)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Tanuki a avancé</div>
        <div class="stat-value mono" style="color:var(--acc)">${formatEuro(b.avT)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Fox a avancé</div>
        <div class="stat-value mono" style="color:var(--fox)">${formatEuro(b.avF)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Charges</div>
        <div class="stat-value mono">${m.expenses.length}</div>
      </div>
    </div>

    ${m.expenses.length === 0 ? `
      <div class="empty">
        <div class="empty-icon">💸</div>
        <div class="empty-title">Aucune charge ce mois</div>
        <div class="empty-desc">Cliquez sur "+ Charge" pour ajouter une dépense.</div>
      </div>
    ` : `
      <div id="expenses-list">
        ${tanukiExpenses.length ? renderPayerSection('Tanuki', tanukiExpenses) : ''}
        ${foxExpenses.length ? renderPayerSection('Fox', foxExpenses) : ''}
        ${otherExpenses.length ? renderPayerSection('Autres', otherExpenses) : ''}
      </div>
    `}
  `
}

function renderPayerSection(name, expenses) {
  const bgColor = name.toLowerCase() === 'tanuki' ? '#c8f060' : name.toLowerCase() === 'fox' ? '#85b7eb' : '#888'
  const textColor = name.toLowerCase() === 'tanuki' ? 'var(--acc)' : name.toLowerCase() === 'fox' ? 'var(--fox)' : 'var(--txt)'

  const rows = expenses.map(e => {
    const calc = calcExpenseClient(e)
    const dueLabel = Math.abs(calc.partAutre) < 0.01
      ? 'Pas de remboursement'
      : e.payer.name.toLowerCase() === 'fox'
        ? `Tanuki doit ${formatEuro(calc.partAutre)}`
        : `Fox doit ${formatEuro(calc.partAutre)}`

    return `<div class="expense-row">
      <div class="avatar avatar-sm" style="background:${escHtml(e.payer.color || bgColor)};color:#111">${e.payer.name[0]}</div>
      <div class="expense-info">
        <div class="expense-label">${escHtml(e.label)}</div>
        <div class="expense-meta">
          <span>${escHtml(e.category)}</span>
          <span>${e.pct}% payeur</span>
          ${e.note ? `<span>${escHtml(e.note)}</span>` : ''}
        </div>
      </div>
      <div class="expense-amounts">
        <div class="expense-total mono">${formatEuro(parseFloat(e.amount))}</div>
        <div class="expense-due">${dueLabel}</div>
      </div>
      <div class="expense-actions">
        <button class="btn btn-ghost btn-sm" onclick="openExpenseModal(${e.id})" title="Modifier">✎</button>
        <button class="btn btn-danger btn-sm" onclick="confirmDeleteExpense(${e.id})" title="Supprimer">×</button>
      </div>
    </div>`
  }).join('')

  return `<div class="payer-section">
    <div class="payer-section-header">
      <div class="avatar avatar-sm" style="background:${bgColor};color:#111">${name[0]}</div>
      <span style="color:${textColor}">${name}</span>
    </div>
    <div class="card" style="padding:0">${rows}</div>
  </div>`
}

// ── Expense modal ─────────────────────────────────────────────────────────────

function openExpenseModal(expenseId = null) {
  editingExpenseId = expenseId
  document.getElementById('modal-expense-title').textContent = expenseId ? 'Modifier la charge' : 'Nouvelle charge'
  document.getElementById('modal-expense-alert').style.display = 'none'

  renderPayerToggle()

  if (expenseId) {
    const expense = state.currentMonth.expenses.find(e => e.id === expenseId)
    if (expense) {
      document.getElementById('exp-label').value = expense.label
      document.getElementById('exp-amount').value = parseFloat(expense.amount)
      document.getElementById('exp-category').value = expense.category
      document.getElementById('exp-pct').value = expense.pct
      document.getElementById('exp-note').value = expense.note || ''
      setPayerById(expense.payer.id)
      syncPctButtons(expense.pct)
    }
  } else {
    document.getElementById('form-expense').reset()
    document.getElementById('exp-pct').value = 50
    syncPctButtons(50)
    if (state.members.length > 0) setPayerById(state.members[0].userId)
  }

  updateCalcHint()
  document.getElementById('modal-expense').style.display = 'flex'
  setTimeout(() => document.getElementById('exp-label').focus(), 50)
}

function closeExpenseModal(e) {
  if (e && e.target !== document.getElementById('modal-expense')) return
  document.getElementById('modal-expense').style.display = 'none'
}

function renderPayerToggle() {
  const container = document.getElementById('payer-toggle')
  container.innerHTML = state.members.map(m => {
    const color = m.user.color || '#888'
    return `<button type="button" class="payer-toggle-btn" data-payer-id="${m.userId}" onclick="setPayerById(${m.userId})">
      <div class="avatar avatar-sm" style="background:${escHtml(color)};color:#111">${m.user.name[0]}</div>
      ${escHtml(m.user.name)}
    </button>`
  }).join('')
}

function setPayerById(userId) {
  document.querySelectorAll('.payer-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.payerId) === userId)
  })
  updateCalcHint()
}

function getSelectedPayerId() {
  const active = document.querySelector('.payer-toggle-btn.active')
  return active ? parseInt(active.dataset.payerId) : state.members[0]?.userId
}

function getSelectedPayerName() {
  const id = getSelectedPayerId()
  const member = state.members.find(m => m.userId === id)
  return member?.user.name || ''
}

function setPct(value) {
  document.getElementById('exp-pct').value = value
  syncPctButtons(value)
  updateCalcHint()
}

function onPctInput() {
  syncPctButtons(parseInt(document.getElementById('exp-pct').value) || 0)
  updateCalcHint()
}

function syncPctButtons(val) {
  const btns = document.querySelectorAll('.pct-btn')
  btns.forEach(b => b.classList.remove('active'))
  const map = { 0: 0, 50: 1, 100: 2 }
  if (val in map) btns[map[val]]?.classList.add('active')
}

function updateCalcHint() {
  const amount = parseFloat(document.getElementById('exp-amount')?.value) || 0
  const rawPct = parseInt(document.getElementById('exp-pct')?.value)
  const pct = isNaN(rawPct) ? 50 : rawPct
  const payerName = getSelectedPayerName()
  const hint = document.getElementById('calc-hint')
  if (!hint) return

  if (!amount || !payerName) { hint.textContent = '—'; return }

  const partPayeur = Math.round(amount * pct / 100 * 100) / 100
  const partAutre  = Math.round((amount - partPayeur) * 100) / 100
  const otherName  = payerName.toLowerCase() === 'tanuki' ? 'Fox' : 'Tanuki'

  hint.textContent = partAutre < 0.01
    ? `${payerName} assume tout (${formatEuro(partPayeur)}) — ${otherName} ne doit rien`
    : `${payerName} assume ${formatEuro(partPayeur)} — ${otherName} doit ${formatEuro(partAutre)} à ${payerName}`
}

async function handleSaveExpense(e) {
  e.preventDefault()
  const btn = document.getElementById('btn-save-expense')
  btn.disabled = true

  const data = {
    label: document.getElementById('exp-label').value,
    amount: parseFloat(document.getElementById('exp-amount').value),
    payerId: getSelectedPayerId(),
    pct: parseInt(document.getElementById('exp-pct').value),
    category: document.getElementById('exp-category').value,
    note: document.getElementById('exp-note').value,
  }

  try {
    if (editingExpenseId) {
      await api('PUT', `/api/expenses/${editingExpenseId}`, data)
    } else {
      await api('POST', `/api/months/${state.currentMonthId}/expenses`, data)
    }
    document.getElementById('modal-expense').style.display = 'none'
    await refreshMonthAndBalance()
  } catch (err) {
    const alertEl = document.getElementById('modal-expense-alert')
    alertEl.textContent = err.message
    alertEl.style.display = ''
  } finally {
    btn.disabled = false
  }
}

// ── Month modal ────────────────────────────────────────────────────────────────

function openMonthModal() {
  const now = new Date()
  document.getElementById('new-month').value = now.getMonth() + 1
  document.getElementById('new-year').value = now.getFullYear()
  document.getElementById('modal-month-alert').style.display = 'none'
  document.getElementById('modal-month').style.display = 'flex'
}

function closeMonthModal(e) {
  if (e && e.target !== document.getElementById('modal-month')) return
  document.getElementById('modal-month').style.display = 'none'
}

async function handleCreateMonth(e) {
  e.preventDefault()
  try {
    const month = parseInt(document.getElementById('new-month').value)
    const year  = parseInt(document.getElementById('new-year').value)
    await api('POST', `/api/groups/${state.groupId}/months`, { month, year })
    document.getElementById('modal-month').style.display = 'none'
    await refreshAll()
  } catch (err) {
    const alertEl = document.getElementById('modal-month-alert')
    alertEl.textContent = err.message
    alertEl.style.display = ''
  }
}

// ── Duplicate modal ───────────────────────────────────────────────────────────

function openDuplicateModal() {
  const m = state.currentMonth
  let nextMonth = m.month + 1, nextYear = m.year
  if (nextMonth > 12) { nextMonth = 1; nextYear++ }
  document.getElementById('dup-month').value = nextMonth
  document.getElementById('dup-year').value = nextYear
  document.getElementById('modal-dup-alert').style.display = 'none'
  document.getElementById('modal-duplicate').style.display = 'flex'
}

function closeDuplicateModal(e) {
  if (e && e.target !== document.getElementById('modal-duplicate')) return
  document.getElementById('modal-duplicate').style.display = 'none'
}

async function handleDuplicate(e) {
  e.preventDefault()
  try {
    const targetMonth = parseInt(document.getElementById('dup-month').value)
    const targetYear  = parseInt(document.getElementById('dup-year').value)
    const result = await api('POST', `/api/months/${state.currentMonthId}/duplicate`, { targetMonth, targetYear })
    document.getElementById('modal-duplicate').style.display = 'none'
    await refreshAll()
    await navigateToMonth(result.targetMonthId)
  } catch (err) {
    const alertEl = document.getElementById('modal-dup-alert')
    alertEl.textContent = err.message
    alertEl.style.display = ''
  }
}

// ── Delete actions ────────────────────────────────────────────────────────────

async function confirmDeleteMonth(id) {
  if (!confirm('Supprimer ce mois et toutes ses charges ?')) return
  try {
    await api('DELETE', `/api/months/${id}`)
    state.currentMonthId = null
    state.currentMonth = null
    await refreshAll()
    showGlobalView()
  } catch (err) {
    alert(err.message)
  }
}

async function confirmDeleteExpense(id) {
  if (!confirm('Supprimer cette charge ?')) return
  try {
    await api('DELETE', `/api/expenses/${id}`)
    await refreshMonthAndBalance()
  } catch (err) {
    alert(err.message)
  }
}

// ── Data modal ────────────────────────────────────────────────────────────────

function openDataModal() {
  switchDataTab('summary')
  renderDataSummary()
  document.getElementById('modal-data').style.display = 'flex'
}

function closeDataModal(e) {
  if (e && e.target !== document.getElementById('modal-data')) return
  document.getElementById('modal-data').style.display = 'none'
}

function switchDataTab(tab) {
  ;['summary', 'export', 'import'].forEach(t => {
    document.getElementById(`tab-${t}`).classList.toggle('active', t === tab)
    document.getElementById(`data-tab-${t}`).style.display = t === tab ? '' : 'none'
  })
}

function renderDataSummary() {
  const container = document.getElementById('data-summary-content')
  if (!container) return
  const b = state.balance

  if (!b || b.monthCount === 0) {
    container.innerHTML = '<div class="empty" style="padding:24px 0"><div class="empty-title">Aucune donnée</div><div class="empty-desc">Ajoutez des mois et des charges pour voir le résumé.</div></div>'
    return
  }

  const totalExpenses = state.months.reduce((acc, m) => acc + (m.expenseCount || 0), 0)
  const topMonth = [...state.months].sort((a, b) => b.expenseCount - a.expenseCount)[0]
  const avgMonthly = b.monthCount > 0 ? b.totalFoyer / b.monthCount : 0
  const bannerClass = Math.abs(b.solde) < 0.01 ? 'zero' : b.solde > 0 ? 'positive' : 'negative'
  const amountDisplay = Math.abs(b.solde) < 0.01 ? '0,00 €' : formatEuro(Math.abs(b.solde))

  container.innerHTML = `
    <div class="balance-banner ${bannerClass}" style="margin-bottom:16px">
      <div class="amount display">${amountDisplay}</div>
      <div class="label">${escHtml(b.soldeLabel)}</div>
    </div>
    <div class="stats-grid" style="margin-bottom:16px">
      <div class="stat-card">
        <div class="stat-label">Tanuki a avancé</div>
        <div class="stat-value mono" style="color:var(--acc)">${formatEuro(b.avT)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Fox a avancé</div>
        <div class="stat-value mono" style="color:var(--fox)">${formatEuro(b.avF)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Mois enregistrés</div>
        <div class="stat-value mono">${b.monthCount}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Charges totales</div>
        <div class="stat-value mono">${totalExpenses}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="card card-sm">
        <div style="font-size:11px;color:var(--muted);margin-bottom:4px">Moyenne mensuelle</div>
        <div class="mono" style="font-size:18px;font-weight:600">${formatEuro(avgMonthly)}</div>
      </div>
      <div class="card card-sm">
        <div style="font-size:11px;color:var(--muted);margin-bottom:4px">Mois le + chargé</div>
        <div style="font-size:14px;font-weight:500">${topMonth ? escHtml(monthLabel(topMonth.month, topMonth.year)) : '—'}</div>
        ${topMonth && topMonth.expenseCount > 0 ? `<div style="font-size:11px;color:var(--muted)">${topMonth.expenseCount} charge${topMonth.expenseCount > 1 ? 's' : ''}</div>` : ''}
      </div>
    </div>
  `
}

function exportJSON() {
  const data = {
    months: state.months,
    balance: state.balance,
    exportedAt: new Date().toISOString(),
  }
  downloadFile('splitr-export.json', JSON.stringify(data, null, 2), 'application/json')
}

function exportCSV() {
  const lines = ['mois,annee,label,montant,payeur,pct,categorie,note']
  for (const m of state.months) {
    for (const e of (m.expenses || [])) {
      lines.push([
        m.month, m.year,
        csvEsc(e.label), e.amount,
        e.payer?.name || '', e.pct,
        e.category, csvEsc(e.note || ''),
      ].join(','))
    }
  }
  downloadFile('splitr-export.csv', lines.join('\n'), 'text/csv')
}

async function importJSON() {
  const text = (document.getElementById('import-paste')?.value || '').trim()
  if (!text) { alert('Collez votre JSON dans la zone de texte'); return }

  const resultEl = document.getElementById('import-result')
  resultEl.textContent = 'Import en cours...'

  try {
    const raw = JSON.parse(text)
    const months = normalizeImportData(raw)
    let totalInserted = 0, totalSkipped = 0

    for (const m of months) {
      if (!m.expenses.length) continue

      let monthId
      try {
        const created = await api('POST', `/api/groups/${state.groupId}/months`, { month: m.month, year: m.year })
        monthId = created.id
      } catch {
        const existing = state.months.find(x => x.month === m.month && x.year === m.year)
        if (existing) monthId = existing.id
        else continue
      }

      const result = await api('POST', `/api/months/${monthId}/expenses/import`, { rows: m.expenses })
      totalInserted += result.inserted
      totalSkipped  += result.skipped
    }

    resultEl.textContent = `Import terminé : ${totalInserted} charges insérées, ${totalSkipped} ignorées.`
    await refreshAll()
    if (state.currentMonthId) await navigateToMonth(state.currentMonthId)
    else showGlobalView()
  } catch (err) {
    resultEl.textContent = 'Erreur : ' + err.message
  }
}

function normalizeImportData(raw) {
  let months = raw.months || []

  if (!Array.isArray(months)) {
    months = Object.values(months)
  }

  return months.map(m => {
    let charges = m.charges || m.expenses || []

    if (!Array.isArray(charges)) {
      charges = Object.values(charges)
    }

    const expenses = charges.map(c => ({
      label: c.label || c.libelle || '',
      amount: parseFloat(c.amount ?? c.montant ?? 0),
      payerName: c.payerName || c.payer?.name || c.payeur || '',
      pct: parseInt(c.pct ?? 50),
      category: c.category || c.categorie || 'autre',
      note: c.note || '',
    }))

    const [keyYear, keyMonth] = (m.key || '').split('-').map(Number)
    return {
      month: m.month || keyMonth || 0,
      year: m.year || keyYear || 0,
      expenses,
    }
  }).filter(m => m.month >= 1 && m.month <= 12 && m.year >= 2000)
}

// ── Refresh helpers ───────────────────────────────────────────────────────────

async function refreshAll() {
  await Promise.all([loadMonths(), loadBalance()])
  renderSidebar()
  if (state.currentMonthId === null) renderGlobalView()
}

async function refreshMonthAndBalance() {
  await Promise.all([loadCurrentMonth(state.currentMonthId), loadMonths(), loadBalance()])
  renderSidebar()
  renderMonthView()
}

// ── Auth ──────────────────────────────────────────────────────────────────────

async function handleLogout() {
  try { await api('POST', '/api/auth/logout') } catch {}
  window.location.href = '/index.html'
}

// ── Client-side calc mirror ───────────────────────────────────────────────────

function calcExpenseClient(expense) {
  const amount = Math.round(parseFloat(expense.amount) * 100) / 100
  const rawPct = parseInt(expense.pct)
  const pct    = Math.max(0, Math.min(100, isNaN(rawPct) ? 50 : rawPct))
  const partPayeur = Math.round(amount * pct / 100 * 100) / 100
  const partAutre  = Math.round((amount - partPayeur) * 100) / 100
  const dueT = expense.payer.name.toLowerCase() === 'fox' ? partAutre : -partAutre
  return { partPayeur, partAutre, dueT }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

function monthLabel(m, y) { return `${MONTHS_FR[m - 1]} ${y}` }

function formatEuro(v) {
  return new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(v)
}

function fmtAmount(v) {
  return new Intl.NumberFormat('fr-BE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v) + ' €'
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function csvEsc(str) {
  const s = String(str)
  return (s.includes(',') || s.includes('"') || s.includes('\n'))
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

function downloadFile(name, content, mime) {
  const blob = new Blob([content], { type: mime })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = name; a.click()
  URL.revokeObjectURL(url)
}

function showMainError(msg) {
  document.getElementById('main-content').innerHTML = `<div class="alert alert-err">${escHtml(msg)}</div>`
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'Enter') {
    if (document.getElementById('modal-expense').style.display !== 'none') {
      document.getElementById('form-expense').requestSubmit()
    }
  }
  if (e.key === 'Escape') {
    ['modal-expense','modal-month','modal-duplicate','modal-data'].forEach(id => {
      document.getElementById(id).style.display = 'none'
    })
  }
})

document.addEventListener('input', e => {
  if (e.target.id === 'exp-amount' || e.target.id === 'exp-pct') updateCalcHint()
})
