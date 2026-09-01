import { useMemo, useState } from 'react'
import type { Card } from '../leitner'
import { type Pair, currentWeek, existing } from '../store'

/** Splitst een geplakte regel op de eerste scheider die we tegenkomen. */
function parseLine(line: string): Pair | null {
  const m = line.match(/^(.*?)(?:\s*[=:\t]\s*|\s+-\s+|\s{2,})(.*)$/)
  if (!m) return null
  const [, fr, nl] = m
  return fr.trim() && nl.trim() ? { fr: fr.trim(), nl: nl.trim() } : null
}

export const parseList = (text: string): Pair[] =>
  text.split('\n').map(parseLine).filter((p): p is Pair => p !== null)

type Props = {
  cards: Card[]
  /** Tekst die vanuit een andere app gedeeld is; vult het tekstvak meteen in. */
  initialText?: string
  onAdd: (pairs: Pair[], week: string) => void
  onCancel: () => void
}

export default function Import({ cards, initialText = '', onAdd, onCancel }: Props) {
  const [text, setText] = useState(initialText)
  const [week, setWeek] = useState(currentWeek())
  // Bewerkbare regels: OCR van Google Lens is nooit schoon, dus je moet kunnen corrigeren.
  const [edits, setEdits] = useState<Pair[] | null>(null)

  const parsed = useMemo(() => edits ?? parseList(text), [text, edits])
  const dubbel = useMemo(() => existing(cards, parsed), [cards, parsed])
  const nieuwe = parsed.length - dubbel.size
  const onherkend = text.split('\n').filter((l) => l.trim() && !parseLine(l)).length

  function edit(i: number, veld: keyof Pair, waarde: string) {
    setEdits(parsed.map((p, j) => (i === j ? { ...p, [veld]: waarde } : p)))
  }

  return (
    <div className="mx-auto max-w-2xl p-4">
      <div className="mb-4 flex items-center gap-3">
        <button onClick={onCancel} className="text-slate-500" aria-label="Terug">
          ✕
        </button>
        <h1 className="text-2xl font-bold">Woorden toevoegen</h1>
      </div>

      <div className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-slate-700">
        <p className="mb-2">
          Maak een foto van het lijstje met <strong>Google Lens</strong>, selecteer de tekst en
          kies <strong>Delen → Frans oefenen</strong>. De tekst komt dan hier vanzelf terecht.
        </p>
        <p>
          Kopiëren en hieronder plakken werkt ook. Eén woordpaar per regel, gescheiden door{' '}
          <code>=</code>, een tab of twee spaties.
        </p>
      </div>

      <label className="mb-1 block text-sm font-medium text-slate-600">Week</label>
      <input
        value={week}
        onChange={(e) => setWeek(e.target.value)}
        className="mb-4 w-40 rounded-lg border-2 border-slate-300 p-2 focus:border-blue-500 focus:outline-none"
      />

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setEdits(null) // opnieuw plakken gooit handmatige correcties weg
        }}
        rows={8}
        placeholder={'la maison = het huis\nle chien = de hond'}
        className="w-full rounded-lg border-2 border-slate-300 p-3 font-mono text-sm focus:border-blue-500 focus:outline-none"
      />

      {onherkend > 0 && (
        <p className="mt-2 text-sm text-amber-700">
          {onherkend} regel(s) niet herkend — zet er een <code>=</code> tussen.
        </p>
      )}

      {parsed.length > 0 && (
        <>
          <h2 className="mt-6 mb-2 font-semibold">
            {parsed.length} herkend · {nieuwe} nieuw
            {dubbel.size > 0 && ` · ${dubbel.size} bestaat al`}
          </h2>
          <div className="mb-4 max-h-80 overflow-y-auto rounded-lg border border-slate-200">
            {parsed.map((p, i) => {
              const bestaat = dubbel.has(`${p.fr}|${p.nl}`) || existing(cards, [p]).size > 0
              return (
                <div
                  key={i}
                  className={`flex gap-2 border-b border-slate-100 p-2 ${bestaat ? 'bg-slate-50 opacity-60' : ''}`}
                >
                  <input
                    value={p.fr}
                    onChange={(e) => edit(i, 'fr', e.target.value)}
                    className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1"
                  />
                  <input
                    value={p.nl}
                    onChange={(e) => edit(i, 'nl', e.target.value)}
                    className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1"
                  />
                  {bestaat && (
                    <span className="self-center text-xs whitespace-nowrap text-slate-500">
                      bestaat al
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      <button
        onClick={() => onAdd(parsed, week.trim() || currentWeek())}
        disabled={nieuwe === 0}
        className="w-full rounded-xl bg-blue-600 py-4 text-lg font-semibold text-white disabled:opacity-40"
      >
        {nieuwe > 0 ? `${nieuwe} woord(en) toevoegen` : 'Niets nieuws om toe te voegen'}
      </button>
    </div>
  )
}
