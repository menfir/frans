import { useMemo, useState } from 'react'
import type { Card } from '../leitner'

/** Kaarten in weergavevolgorde (nieuwste week eerst), elk met zijn plaats in de originele lijst. */
export function gesorteerd(cards: Card[], zoek: string): [Card, number][] {
  const q = zoek.trim().toLowerCase()
  return cards
    .map((c, i): [Card, number] => [c, i])
    .filter(([c]) => !q || c.fr.toLowerCase().includes(q) || c.nl.toLowerCase().includes(q))
    .sort(([a], [b]) => b.week.localeCompare(a.week) || a.fr.localeCompare(b.fr))
}

type Props = {
  cards: Card[]
  onChange: (cards: Card[]) => void
  onExit: () => void
}

export default function Woorden({ cards, onChange, onExit }: Props) {
  const [zoek, setZoek] = useState('')
  const rijen = useMemo(() => gesorteerd(cards, zoek), [cards, zoek])
  // Een leeg veld geeft een onbeantwoordbare vraag; daarmee mag je het scherm niet verlaten.
  const onvolledig = cards.some((c) => !c.fr.trim() || !c.nl.trim())

  // Alleen de tekst wijzigt: box en due blijven staan, want een tikfout verbeteren
  // mag de opgebouwde voortgang niet kosten.
  const wijzig = (i: number, veld: 'fr' | 'nl', waarde: string) =>
    onChange(cards.map((c, j) => (j === i ? { ...c, [veld]: waarde } : c)))

  function verwijder(i: number) {
    const c = cards[i]
    if (confirm(`"${c.fr} = ${c.nl}" verwijderen? De voortgang gaat mee weg.`)) {
      onChange(cards.filter((_, j) => j !== i))
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-4">
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={onExit}
          disabled={onvolledig}
          className="text-slate-500 disabled:opacity-30"
          aria-label="Terug"
        >
          ✕
        </button>
        <h1 className="text-2xl font-bold">Woorden aanpassen</h1>
      </div>

      <input
        value={zoek}
        onChange={(e) => setZoek(e.target.value)}
        placeholder="Zoek een woord"
        className="mb-4 w-full rounded-lg border-2 border-slate-300 p-2 focus:border-blue-500 focus:outline-none"
      />

      {onvolledig && (
        <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Vul beide velden in — een leeg woord kan hij niet oefenen.
        </p>
      )}

      <div className="mb-4 rounded-lg border border-slate-200">
        {rijen.map(([c, i]) => (
          <div key={i} className="flex items-center gap-2 border-b border-slate-100 p-2 last:border-0">
            <span className="w-20 shrink-0 font-mono text-xs text-slate-400">{c.week}</span>
            <input
              value={c.fr}
              onChange={(e) => wijzig(i, 'fr', e.target.value)}
              aria-label="Frans"
              className={`min-w-0 flex-1 rounded border px-2 py-1 ${c.fr.trim() ? 'border-slate-200' : 'border-amber-400'}`}
            />
            <input
              value={c.nl}
              onChange={(e) => wijzig(i, 'nl', e.target.value)}
              aria-label="Nederlands"
              className={`min-w-0 flex-1 rounded border px-2 py-1 ${c.nl.trim() ? 'border-slate-200' : 'border-amber-400'}`}
            />
            <button
              onClick={() => verwijder(i)}
              className="shrink-0 px-2 text-slate-400"
              aria-label={`Verwijder ${c.fr}`}
            >
              🗑
            </button>
          </div>
        ))}
        {rijen.length === 0 && (
          <p className="p-4 text-center text-slate-500">Geen woord gevonden.</p>
        )}
      </div>

      <button
        onClick={onExit}
        disabled={onvolledig}
        className="w-full rounded-xl bg-blue-600 py-4 text-lg font-semibold text-white disabled:opacity-40"
      >
        Klaar
      </button>
    </div>
  )
}
