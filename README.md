# Frans oefenen

Woordjes oefenen in twee richtingen met een Leitner-herhaalschema. Puur statisch:
geen server, geen database, geen API keys, geen kosten.

## Lokaal

```bash
npm install
npm run dev     # http://localhost:5173/frans/
npm test
```

## Gratis hosten op GitHub Pages

1. Maak een GitHub-repo met de naam **`frans`** (die naam staat als `base` in
   `vite.config.ts` — een andere naam betekent die waarde én `index.html` aanpassen).
2. Push naar `main`.
3. Repo → Settings → Pages → **Source: GitHub Actions**.

De workflow in `.github/workflows/deploy.yml` draait de tests en zet de app online op
`https://<gebruikersnaam>.github.io/frans/`.

## Op de tablet

Open die URL in Chrome → menu → **Toevoegen aan startscherm**. De app start dan
schermvullend, met een eigen icoon.

Voor spraak op Android:

- Spraakherkenning vraagt één keer toestemming voor de microfoon en heeft internet nodig.
- Hoor je geen Frans bij het voorlezen, installeer dan de Franse stem via
  Instellingen → Talen → Tekst-naar-spraak → Google → Talen installeren.

## Een lijstje toevoegen

Foto van het lijstje maken met **Google Lens**, tekst kopiëren, plakken in het
tekstvak. Eén paar per regel; `=`, een tab, een dubbelpunt, ` - ` of twee spaties
werken allemaal als scheiding. In de voorbeeldtabel corrigeer je wat de OCR fout las
voor je opslaat.

De woordenschat is **cumulatief**: elke import komt erbij, woorden die er al staan
houden hun opgebouwde voortgang. Woorden van vorige weken blijven vanzelf terugkomen.

## Hoe het herhalen werkt

Zeven boxen, met intervallen van 0, 1, 2, 4, 8, 16 en 32 dagen. Goed beantwoord →
één box hoger en langer wachten. Fout → terug naar box 1, en meteen nog eens in
dezelfde sessie. Bijna goed (één letter of een accent) zakt maar één box.

Elk woord telt als twee aparte kaarten: Frans → Nederlands (herkennen) en
Nederlands → Frans (produceren). De tweede komt pas vrij als de eerste box 2 haalt —
eerst herkennen, dan pas zelf produceren.

Een sessie is 20 items: maximaal 15 herhalingen (meest achterstallige eerst) en de
rest nieuwe woorden, zodat het nieuwe lijstje niet verdrinkt in de achterstand en de
oude woorden niet vergeten worden.

Met de keuzelijst op het startscherm oefen je één week apart, om te blokken voor een
toets. Dat negeert de vervaldatums maar telt wel gewoon mee voor de boxen.

## Delen

Het 🔗-knopje bij een week kopieert een link met die woorden erin (gecomprimeerd in
de URL-hash, dus er komt geen server aan te pas). Wie de link opent, krijgt de vraag
of hij de lijst wil toevoegen — handig om in de klas te tonen.

## Opslag

Alles staat in `localStorage` van dat ene toestel. Geen account, geen server. Browsergegevens
wissen wist ook de voortgang.
