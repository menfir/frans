import { useState } from 'react'
import { type Card, DIRS, stats } from '../leitner'
import { shareLink } from '../store'

/** Per week: hoeveel woorden, en hoeveel daarvan al goed vastzitten (box 5+ in beide richtingen). */
function perWeek(cards: Card[]) {
  const weken = new Map<string, { totaal: number; sterk: number }>()
  for (const c of cards) {
    const w = weken.get(c.week) ?? { totaal: 0, sterk: 0 }
    w.totaal++
    if (DIRS.every((d) => c.box[d] >= 5)) w.sterk++
    weken.set(c.week, w)
  }
  return [...weken.entries()].sort((a, b) => b[0].localeCompare(a[0]))
}

type Props = {
  cards: Card[]
  onStart: (week?: string) => void
  onImport: () => void
  onEdit: () => void
}

export default function Home({ cards, onStart, onImport, onEdit }: Props) {
  const [week, setWeek] = useState('')
  const [gedeeld, setGedeeld] = useState('')
  const s = stats(cards, Date.now())
  const weken = perWeek(cards)

  async function deel(w: string) {
    const pairs = cards.filter((c) => c.week === w).map(({ fr, nl }) => ({ fr, nl }))
    const link = await shareLink(w, pairs)
    try {
      await navigator.clipboard.writeText(link)
      setGedeeld(`Link naar ${w} gekopieerd.`)
    } catch {
      // Clipboard mag geweigerd worden; dan toont hij de link gewoon.
      setGedeeld(link)
    }
  }

  return (
    <div className="mx-auto max-w-md p-4">
      <h1 className="mt-4 mb-6 text-3xl font-bold">Frans oefenen</h1>

      {cards.length === 0 ? (
        <p className="mb-6 rounded-xl bg-blue-50 p-4 text-slate-700">
          Nog geen woorden. Voeg het lijstje van deze week toe om te beginnen.
        </p>
      ) : (
        <div className="mb-6 grid grid-cols-3 gap-3 text-center">
          {[
            ['woorden', s.woorden],
            ['te herhalen', s.teHerhalen],
            ['nieuw', s.nieuw],
          ].map(([label, n]) => (
            <div key={label} className="rounded-xl bg-slate-100 p-3">
              <div className="text-2xl font-bold">{n}</div>
              <div className="text-xs text-slate-600">{label}</div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => onStart(week || undefined)}
        disabled={cards.length === 0}
        className="mb-3 w-full rounded-xl bg-blue-600 py-5 text-xl font-semibold text-white disabled:opacity-40"
      >
        Oefenen
      </button>

      {weken.length > 0 && (
        <select
          value={week}
          onChange={(e) => setWeek(e.target.value)}
          className="mb-6 w-full rounded-xl border-2 border-slate-300 bg-white p-3"
        >
          <option value="">Alle woorden — volgens het herhaalschema</option>
          {weken.map(([w]) => (
            <option key={w} value={w}>
              Alleen {w} — blokken voor een toets
            </option>
          ))}
        </select>
      )}

      <button
        onClick={onImport}
        className="mb-3 w-full rounded-xl border-2 border-slate-300 py-4 font-semibold text-slate-700"
      >
        + Woorden toevoegen
      </button>

      {cards.length > 0 && (
        <button onClick={onEdit} className="mb-8 w-full py-2 text-slate-500">
          Woorden aanpassen
        </button>
      )}

      {weken.length > 0 && (
        <>
          <h2 className="mb-2 font-semibold text-slate-700">Per week</h2>
          <div className="rounded-xl border border-slate-200">
            {weken.map(([w, { totaal, sterk }]) => (
              <div
                key={w}
                className="flex items-center gap-3 border-b border-slate-100 p-3 last:border-0"
              >
                <span className="font-mono text-sm">{w}</span>
                <div className="h-2 flex-1 rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-emerald-500"
                    style={{ width: `${(sterk / totaal) * 100}%` }}
                  />
                </div>
                <span className="text-sm whitespace-nowrap text-slate-500">
                  {sterk}/{totaal}
                </span>
                <button onClick={() => deel(w)} className="text-slate-400" aria-label="Deel week">
                  🔗
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {gedeeld && <p className="mt-3 text-sm break-all text-emerald-700">{gedeeld}</p>}
    </div>
  )
}
