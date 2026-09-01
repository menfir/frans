import { beforeAll, describe, expect, it } from 'vitest'
import { parseList } from './screens/Import'
import { readShared, shareLink } from './store'

beforeAll(() => {
  // shareLink bouwt een absolute URL; in Node bestaat `location` niet.
  Object.defineProperty(globalThis, 'location', {
    value: { origin: 'https://voorbeeld.be', pathname: '/frans/' },
    configurable: true,
  })
})

describe('deelbare link', () => {
  const pairs = [
    { fr: "l'école", nl: 'de school' },
    { fr: 'la maison', nl: 'het huis' },
  ]

  it('overleeft een heen-en-terugreis, accenten incluis', async () => {
    const link = await shareLink('2026-W36', pairs)
    const gelezen = await readShared(link.slice(link.indexOf('#')))
    expect(gelezen).toEqual({ week: '2026-W36', pairs })
  })

  it('blijft kort genoeg voor een URL bij een lijst van 60 woorden', async () => {
    const veel = Array.from({ length: 60 }, (_, i) => ({
      fr: `mot${i}`,
      nl: `woord${i}`,
    }))
    const link = await shareLink('2026-W36', veel)
    expect(link.length).toBeLessThan(2000)
  })

  it('geeft null bij een hash zonder lijst of met rommel', async () => {
    expect(await readShared('')).toBeNull()
    expect(await readShared('#w=2026-W36')).toBeNull()
    expect(await readShared('#d=zRommelRommel')).toBeNull()
  })
})

describe('parseList', () => {
  it('herkent de scheidingstekens die uit een foto-OCR komen', () => {
    const text = [
      'la maison = het huis',
      'le chien\tde hond',
      'le chat   de kat',
      'la vache : de koe',
      'le cheval - het paard',
    ].join('\n')

    expect(parseList(text)).toEqual([
      { fr: 'la maison', nl: 'het huis' },
      { fr: 'le chien', nl: 'de hond' },
      { fr: 'le chat', nl: 'de kat' },
      { fr: 'la vache', nl: 'de koe' },
      { fr: 'le cheval', nl: 'het paard' },
    ])
  })

  it('slaat lege en onherkenbare regels over', () => {
    expect(parseList('\nmaison\n\nchien = hond\n')).toEqual([{ fr: 'chien', nl: 'hond' }])
  })

  it('splitst op de eerste scheider, niet op de laatste', () => {
    expect(parseList('avoir besoin de = nodig hebben')).toEqual([
      { fr: 'avoir besoin de', nl: 'nodig hebben' },
    ])
  })
})
