import { useEffect, useRef, useState } from 'react'
import {
  type Card,
  type Dir,
  type Grade,
  type Item,
  answer,
  buildExtraSession,
  buildSession,
  grade,
  question,
} from '../leitner'
import { canListen, listen, speak } from '../speech'

/** Taal waarin het antwoord verwacht wordt — alleen voor de spraakherkenning. */
const answerLang = (dir: Dir) => (dir === 'frnl' ? 'nl-BE' : 'fr-FR')

// Voorlezen doen we uitsluitend voor het Franse woord, en dat is altijd card.fr:
// bij FR→NL is dat de vraag, bij NL→FR het antwoord.

const FEEDBACK: Record<Grade, { titel: string; klasse: string }> = {
  goed: { titel: 'Juist!', klasse: 'bg-emerald-100 text-emerald-900' },
  accent: { titel: 'Juist — let op de accenten', klasse: 'bg-emerald-100 text-emerald-900' },
  bijna: { titel: 'Bijna!', klasse: 'bg-amber-100 text-amber-900' },
  fout: { titel: 'Niet juist', klasse: 'bg-rose-100 text-rose-900' },
}

type Props = {
  cards: Card[]
  week?: string
  /** Alleen de beoordeling doorgeven; App past ze toe op de actuele kaart. De items in
   *  de wachtrij zijn een momentopname en zouden een eerder antwoord overschrijven. */
  onAnswer: (card: Card, dir: Dir, g: Grade, extra: boolean) => void
  onExit: () => void
}

export default function Quiz({ cards, week, onAnswer, onExit }: Props) {
  // Sessie één keer samenstellen; hij mag niet herschikken bij elk antwoord.
  // Is er niets vervallen, dan toch laten oefenen — maar buiten het schema.
  const [{ queue: startQueue, extra }] = useState(() => {
    const gepland = buildSession(cards, Date.now(), week)
    return gepland.length > 0
      ? { queue: gepland, extra: false }
      : { queue: buildExtraSession(cards, week), extra: true }
  })
  const [queue, setQueue] = useState<Item[]>(startQueue)
  const [typed, setTyped] = useState('')
  const [result, setResult] = useState<{ g: Grade; gegeven: string } | null>(null)
  const [luistert, setLuistert] = useState(false)
  const [micFout, setMicFout] = useState('')
  const [gedaan, setGedaan] = useState({ goed: 0, totaal: 0 })
  const stopListening = useRef<() => void>(() => {})
  const inputRef = useRef<HTMLInputElement>(null)

  const item = queue[0]
  // Beginlengte één keer vastleggen voor de voortgangsbalk; de wachtrij zelf krimpt.
  const [totaalStart] = useState(queue.length)

  // Franse vraag automatisch voorlezen: gratis luistertraining.
  useEffect(() => {
    if (item && item.dir === 'frnl') speak(item.card.fr, 'fr-FR')
    return () => stopListening.current()
  }, [item])

  // Bij NL→FR zit het Franse woord in het antwoord. Spreek het uit zodra dat getoond
  // wordt: hij moet de uitspraak horen, zeker als hij ze nog niet kende.
  useEffect(() => {
    if (result && item?.dir === 'nlfr') speak(item.card.fr, 'fr-FR')
  }, [result, item])

  if (!item) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <h1 className="mb-2 text-3xl font-bold">Klaar!</h1>
        <p className="mb-8 text-lg text-slate-600">
          {gedaan.totaal === 0
            ? 'Niets te oefenen op dit moment. Kom later terug of voeg woorden toe.'
            : `${gedaan.goed} van ${gedaan.totaal} juist.`}
        </p>
        <button
          onClick={onExit}
          className="w-full rounded-xl bg-blue-600 py-4 text-lg font-semibold text-white"
        >
          Terug
        </button>
      </div>
    )
  }

  function beoordeel(gegeven: string) {
    if (!item || result) return
    const g = grade(gegeven, answer({ card: item.card, dir: item.dir }))
    setResult({ g, gegeven })
    setGedaan((s) => ({ goed: s.goed + (g === 'goed' || g === 'accent' ? 1 : 0), totaal: s.totaal + 1 }))
    onAnswer(item.card, item.dir, g, extra)
  }

  function volgende() {
    if (!item) return
    const fout = result && result.g !== 'goed' && result.g !== 'accent'
    // Fout? Achteraan in de rij, zodat het deze sessie nog eens terugkomt.
    setQueue((q) => (fout ? [...q.slice(1), q[0]] : q.slice(1)))
    setResult(null)
    setTyped('')
    setMicFout('')
    inputRef.current?.focus()
  }

  function spreek() {
    if (luistert) {
      stopListening.current()
      setLuistert(false)
      return
    }
    setMicFout('')
    setLuistert(true)
    stopListening.current = listen(
      answerLang(item.dir),
      (alternatieven) => {
        setLuistert(false)
        // Neem het alternatief dat het best scoort — één treffer volstaat.
        const beste =
          alternatieven.find(
            (a) => grade(a, answer({ card: item.card, dir: item.dir })) === 'goed',
          ) ?? alternatieven[0]
        setTyped(beste)
        beoordeel(beste)
      },
      (msg) => {
        setLuistert(false)
        setMicFout(msg)
      },
    )
  }

  const juist = answer({ card: item.card, dir: item.dir })
  const voortgang = totaalStart ? Math.round(((totaalStart - queue.length) / totaalStart) * 100) : 0

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col p-4">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={onExit} className="text-slate-500" aria-label="Stoppen">
          ✕
        </button>
        <div className="h-2 flex-1 rounded-full bg-slate-200">
          <div
            className="h-2 rounded-full bg-blue-600 transition-all"
            style={{ width: `${voortgang}%` }}
          />
        </div>
        <span className="text-sm text-slate-500">{queue.length}</span>
      </div>

      {extra && (
        <p className="mb-4 rounded-lg bg-amber-50 p-2 text-center text-sm text-amber-800">
          Extra oefening — alles zit op schema. Fouten tellen mee, goede antwoorden niet.
        </p>
      )}

      <div className="mb-6 text-center">
        <p className="mb-2 text-sm font-medium tracking-wide text-slate-500 uppercase">
          {item.dir === 'frnl' ? 'Frans → Nederlands' : 'Nederlands → Frans'}
        </p>
        <div className="flex items-center justify-center gap-3">
          <h1 className="text-4xl font-bold break-words">{question(item)}</h1>
          {/* Alleen als de vraag Frans is; het Nederlandse woord voorlezen heeft geen nut. */}
          {item.dir === 'frnl' && (
            <button
              onClick={() => speak(item.card.fr, 'fr-FR')}
              className="text-2xl text-slate-400"
              aria-label="Franse woord voorlezen"
            >
              🔊
            </button>
          )}
        </div>
      </div>

      {result ? (
        <div className={`mb-4 rounded-xl p-4 text-center ${FEEDBACK[result.g].klasse}`}>
          <p className="text-lg font-semibold">{FEEDBACK[result.g].titel}</p>
          <div className="mt-1 flex items-center justify-center gap-2">
            <p className="text-2xl font-bold">{juist}</p>
            {/* Bij NL→FR is dit het Franse woord: laat hem de uitspraak herhalen. */}
            {item.dir === 'nlfr' && (
              <button
                onClick={() => speak(item.card.fr, 'fr-FR')}
                className="text-xl opacity-60"
                aria-label="Franse woord voorlezen"
              >
                🔊
              </button>
            )}
          </div>
          {result.g !== 'goed' && (
            <p className="mt-1 text-sm opacity-75">jij zei: {result.gegeven}</p>
          )}
        </div>
      ) : (
        <div className="mb-4 space-y-3">
          <input
            ref={inputRef}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && typed.trim() && beoordeel(typed)}
            placeholder="Typ de vertaling…"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="w-full rounded-xl border-2 border-slate-300 p-4 text-center text-xl focus:border-blue-500 focus:outline-none"
          />
          {canListen && (
            <button
              onClick={spreek}
              className={`w-full rounded-xl py-4 text-lg font-semibold ${
                luistert ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-800'
              }`}
            >
              {luistert ? '● Aan het luisteren — tik om te stoppen' : '🎤 Antwoord inspreken'}
            </button>
          )}
          {micFout && <p className="text-center text-sm text-rose-600">{micFout}</p>}
        </div>
      )}

      <div className="mt-auto pt-4">
        {result ? (
          <button
            onClick={volgende}
            autoFocus
            className="w-full rounded-xl bg-blue-600 py-4 text-lg font-semibold text-white"
          >
            Volgende
          </button>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => beoordeel('')}
              className="flex-1 rounded-xl bg-slate-200 py-4 font-semibold text-slate-700"
            >
              Weet ik niet
            </button>
            <button
              onClick={() => beoordeel(typed)}
              disabled={!typed.trim()}
              className="flex-1 rounded-xl bg-blue-600 py-4 font-semibold text-white disabled:opacity-40"
            >
              Controleer
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
