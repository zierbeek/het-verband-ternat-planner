# CLAUDE.md

Deze file geeft Claude (en andere AI-assistenten) de context die nodig is om
snel en veilig in deze codebase te werken. Lees dit eerst voor je iets wijzigt.

## Wat is dit project

**Het Verband Ternat – Planner**: personeelsplanning voor een
thuisverplegingsorganisatie. Beheerders plannen diensten in en wijzen ze toe
aan medewerkers; medewerkers bekijken hun rooster, vragen verlof aan en
ruilen diensten (met goedkeuring door een beheerder). Alle UI-tekst,
foutmeldingen, e-mails en commit-conventies in dit project zijn in het
**Nederlands** — schrijf nieuwe user-facing tekst ook in het Nederlands,
tenzij anders gevraagd.

## Techstack

| Laag          | Technologie                                    |
| ------------- | ----------------------------------------------- |
| Frontend      | React 19, Vite, Tailwind CSS, lucide-react, motion |
| Backend       | Node.js, Express, TypeScript (`server.ts`, één bestand) |
| Databank      | PostgreSQL via Prisma ORM (`prisma/schema.prisma`) |
| Auth          | JWT (`server/auth.ts`)                          |
| E-mail        | Resend API, SMTP (Nodemailer), of lokale simulatiemodus |
| Containers    | Docker & Docker Compose                         |

Geen test-suite aanwezig. `npm run lint` = `tsc --noEmit` (typecontrole, geen
linter in de klassieke zin). Er is geen `node_modules` in deze omgeving zonder
netwerktoegang — je kan dus vaak niet `npm install`/`tsc` lokaal draaien; werk
extra zorgvuldig en lees de omliggende code goed voor je iets aanpast.

## Architectuur — belangrijk om te weten

- **`server.ts`** is een groot monoliet-bestand (~3800 regels) met alle
  `/api/*`-routes, Express-setup, en de Vite-middleware-integratie voor dev.
  Er is geen aparte routes-map: alles zit in de `startServer()`-functie.
  Nieuwe routes voeg je toe in de buurt van thematisch verwante routes
  (bv. een nieuwe feedback-route naast de andere `/api/reports`,
  `/api/admin/*` routes), niet zomaar onderaan.
- **`src/App.tsx`** is de root-component: bevat login-gate, sidebar-navigatie
  (desktop) + bottom-tab-navigatie (mobiel), en een `activeTab`-state die
  bepaalt welke pagina/component getoond wordt (geen router-library, gewoon
  conditionele rendering). Nieuwe pagina's: voeg toe aan `primaryMenuItems`
  of `adminMenuItems`, en render conditioneel in de `<main>`-sectie.
- **`src/components/`** — één component per grote feature/pagina
  (Dashboard, ShiftCalendar, LeaveManagement, SwapWorkflows, AdminPanel,
  AvailabilitySettings, FeedbackWidget, ...). `ShiftCalendar.tsx` en
  `AdminPanel.tsx` zijn de grootste (resp. ~130K en ~60K) — wees extra
  voorzichtig en lees eerst de relevante sectie voor je bewerkt.
- **E-mail**: alle e-mail gaat via `sendEmailNotification()` in `server.ts`
  (Resend → SMTP → simulatiemodus, in die volgorde, geconfigureerd via de
  `Setting`-tabel of env-vars). Hergebruik deze functie voor nieuwe
  e-mailflows in plaats van een nieuwe implementatie te schrijven.
- **Auth**: `authenticate`-middleware zet `req.user` (uit het JWT); gebruik
  `requireAdmin` voor beheerders-only routes.
- **Dubbele boekingen**: er is expliciete logica (`shiftToRange`, overlap-
  checks) om te vermijden dat een medewerker twee overlappende diensten
  krijgt, inclusief nachtdiensten die middernacht overschrijden. Respecteer
  deze checks bij wijzigingen aan shift-toewijzing.

## Feedback-feature (bug reports & feature requests)

Toegevoegd: een vlottende feedback-knop (`FeedbackWidget.tsx`, rechtsonder,
op elke pagina zichtbaar voor ingelogde gebruikers) waarmee elke gebruiker
een **bug** of **feature-idee** kan melden voor de pagina waar die zich op
bevindt.

- Frontend: `src/components/FeedbackWidget.tsx`, ingehaakt in `App.tsx`. De
  huidige paginanaam wordt automatisch meegegeven (uit `menuItems`), maar is
  bewerkbaar door de gebruiker.
- Backend: `POST /api/feedback` in `server.ts` (authenticatie vereist).
  Verzendt een e-mail via `sendEmailNotification()` naar het adres in
  `FEEDBACK_EMAIL` (env var), met **`dematthi@hotmail.be`** als hardcoded
  fallback. Er wordt niets in de databank opgeslagen buiten een audit-log-
  regel (`FEEDBACK_BUG_REPORTED` / `FEEDBACK_FEATURE_REQUESTED`).
- Wil je het ontvangend e-mailadres wijzigen: zet de env var `FEEDBACK_EMAIL`,
  pas niet de fallback in de code aan zonder overleg.

## Werkconventies

- **Taal**: Nederlandse UI-teksten, foutmeldingen en e-mailinhoud. Code-
  commentaar mag Engels of Nederlands zijn (in de bestaande code staat een
  mix); volg de stijl van het bestand dat je bewerkt.
- **Styling**: Tailwind utility classes, geen losse CSS-bestanden per
  component (behalve `index.css`/`mobile.css` voor globale zaken). Kleuren:
  `slate` voor neutraal, `blue-600` als primaire accentkleur, `red`/`amber`/
  `emerald` voor respectievelijk fout/waarschuwing/succes.
- **Iconen**: `lucide-react`, consistent `h-4 w-4` / `h-5 w-5` formaten.
- **Modals**: vast patroon — fixed overlay (`bg-slate-900/40`), witte kaart
  met `rounded-2xl`, header met titel + sluitknop (`X`-icoon). Zie
  `FeedbackWidget.tsx` of `PasswordChangeModal.tsx` als voorbeeld.
- **Patches**: wijzigingen worden soms als `.patch`-bestand aangeleverd
  (zie `fixes.patch` in de repo-root als precedent) in plain-diff-formaat
  (`diff -ruN a/... b/...`), toepasbaar met `patch -p1` of `git apply` vanuit
  de projectroot. Test een gegenereerde patch altijd op een schone kopie
  vóór je die aflevert.
- **Geen `.env` committen**: gevoelige config (JWT_SECRET, SMTP-wachtwoorden,
  Resend API-key) hoort in env-vars of de `Setting`-tabel via het
  Beheercentrum, nooit hardcoded (met uitzondering van de expliciet
  gevraagde fallback hierboven).

## Dingen om NIET te doen

- Geen aparte routing-library toevoegen (React Router e.d.) — de app steunt
  bewust op eenvoudige `activeTab`-state.
- Geen nieuwe e-mail-verzendlogica naast `sendEmailNotification()`.
- `prisma/dev.db` en `prisma/emails.json` zijn lokale runtime-data, geen
  broncode — niet meenemen in patches/diffs.
- Niet zomaar `server.ts` herstructureren in meerdere bestanden zonder dat
  expliciet gevraagd wordt — dit is een bewuste (zij het niet ideale)
  keuze in het huidige project.

## Snel starten (lokaal, met Docker)

```bash
cp .env.example .env   # pas JWT_SECRET en DB-wachtwoorden aan
docker compose up --build
# app op http://localhost:3210
```

Zonder Docker: zie README.md → "Lokale ontwikkeling" (Node 20+, lokale
PostgreSQL, `npm install`, `npx prisma generate && npx prisma db push`,
`npm run dev`, app op http://localhost:3000).
