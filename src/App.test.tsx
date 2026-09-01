// Rooktest: rendert de schermen zonder browser. Vangt een wit scherm door een
// crash bij het opstarten — de enige fout die alle andere tests zouden missen.
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from './App'
import { newCard } from './leitner'
import Import from './screens/Import'
import Quiz from './screens/Quiz'

describe('delen vanuit een andere app', () => {
  it('vult het importscherm met de gedeelde tekst', () => {
    const html = renderToString(
      <Import cards={[]} initialText={'la maison = het huis\nle chien = de hond'} onAdd={() => {}} onCancel={() => {}} />,
    )
    // React zet <!-- --> tussen tekstnodes, dus controleer de waarden zelf
    expect(html).toContain('value="la maison"')
    expect(html).toContain('value="het huis"')
    expect(html).toContain('value="le chien"')
    expect(html).toContain('2 woord(en) toevoegen')
  })

  it('start leeg zonder gedeelde tekst', () => {
    const html = renderToString(<Import cards={[]} onAdd={() => {}} onCancel={() => {}} />)
    expect(html).toContain('Niets nieuws om toe te voegen')
  })
})

describe('rendering', () => {
  it('start op zonder localStorage en toont de lege staat', () => {
    const html = renderToString(<App />)
    expect(html).toContain('Frans oefenen')
    expect(html).toContain('Nog geen woorden')
  })

  it('toont een vraag in de quiz', () => {
    const cards = [newCard('la maison', 'het huis', '2026-W36')]
    const html = renderToString(
      <Quiz cards={cards} onAnswer={() => {}} onExit={() => {}} />,
    )
    expect(html).toContain('la maison')
    expect(html).toContain('Frans → Nederlands')
  })

  it('meldt netjes dat er niets te oefenen valt zonder woorden', () => {
    const html = renderToString(<Quiz cards={[]} onAnswer={() => {}} onExit={() => {}} />)
    expect(html).toContain('Niets te oefenen')
  })

  it('biedt voorlezen aan bij een Franse vraag', () => {
    const html = renderToString(
      <Quiz
        cards={[newCard('la maison', 'het huis', '2026-W36')]}
        onAnswer={() => {}}
        onExit={() => {}}
      />,
    )
    expect(html).toContain('la maison')
    expect(html).toContain('voorlezen')
  })

  it('biedt geen voorlezen aan bij een Nederlandse vraag', () => {
    // frnl al geoefend en nog niet vervallen, dus alleen NL→FR komt aan bod
    const card = newCard('la maison', 'het huis', '2026-W36')
    card.box.frnl = 3
    card.due.frnl = Date.now() + 5 * 86_400_000

    const html = renderToString(<Quiz cards={[card]} onAnswer={() => {}} onExit={() => {}} />)
    expect(html).toContain('Nederlands → Frans')
    expect(html).toContain('het huis')
    expect(html).not.toContain('voorlezen') // het Franse woord staat pas in het antwoord
  })

  it('laat toch oefenen als alles op schema zit', () => {
    const card = newCard('la maison', 'het huis', '2026-W36')
    card.box = { frnl: 5, nlfr: 5 }
    card.due = { frnl: Date.now() + 20 * 86_400_000, nlfr: Date.now() + 20 * 86_400_000 }

    const html = renderToString(<Quiz cards={[card]} onAnswer={() => {}} onExit={() => {}} />)
    expect(html).not.toContain('Niets te oefenen')
    expect(html).toContain('Extra oefening')
  })
})
