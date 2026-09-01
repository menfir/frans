// Doet bewust niets. Chrome wil een service worker zien voor de installatieprompt
// ("Toevoegen aan startscherm"), maar offline draaien heeft hier geen zin:
// spraakherkenning heeft toch internet nodig.
// ponytail: leeg gelaten; hier caching toevoegen als offline oefenen ooit nodig is.
self.addEventListener('fetch', () => {})
