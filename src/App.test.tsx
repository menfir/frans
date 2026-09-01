// Rooktest: rendert de schermen zonder browser. Vangt een wit scherm door een
// crash bij het opstarten — de enige fout die alle andere tests zouden missen.
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from './App'
import { newCard } from './leitner'
import Quiz from './screens/Quiz'

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

  it('meldt netjes dat er niets te oefenen valt', () => {
    const html = renderToString(<Quiz cards={[]} onAnswer={() => {}} onExit={() => {}} />)
    expect(html).toContain('Niets te oefenen')
  })
})
