import { useEffect, useState } from 'react'
import { type Card, applyAnswer } from './leitner'
import Home from './screens/Home'
import Import from './screens/Import'
import Quiz from './screens/Quiz'
import Woorden from './screens/Woorden'
import { type Pair, addPairs, load, readShared, save } from './store'

type Scherm =
  | { naam: 'home' }
  | { naam: 'import' }
  | { naam: 'woorden' }
  | { naam: 'quiz'; week?: string }

export default function App() {
  const [cards, setCards] = useState<Card[]>(load)
  const [scherm, setScherm] = useState<Scherm>({ naam: 'home' })
  const [gedeeld, setGedeeld] = useState<{ week: string; pairs: Pair[] } | null>(null)
  const [gedeeldVanuitApp, setGedeeldVanuitApp] = useState<string>('')

  // Gedeelde lijst uit de URL-hash oppikken.
  useEffect(() => {
    if (!location.hash) return
    readShared(location.hash).then((s) => {
      if (s) setGedeeld(s)
      history.replaceState(null, '', location.pathname) // hash weg, anders komt hij bij elke herlaad terug
    })
  }, [])

  // Tekst die vanuit een andere app gedeeld is (Google Lens, Foto's, een bericht):
  // Android levert ze af als ?text= op de start-URL. Meteen door naar het importscherm.
  useEffect(() => {
    const gedeeldeTekst = new URL(location.href).searchParams.get('text')
    if (!gedeeldeTekst?.trim()) return
    setGedeeldVanuitApp(gedeeldeTekst)
    setScherm({ naam: 'import' })
    history.replaceState(null, '', location.pathname)
  }, [])

  function bewaar(next: Card[]) {
    setCards(next)
    save(next)
  }

  const voegToe = (pairs: Pair[], week: string) => {
    bewaar(addPairs(cards, pairs, week).cards)
    setScherm({ naam: 'home' })
  }

  if (gedeeld) {
    const { added } = addPairs(cards, gedeeld.pairs, gedeeld.week)
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <h1 className="mt-8 mb-2 text-2xl font-bold">Gedeelde lijst</h1>
        <p className="mb-8 text-slate-600">
          {gedeeld.pairs.length} woorden van {gedeeld.week}, waarvan {added} nieuw voor jou.
        </p>
        <button
          onClick={() => {
            voegToe(gedeeld.pairs, gedeeld.week)
            setGedeeld(null)
          }}
          disabled={added === 0}
          className="mb-3 w-full rounded-xl bg-blue-600 py-4 text-lg font-semibold text-white disabled:opacity-40"
        >
          {added > 0 ? `${added} woord(en) toevoegen` : 'Je hebt ze al'}
        </button>
        <button onClick={() => setGedeeld(null)} className="w-full py-3 text-slate-500">
          Annuleren
        </button>
      </div>
    )
  }

  if (scherm.naam === 'import') {
    return (
      <Import
        cards={cards}
        initialText={gedeeldVanuitApp}
        onAdd={voegToe}
        onCancel={() => setScherm({ naam: 'home' })}
      />
    )
  }

  if (scherm.naam === 'woorden') {
    return <Woorden cards={cards} onChange={bewaar} onExit={() => setScherm({ naam: 'home' })} />
  }

  if (scherm.naam === 'quiz') {
    return (
      <Quiz
        cards={cards}
        week={scherm.week}
        // Bewaren per antwoord: sluit hij de tablet halverwege, dan is de voortgang er nog.
        // Toepassen op de kaart uit de actuele state, niet op de kopie uit de wachtrij.
        onAnswer={(kaart, dir, g, extra) =>
          setCards((prev) => {
            const next = prev.map((c) =>
              c.fr === kaart.fr && c.nl === kaart.nl
                ? applyAnswer(c, dir, g, Date.now(), extra)
                : c,
            )
            save(next)
            return next
          })
        }
        onExit={() => setScherm({ naam: 'home' })}
      />
    )
  }

  return (
    <Home
      cards={cards}
      onStart={(week) => setScherm({ naam: 'quiz', week })}
      onImport={() => setScherm({ naam: 'import' })}
      onEdit={() => setScherm({ naam: 'woorden' })}
    />
  )
}
