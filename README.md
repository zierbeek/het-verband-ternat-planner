# Het Verband Ternat – Planner

Een webapplicatie voor personeelsplanning bij **Thuisverpleging Het Verband Ternat**. De planner laat beheerders diensten (shifts) inplannen en toewijzen aan medewerkers, en geeft medewerkers de mogelijkheid om hun rooster te bekijken, verlof aan te vragen en diensten onderling te ruilen — met goedkeuring door een beheerder.

## Inhoud

- [Functionaliteiten](#functionaliteiten)
- [Techstack](#techstack)
- [Projectstructuur](#projectstructuur)
- [Aan de slag](#aan-de-slag)
  - [Met Docker (aanbevolen)](#met-docker-aanbevolen)
  - [Lokale ontwikkeling](#lokale-ontwikkeling)
- [Omgevingsvariabelen](#omgevingsvariabelen)
- [Standaard beheerdersaccount](#standaard-beheerdersaccount)
- [Rollen en rechten](#rollen-en-rechten)
- [Databankmodel](#databankmodel)
- [Beschikbare scripts](#beschikbare-scripts)

## Functionaliteiten

**Voor beheerders**

- Diensten aanmaken, bewerken en verwijderen in een week-/maandkalender, met sleep-en-plaats-toewijzing.
- Medewerkers (en beheerders zelf) toewijzen aan diensten, met automatische controle op dubbele boekingen (overlappende diensten).
- Herbruikbare dienst-presets (bv. "Voormiddag 07:00–15:00") beheren.
- Een week of maand kopiëren of laten herhalen over meerdere weken.
- **Bulkbewerkingen**: via "Bulk Bewerken" meerdere diensten tegelijk selecteren (week-, maand- of dagweergave) en in één actie een medewerker toewijzen/onbezet maken, verschuiven met een aantal dagen, of verwijderen — met dezelfde controle op dubbele boekingen en een overzicht van overgeslagen conflicten.
- **Terugkerende sjablonen**: een herbruikbaar dienstsjabloon aanmaken met een naam, tijdstip, dagen van de week en een wekelijks/tweewekelijks patroon binnen een periode, en daaruit op elk moment echte diensten genereren voor een gekozen tijdsvenster (herhaald genereren slaat reeds aangemaakte data over).
- Verlofaanvragen en ruilvoorstellen goedkeuren of weigeren (via de app of via een actieknop in de e-mail).
- Gebruikers beheren: aanmaken, rol wijzigen, wachtwoord resetten, verwijderen.
- Mededelingen plaatsen voor het hele team.
- Rapporten (samenvatting van gewerkte uren) en een audit-logboek van alle acties inzien.
- E-mail- en systeeminstellingen configureren (afzender, Resend/SMTP, organisatienaam, urenlimieten).

**Voor medewerkers**

- Eigen rooster bekijken (kalender) en abonneren via een persoonlijke iCal-feed (`/api/calendar/sync/:userId/feed.ics`).
- Beschikbaarheid en voorkeuren (gewenste diensten/collega's) instellen.
- Verlof aanvragen en de status ervan opvolgen.
- Een dienst voorstellen om te ruilen met een collega; de collega accepteert of weigert, waarna een beheerder de ruil definitief goedkeurt.
- Meldingen ontvangen in de app en via e-mail bij elke statuswijziging.

**Algemeen**

- Rolgebaseerde authenticatie met JWT.
- E-mailnotificaties (goedkeuring/weigering, nieuwe toewijzingen, ruilverzoeken) via Resend, SMTP, of een lokale simulatiemodus voor ontwikkeling.
- Correcte tijdzone-afhandeling (Europe/Brussels) in de iCal-export, inclusief nachtdiensten die middernacht overschrijden.

## Techstack

| Laag          | Technologie                                             |
| ------------- | ------------------------------------------------------- |
| Frontend      | React 19, Vite, Tailwind CSS, lucide-react, motion      |
| Backend       | Node.js, Express, TypeScript                            |
| Databank      | PostgreSQL via Prisma ORM                               |
| Authenticatie | JSON Web Tokens (JWT)                                   |
| E-mail        | Resend API of SMTP (via Nodemailer), met simulatiemodus |
| Containers    | Docker & Docker Compose                                 |

## Projectstructuur

```
├── prisma/
│   └── schema.prisma        # Databankmodel (User, Employee, Shift, LeaveRequest, SwapRequest, ...)
├── server/
│   ├── auth.ts               # Wachtwoord-hashing en JWT-helpers
│   ├── db.ts                 # Prisma client
│   └── seed.ts                # Eerste-opstart seeding + back-fill van ontbrekende profielen
├── server.ts                  # Express-API (alle /api/* routes) + Vite-integratie
├── src/
│   ├── components/
│   │   ├── AdminPanel.tsx         # Gebruikers-, instellingen- en rapportenbeheer
│   │   ├── AvailabilitySettings.tsx
│   │   ├── Dashboard.tsx
│   │   ├── LeaveManagement.tsx    # Verlofaanvragen indienen/goedkeuren
│   │   ├── Login.tsx
│   │   ├── ShiftCalendar.tsx      # Planningskalender
│   │   └── SwapWorkflows.tsx      # Ruilvoorstellen indienen/afhandelen
│   ├── utils/userColor.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── types.ts
├── Dockerfile
├── docker-compose.yml
└── vite.config.ts
```

## Aan de slag

### Met Docker (aanbevolen)

**Vereisten:** Docker en Docker Compose.

1. Kopieer `.env.example` naar `.env` en pas de waarden aan (zeker `JWT_SECRET` en de databankwachtwoorden voor productie).
2. Start de stack:

   ```bash
   docker compose up --build
   ```

   Dit start een PostgreSQL-container en de applicatie, voert bij het opstarten automatisch `prisma db push` uit, en seedt de databank bij een lege installatie.
3. De applicatie is bereikbaar op **http://localhost:3210**.

### Lokale ontwikkeling

**Vereisten:** Node.js 20+, een draaiende PostgreSQL-instantie.

1. Installeer dependencies:

   ```bash
   npm install
   ```
2. Maak een `.env`-bestand (zie [Omgevingsvariabelen](#omgevingsvariabelen)) en zorg dat `DATABASE_URL` naar een bestaande PostgreSQL-databank verwijst.
3. Genereer de Prisma-client en push het schema:

   ```bash
   npx prisma generate
   npx prisma db push
   ```
4. Start de ontwikkelserver (Express + Vite, met hot reload):

   ```bash
   npm run dev
   ```
5. Open **http://localhost:3000**.

## Omgevingsvariabelen

| Variabele          | Verplicht | Omschrijving                                                                                                                                                                                                          |
| ------------------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`   | Ja        | PostgreSQL-connectiestring voor Prisma.                                                                                                                                                                               |
| `JWT_SECRET`     | Ja        | Geheime sleutel om JWT's te ondertekenen.**Wijzig dit in productie.**                                                                                                                                           |
| `APP_URL`        | Nee       | Publieke basis-URL van de applicatie, gebruikt in e-maillinks en de iCal-feed. Zonder deze waarde wordt de URL afgeleid uit de binnenkomende request.                                                                 |
| `RESEND_API_KEY` | Nee       | API-sleutel voor e-mailverzending via[Resend](https://resend.com). Zonder sleutel (en zonder SMTP-instellingen in het Beheercentrum) draait e-mail in simulatiemodus: berichten worden gelogd in plaats van verzonden. |
| `SENDER_EMAIL`   | Nee       | Afzenderadres voor uitgaande e-mails.                                                                                                                                                                                 |

E-mail- en SMTP-instellingen kunnen ook achteraf via het **Beheercentrum → Instellingen** worden geconfigureerd; die overschrijven de omgevingsvariabelen.

## Standaard beheerdersaccount

Bij de allereerste opstart (lege databank) wordt automatisch één beheerdersaccount aangemaakt:

- **E-mail:** `admin@homenursing.org`
- **Wachtwoord:** `admin123`

> ⚠️ Wijzig dit wachtwoord onmiddellijk na de eerste login, zeker vóór een productie-uitrol.

## Rollen en rechten

De applicatie kent twee rollen, opgeslagen op het `User`-model:

- **`ADMINISTRATOR`** — volledige toegang: planning, gebruikersbeheer, instellingen, rapporten, audit-logboek, en goedkeuring van verlof-/ruilaanvragen. Beheerders hebben ook een `Employee`-profiel en kunnen dus zelf aan diensten worden toegewezen.
- **`EMPLOYEE`** — toegang tot het eigen rooster, beschikbaarheid, verlofaanvragen en ruilvoorstellen.

Een wissel- of verlofaanvraag heeft slechts de goedkeuring van **één** beheerder nodig; zodra die beslissing genomen is, wordt de aanvraag afgesloten en kan geen andere beheerder ze nog overschrijven.

## Databankmodel

De belangrijkste modellen (zie `prisma/schema.prisma` voor het volledige schema):

- **`User`** / **`Employee`** — accountgegevens respectievelijk planningsgerelateerde profielgegevens (voorkeuren, beschikbaarheid).
- **`Shift`** / **`ShiftAssignment`** / **`ShiftPreset`** / **`ShiftTemplate`** — diensten, de koppeling met medewerkers, herbruikbare eenmalige sjablonen (presets) en herbruikbare terugkerende sjablonen die op aanvraag echte diensten genereren.
- **`LeaveRequest`** — verlofaanvragen (vakantie, ziekte, opleiding, persoonlijk) met status en goedkeuringshistoriek.
- **`SwapRequest`** — ruilvoorstellen tussen medewerkers, met een statusverloop van voorstel → collega-reactie → beheerdersgoedkeuring.
- **`ShiftChangeRequest`** — verzoeken tot tijdswijziging, afwezigheid of extra dienst op een bestaande toewijzing.
- **`Availability`** — beschikbaarheid per medewerker (vast per weekdag of voor specifieke data).
- **`Notification`** / **`AuditLog`** / **`Announcement`** / **`Setting`** — meldingen, logboek van beheerdersacties, mededelingen en systeeminstellingen.

## Beschikbare scripts

| Script            | Omschrijving                                                           |
| ----------------- | ---------------------------------------------------------------------- |
| `npm run dev`   | Start de ontwikkelserver (Express + Vite, hot reload).                 |
| `npm run build` | Bouwt de frontend (Vite) en bundelt de server naar`dist/server.cjs`. |
| `npm start`     | Start de gebundelde productieserver (`dist/server.cjs`).             |
| `npm run lint`  | Typecontrole met`tsc --noEmit`.                                      |
| `npm run clean` | Verwijdert de build-output.                                            |
