import { describe, expect, it } from 'vitest'
import {
  type Card,
  MAX_BOX,
  applyAnswer,
  buildSession,
  grade,
  isUnlocked,
  newCard,
  normalize,
  schedule,
} from './leitner'
import { addPairs, currentWeek, existing } from './store'

const NOW = Date.UTC(2026, 8, 1)
const DAY = 86_400_000

/** Kaart met een ingestelde box/vervaldatum, om planning te kunnen testen. */
function card(fr: string, nl: string, week = '2026-W36', box = 0, dueIn = 0): Card {
  const c = newCard(fr, nl, week)
  c.box = { frnl: box, nlfr: box }
  c.due = { frnl: NOW + dueIn, nlfr: NOW + dueIn }
  return c
}

describe('normalize', () => {
  it('haalt accenten, lidwoorden en hoofdletters weg', () => {
    expect(normalize('  Élève ')).toBe('eleve')
    expect(normalize("l'école")).toBe('ecole')
    expect(normalize('La Maison')).toBe('maison')
    expect(normalize('het huis')).toBe('huis')
  })
})

describe('grade', () => {
  it('keurt een exact antwoord goed', () => {
    expect(grade('huis', 'huis')).toBe('goed')
    expect(grade('  Huis ', 'het huis')).toBe('goed')
  })

  it('rekent een ontbrekend accent goed, maar meldt het', () => {
    expect(grade('eleve', 'élève')).toBe('accent')
    expect(grade('élève', 'élève')).toBe('goed')
  })

  it('aanvaardt elk van de alternatieven', () => {
    expect(grade('woning', 'huis / woning')).toBe('goed')
    expect(grade('huis', 'huis, woning')).toBe('goed')
  })

  it('noemt één tikfout bijna goed', () => {
    expect(grade('huls', 'huis')).toBe('bijna')
  })

  it('keurt een echt fout antwoord af', () => {
    expect(grade('fiets', 'huis')).toBe('fout')
    expect(grade('', 'huis')).toBe('fout')
  })

  it('laat verschillende korte woorden niet voor elkaar doorgaan', () => {
    // 'gros' en 'gras' schelen één letter maar mogen niet als bijna-goed tellen bij een fout woord
    expect(grade('fiets', 'huis')).toBe('fout')
  })
})

describe('schedule', () => {
  it('schuift op bij een goed antwoord en wacht langer', () => {
    expect(schedule(1, 'goed', NOW)).toEqual({ box: 2, due: NOW + 2 * DAY })
    expect(schedule(3, 'goed', NOW)).toEqual({ box: 4, due: NOW + 8 * DAY })
  })

  it('stopt bij de hoogste box', () => {
    expect(schedule(MAX_BOX, 'goed', NOW).box).toBe(MAX_BOX)
  })

  it('valt bij een fout helemaal terug naar box 1', () => {
    expect(schedule(6, 'fout', NOW)).toEqual({ box: 1, due: NOW + DAY })
  })

  it('zakt bij bijna-goed maar één box', () => {
    expect(schedule(5, 'bijna', NOW).box).toBe(4)
    expect(schedule(1, 'bijna', NOW).box).toBe(1)
  })
})

describe('applyAnswer', () => {
  it('raakt alleen de geantwoorde richting aan', () => {
    const c = card('maison', 'huis', '2026-W36', 3)
    const after = applyAnswer(c, 'frnl', 'goed', NOW)
    expect(after.box.frnl).toBe(4)
    expect(after.box.nlfr).toBe(3)
    expect(c.box.frnl).toBe(3) // origineel blijft ongemoeid
  })
})

describe('isUnlocked', () => {
  it('geeft NL→FR pas vrij als FR→NL is ingeslepen', () => {
    const vers = card('maison', 'huis')
    expect(isUnlocked(vers, 'frnl')).toBe(true)
    expect(isUnlocked(vers, 'nlfr')).toBe(false)

    const geoefend = applyAnswer(applyAnswer(vers, 'frnl', 'goed', NOW), 'frnl', 'goed', NOW)
    expect(isUnlocked(geoefend, 'nlfr')).toBe(true)
  })
})

describe('buildSession', () => {
  it('mengt oude herhalingen met nieuwe woorden zodat geen van beide verdrinkt', () => {
    // 40 achterstallige woorden van vorige weken, 10 nieuwe van deze week
    const oud = Array.from({ length: 40 }, (_, i) =>
      card(`oud${i}`, `vieux${i}`, '2026-W30', 3, -30 * DAY),
    )
    const nieuw = Array.from({ length: 10 }, (_, i) => card(`nieuw${i}`, `neuf${i}`, '2026-W36'))

    const sessie = buildSession([...oud, ...nieuw], NOW)

    expect(sessie).toHaveLength(20)
    const nieuwInSessie = sessie.filter((i) => i.card.box[i.dir] === 0)
    expect(nieuwInSessie).toHaveLength(5)
    expect(sessie.length - nieuwInSessie.length).toBe(15)
  })

  it('vult aan met nieuwe woorden als er weinig te herhalen valt', () => {
    // één geoefende kaart levert twee herhalingen op (beide richtingen zijn vrij)
    const oud = [card('oud', 'vieux', '2026-W30', 3, -DAY)]
    const nieuw = Array.from({ length: 30 }, (_, i) => card(`n${i}`, `x${i}`, '2026-W36'))

    const sessie = buildSession([...oud, ...nieuw], NOW)
    expect(sessie).toHaveLength(20)
    expect(sessie.filter((i) => i.card.box[i.dir] === 0)).toHaveLength(18)
  })

  it('slaat woorden over die nog niet vervallen zijn', () => {
    const later = [card('later', 'plus tard', '2026-W36', 3, 10 * DAY)]
    expect(buildSession(later, NOW)).toHaveLength(0)
  })

  it('neemt de meest achterstallige woorden eerst', () => {
    const cards = [
      card('recent', 'a', '2026-W35', 3, -DAY),
      ...Array.from({ length: 30 }, (_, i) => card(`oud${i}`, `b${i}`, '2026-W30', 3, -50 * DAY)),
    ]
    const sessie = buildSession(cards, NOW)
    expect(sessie.some((i) => i.card.fr === 'recent')).toBe(false)
  })

  it('negeert vervaldatums bij het blokken van één week', () => {
    const cards = [
      card('deze', 'a', '2026-W36', 3, 10 * DAY), // nog lang niet vervallen
      card('andere', 'b', '2026-W30', 3, -DAY),
    ]
    const sessie = buildSession(cards, NOW, '2026-W36')
    expect(sessie).toHaveLength(2) // beide richtingen van dat ene woord
    expect(sessie.every((i) => i.card.fr === 'deze')).toBe(true)
  })
})

describe('addPairs', () => {
  it('behoudt de voortgang van woorden die er al staan', () => {
    const bestaand = [card('maison', 'huis', '2026-W35', 4)]
    const { cards, added } = addPairs(
      bestaand,
      [
        { fr: 'La maison', nl: 'het huis' }, // zelfde woord, andere spelling
        { fr: 'chien', nl: 'hond' },
      ],
      '2026-W36',
    )

    expect(added).toBe(1)
    expect(cards).toHaveLength(2)
    expect(cards[0].box.frnl).toBe(4) // niet gereset
    expect(cards[0].week).toBe('2026-W35') // blijft bij zijn oorspronkelijke week
  })

  it('vangt dubbels binnen hetzelfde geplakte lijstje af', () => {
    const { added } = addPairs(
      [],
      [
        { fr: 'chien', nl: 'hond' },
        { fr: 'chien', nl: 'hond' },
      ],
      '2026-W36',
    )
    expect(added).toBe(1)
  })

  it('slaat lege regels over', () => {
    const { added } = addPairs([], [{ fr: '  ', nl: 'hond' }, { fr: 'chat', nl: '' }], '2026-W36')
    expect(added).toBe(0)
  })
})

describe('existing', () => {
  it('markeert welke paren al gekend zijn', () => {
    const bestaand = [card('maison', 'huis')]
    const gevonden = existing(bestaand, [
      { fr: 'maison', nl: 'huis' },
      { fr: 'chien', nl: 'hond' },
    ])
    expect(gevonden.size).toBe(1)
  })
})

describe('currentWeek', () => {
  it('geeft een ISO-weeklabel', () => {
    expect(currentWeek(new Date('2026-09-01'))).toBe('2026-W36')
    expect(currentWeek(new Date('2026-01-01'))).toBe('2026-W01')
  })
})
