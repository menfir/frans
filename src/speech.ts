// Web Speech API: spraakherkenning en voorlezen. Beide gratis en zonder API key,
// maar spraakherkenning heeft internet nodig en bestaat niet in elke browser.

type Recognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}

// Via globalThis, zodat dit bestand ook buiten een browser te importeren valt.
const g = globalThis as {
  SpeechRecognition?: new () => Recognition
  webkitSpeechRecognition?: new () => Recognition
}
const SR = g.SpeechRecognition ?? g.webkitSpeechRecognition

export const canListen = !!SR
export const canSpeak = typeof speechSynthesis !== 'undefined'

/**
 * Luistert één antwoord af en geeft alle alternatieven terug — als er één klopt,
 * rekenen we het goed. Dat scheelt veel valse fouten bij Franse woorden.
 * Roep de teruggegeven functie aan om vroegtijdig te stoppen.
 */
export function listen(
  lang: string,
  onDone: (alternatives: string[]) => void,
  onError: (message: string) => void,
): () => void {
  if (!SR) {
    onError('Spraakherkenning werkt niet in deze browser.')
    return () => {}
  }
  const rec = new SR()
  rec.lang = lang
  rec.continuous = false
  rec.interimResults = false
  rec.maxAlternatives = 3

  rec.onresult = (e) => {
    const result = e.results[0]
    onDone(Array.from({ length: result.length }, (_, i) => result[i].transcript))
  }
  rec.onerror = (e) => {
    if (e.error === 'aborted') return
    onError(
      e.error === 'not-allowed'
        ? 'Geef de microfoon toestemming in je browser.'
        : e.error === 'network'
          ? 'Spraakherkenning heeft internet nodig.'
          : e.error === 'no-speech'
            ? 'Niets gehoord, probeer opnieuw.'
            : `Spraakherkenning mislukte (${e.error}).`,
    )
  }
  rec.start()
  return () => rec.stop()
}

/** Leest een woord voor. Stil falen is hier prima: het is een extraatje, geen kernfunctie. */
export function speak(text: string, lang: string): void {
  if (!canSpeak) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang
  u.rate = 0.9 // iets trager, het is oefenmateriaal
  speechSynthesis.speak(u)
}
