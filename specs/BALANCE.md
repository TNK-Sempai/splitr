# Splitr — Balance

## Vue d'ensemble

Le calcul des soldes est la pièce centrale de Splitr. Toute la logique réside dans `lib/calc.js`. Ce module ne touche jamais à la BDD — il reçoit des données et retourne des calculs.

---

## Fichier à créer

`lib/calc.js`

---

## Fonctions attendues

### calcExpense(expense)

Calcule la répartition d'une dépense individuelle.

**Input :**
```js
{
  amount: 1120.00,     // Decimal ou number
  pct: 50,             // 0-100
  payer: {
    id: 2,
    name: "Fox"        // utilisé pour déterminer le sens du solde
  }
}
```

**Output :**
```js
{
  partPayeur: 560.00,  // part assumée par le payeur
  partAutre: 560.00,   // part que l'autre doit rembourser
  dueT: 560.00         // > 0 : Tanuki doit à Fox / < 0 : Fox doit à Tanuki
}
```

**Logique :**
```js
const amount = round2(parseFloat(expense.amount))
const pct = Math.max(0, Math.min(100, parseInt(expense.pct) || 50))
const partPayeur = round2(amount * pct / 100)
const partAutre  = round2(amount - partPayeur)
const dueT = expense.payer.name.toLowerCase() === 'fox' ? partAutre : -partAutre
return { partPayeur, partAutre, dueT }
```

---

### calcMonth(expenses)

Calcule le bilan d'un mois à partir de la liste de ses dépenses.

**Input :** tableau d'expenses avec leur `payer`

**Output :**
```js
{
  totalFoyer: 1607.99,  // somme de tous les montants
  avT: 141.99,          // total avancé par Tanuki
  avF: 1466.00,         // total avancé par Fox
  solde: 662.01,        // > 0 : Tanuki doit à Fox
  soldeLabel: "Tanuki doit 662,01 € à Fox"
}
```

**Logique :**
```js
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
```

---

### calcGlobal(months)

Calcule la balance globale sur tous les mois.

**Input :** tableau de résultats `calcMonth`

**Output :**
```js
{
  totalFoyer: 45230.50,
  avT: 8420.00,
  avF: 36810.50,
  solde: 4088.76,          // cumulatif de tous les mois
  soldeLabel: "Tanuki doit 4 088,76 € à Fox",
  monthCount: 44,
  // Détail par mois pour le tableau overview
  byMonth: [
    {
      key: "2026-06",
      month: 6,
      year: 2026,
      totalFoyer: 1607.99,
      avT: 141.99,
      avF: 1466.00,
      solde: 662.01,
      soldeCumul: 4088.76   // solde cumulé jusqu'à ce mois
    }
  ]
}
```

---

### Utilitaires internes

```js
// Arrondi à 2 décimales — évite les erreurs flottantes
function round2(v) {
  return Math.round(v * 100) / 100
}

// Format monétaire fr-BE
function formatCurrency(v) {
  return new Intl.NumberFormat('fr-BE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(v)
}
```

---

## Route balance

### GET /api/groups/:groupId/balance

Retourne la balance globale du groupe, tous mois confondus.

Fichier : `api/balance.js`

**Succès (200) :**
```json
{
  "ok": true,
  "data": {
    "totalFoyer": 45230.50,
    "avT": 8420.00,
    "avF": 36810.50,
    "solde": 4088.76,
    "soldeLabel": "Tanuki doit 4 088,76 € à Fox",
    "monthCount": 44,
    "byMonth": [
      {
        "key": "2022-10",
        "month": 10,
        "year": 2022,
        "totalFoyer": 2080.73,
        "avT": 659.87,
        "avF": 1420.86,
        "solde": 380.56,
        "soldeCumul": 380.56
      }
    ]
  }
}
```

**Notes :**
- `byMonth` est trié chronologiquement (ASC) pour le calcul du cumulatif
- Le frontend affiche les mois en ordre inverse (DESC)
- Le calcul est entièrement fait en JS via `lib/calc.js`, pas en SQL

---

## Règles de précision

- Toujours utiliser `round2()` après chaque opération arithmétique
- Ne jamais accumuler des valeurs non arrondies
- `Decimal` Prisma → `parseFloat()` avant calcul → `round2()` après
- Les montants stockés en BDD sont `Decimal(10,2)` → pas de dérive possible à la source
