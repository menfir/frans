// Opslag in localStorage + deelbare links. Enige plek die van persistentie weet;
// hier zou een cloud-backend later ingeplugd worden.

import { type Card, newCard, normalize } from './leitner'

const KEY = 'frans'

export type Pair = { fr: string; nl: string }

export function load(): Card[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed?.cards) ? (parsed.cards as Card[]) : []
  } catch {
    // Corrupte opslag mag niet betekenen dat de app niet meer opstart.
    console.error('Kon opgeslagen woorden niet lezen, begin met een lege lijst.')
    return []
  }
}

export function save(cards: Card[]): void {
  localStorage.setItem(KEY, JSON.stringify({ cards }))
}

const key = (p: Pair) => `${normalize(p.fr)}|${normalize(p.nl)}`

/** Welke van deze paren zitten al in de woordenschat? */
export function existing(cards: Card[], pairs: Pair[]): Set<string> {
  const known = new Set(cards.map(key))
  return new Set(pairs.filter((p) => known.has(key(p))).map(key))
}

/**
 * Voegt toe, vervangt nooit: een woord dat er al staat behoudt zijn opgebouwde voortgang.
 * Geeft de nieuwe lijst terug plus hoeveel er echt bijkwamen.
 */
export function addPairs(cards: Card[], pairs: Pair[], week: string) {
  const known = new Set(cards.map(key))
  const added: Card[] = []
  for (const p of pairs) {
    const fr = p.fr.trim()
    const nl = p.nl.trim()
    if (!fr || !nl || known.has(key(p))) continue
    known.add(key(p)) // ook dubbels binnen hetzelfde geplakte lijstje afvangen
    added.push(newCard(fr, nl, week))
  }
  return { cards: [...cards, ...added], added: added.length }
}

/** ISO-week van vandaag, bv. "2026-W36". */
export function currentWeek(d = new Date()): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7)) // naar de donderdag van deze week
  const jan1 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((t.getTime() - jan1.getTime()) / 86_400_000 + 1) / 7)
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

// ------------------------------------------------------------- deelbare link

// "mot=woord" per regel comprimeert veel beter dan JSON en scheelt de helft aan URL.
const encodePairs = (pairs: Pair[]) => pairs.map((p) => `${p.fr}=${p.nl}`).join('\n')

const parsePairs = (text: string): Pair[] =>
  text.split('\n').flatMap((line) => {
    const i = line.indexOf('=')
    return i < 0 ? [] : [{ fr: line.slice(0, i).trim(), nl: line.slice(i + 1).trim() }]
  })

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const fromBase64Url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

async function squeeze(bytes: Uint8Array, mode: 'gzip' | 'gunzip'): Promise<Uint8Array> {
  const stream =
    mode === 'gzip' ? new CompressionStream('gzip') : new DecompressionStream('gzip')
  const blob = await new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream)).blob()
  return new Uint8Array(await blob.arrayBuffer())
}

/** Deelbare URL voor één week. Gzip houdt ook een lijst van 60 woorden ruim onder 2000 tekens. */
export async function shareLink(week: string, pairs: Pair[]): Promise<string> {
  const body = new TextEncoder().encode(encodePairs(pairs))
  // 'z' = gecomprimeerd, 'p' = plat. Zo blijft een oude link leesbaar als we ooit wisselen.
  const payload =
    typeof CompressionStream === 'undefined'
      ? 'p' + toBase64Url(body)
      : 'z' + toBase64Url(await squeeze(body, 'gzip'))
  return `${location.origin}${location.pathname}#w=${encodeURIComponent(week)}&d=${payload}`
}

/** Leest een gedeelde lijst uit de URL-hash. Geeft null als er geen (geldige) lijst in zit. */
export async function readShared(
  hash: string,
): Promise<{ week: string; pairs: Pair[] } | null> {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const data = params.get('d')
  if (!data) return null
  try {
    const bytes = fromBase64Url(data.slice(1))
    const body = data[0] === 'z' ? await squeeze(bytes, 'gunzip') : bytes
    const pairs = parsePairs(new TextDecoder().decode(body))
    if (!pairs.length) return null
    return { week: params.get('w') || currentWeek(), pairs }
  } catch {
    console.error('Gedeelde link kon niet gelezen worden.')
    return null
  }
}
