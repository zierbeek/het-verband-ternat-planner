import React, { useMemo, useState } from "react";
import {
  X,
  Check,
  User,
  Settings,
  Calendar,
  ClipboardList,
  ArrowLeftRight,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Home,
  Clock,
  Mail,
  FileText,
  RefreshCw,
  Copy,
  Layers,
  ListChecks,
  CalendarClock,
  Repeat,
  Send,
  UserPlus,
  BellRing,
  ScrollText,
  Menu,
} from "lucide-react";

interface FirstTimeGuideProps {
  onClose: () => void;
  onComplete: () => void;
}

/* -------------------------------------------------------------------------
 * Stijlgids — Het Verband Ternat
 * -----------------------------------------------------------------------*/
const brand = {
  green: "#4F8963",
  greenDark: "#3A5F45",
  cream: "#FAF7F0",
  cardWhite: "#FFFFFF",
  coral: "#E8785A",
  coralDark: "#C85F44",
  sage: "#7CA789",
  text: "#2E2E2A",
  textSoft: "#6B6A63",
  border: "#EFE9DE",
};

/* -------------------------------------------------------------------------
 * Illustratieve "screenshots" — lichte SVG-mockups van de echte schermen,
 * opgebouwd met de merkkleuren zodat de gids niet afhankelijk is van
 * losse afbeeldingsbestanden en altijd in stijl blijft.
 * -----------------------------------------------------------------------*/
function ShotFrame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="w-full">
      <div
        className="w-full overflow-hidden"
        style={{
          borderRadius: 20,
          border: `1px solid ${brand.border}`,
          background: brand.cardWhite,
          boxShadow: "0 8px 24px -12px rgba(58,95,69,0.18)",
        }}
      >
        <svg viewBox="0 0 560 300" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto block">
          {children}
        </svg>
      </div>
      <p
        className="mt-2 text-center text-[11px] font-semibold tracking-wide"
        style={{ color: brand.textSoft }}
      >
        {label}
      </p>
    </div>
  );
}

const ShotLogin = () => (
  <ShotFrame label="Inlogscherm">
    <rect width="560" height="300" fill={brand.cream} />
    <rect x="180" y="40" width="200" height="220" rx="24" fill={brand.cardWhite} stroke={brand.border} />
    <circle cx="280" cy="88" r="20" fill={brand.green} />
    <rect x="205" y="130" width="150" height="10" rx="5" fill={brand.text} opacity="0.85" />
    <rect x="205" y="150" width="150" height="26" rx="13" fill={brand.cream} stroke={brand.border} />
    <rect x="205" y="184" width="150" height="26" rx="13" fill={brand.cream} stroke={brand.border} />
    <rect x="205" y="222" width="150" height="30" rx="15" fill={brand.green} />
    <rect x="240" y="233" width="80" height="8" rx="4" fill="#fff" />
  </ShotFrame>
);

const ShotDashboard = () => (
  <ShotFrame label="Dashboard">
    <rect width="560" height="300" fill={brand.cream} />
    <rect x="20" y="18" width="520" height="52" rx="18" fill={brand.cardWhite} stroke={brand.border} />
    <rect x="38" y="32" width="160" height="10" rx="5" fill={brand.text} />
    <rect x="38" y="48" width="110" height="7" rx="3.5" fill={brand.textSoft} />
    <rect x="430" y="30" width="90" height="24" rx="12" fill={brand.cream} stroke={brand.border} />
    <rect x="20" y="82" width="330" height="190" rx="18" fill={brand.cardWhite} stroke={brand.border} />
    <rect x="36" y="98" width="140" height="10" rx="5" fill={brand.greenDark} />
    {[0, 1, 2].map((i) => (
      <g key={i}>
        <rect x="36" y={126 + i * 40} width="298" height="30" rx="10" fill={brand.cream} stroke={brand.border} />
        <circle cx="52" cy={141 + i * 40} r="8" fill={i === 0 ? brand.coral : brand.sage} />
        <rect x="68" y={136 + i * 40} width="140" height="8" rx="4" fill={brand.text} opacity="0.8" />
        <rect x="270" y={136 + i * 40} width="50" height="8" rx="4" fill={brand.textSoft} />
      </g>
    ))}
    <rect x="366" y="82" width="174" height="90" rx="18" fill={brand.cardWhite} stroke={brand.border} />
    <rect x="380" y="96" width="90" height="9" rx="4.5" fill={brand.greenDark} />
    <circle cx="500" cy="100" r="10" fill={brand.coral} />
    <rect x="380" y="118" width="146" height="8" rx="4" fill={brand.textSoft} />
    <rect x="380" y="134" width="120" height="8" rx="4" fill={brand.textSoft} />
    <rect x="366" y="184" width="174" height="88" rx="18" fill={brand.cardWhite} stroke={brand.border} />
    <rect x="380" y="198" width="146" height="9" rx="4.5" fill={brand.greenDark} />
    <rect x="380" y="220" width="65" height="34" rx="10" fill={brand.cream} stroke={brand.border} />
    <rect x="455" y="220" width="65" height="34" rx="10" fill={brand.cream} stroke={brand.border} />
  </ShotFrame>
);

const ShotCalendarWeek = () => (
  <ShotFrame label="Dienstregeling — weekweergave">
    <rect width="560" height="300" fill={brand.cream} />
    <rect x="20" y="18" width="520" height="40" rx="16" fill={brand.cardWhite} stroke={brand.border} />
    <rect x="36" y="32" width="120" height="10" rx="5" fill={brand.text} />
    <rect x="380" y="26" width="70" height="22" rx="11" fill={brand.green} />
    <rect x="456" y="26" width="70" height="22" rx="11" fill={brand.cream} stroke={brand.border} />
    <rect x="20" y="68" width="520" height="212" rx="16" fill={brand.cardWhite} stroke={brand.border} />
    {Array.from({ length: 7 }).map((_, i) => (
      <g key={i}>
        <rect x={30 + i * 74} y="80" width="66" height="20" rx="8" fill={brand.cream} />
        <rect x={38 + i * 74} y="86" width="30" height="7" rx="3.5" fill={brand.textSoft} />
      </g>
    ))}
    {[
      { x: 0, y: 110, c: brand.green },
      { x: 1, y: 150, c: brand.sage },
      { x: 2, y: 110, c: brand.coral },
      { x: 3, y: 190, c: brand.green },
      { x: 4, y: 110, c: brand.sage },
      { x: 5, y: 150, c: brand.green },
      { x: 6, y: 110, c: brand.sage },
    ].map((b, i) => (
      <rect key={i} x={30 + b.x * 74} y={b.y} width="66" height="32" rx="8" fill={b.c} opacity="0.9" />
    ))}
  </ShotFrame>
);

const ShotShiftModal = () => (
  <ShotFrame label="Dienst aanmaken / bewerken">
    <rect width="560" height="300" fill="rgba(46,46,42,0.35)" />
    <rect x="130" y="26" width="300" height="248" rx="22" fill={brand.cardWhite} stroke={brand.border} />
    <rect x="150" y="44" width="150" height="11" rx="5.5" fill={brand.text} />
    <circle cx="410" cy="50" r="10" fill={brand.cream} stroke={brand.border} />
    {["Naam dienst", "Starttijd", "Eindtijd", "Aantal medewerkers", "Notities"].map((_, i) => (
      <g key={i}>
        <rect x="150" y={72 + i * 34} width="260" height="24" rx="12" fill={brand.cream} stroke={brand.border} />
      </g>
    ))}
    <rect x="150" y="246" width="120" height="14" rx="7" fill={brand.sage} opacity="0.5" />
    <rect x="300" y="240" width="110" height="26" rx="13" fill={brand.green} />
  </ShotFrame>
);

const ShotTemplates = () => (
  <ShotFrame label="Terugkerende sjablonen">
    <rect width="560" height="300" fill={brand.cream} />
    <rect x="20" y="20" width="520" height="260" rx="20" fill={brand.cardWhite} stroke={brand.border} />
    <rect x="40" y="38" width="180" height="11" rx="5.5" fill={brand.greenDark} />
    <rect x="440" y="34" width="100" height="26" rx="13" fill={brand.green} />
    {[0, 1, 2].map((i) => (
      <g key={i}>
        <rect x="40" y={78 + i * 62} width="480" height="50" rx="14" fill={brand.cream} stroke={brand.border} />
        <rect x="56" y={92 + i * 62} width="10" height="22" rx="5" fill={[brand.green, brand.coral, brand.sage][i]} />
        <rect x="76" y={92 + i * 62} width="150" height="9" rx="4.5" fill={brand.text} opacity="0.85" />
        <rect x="76" y={106 + i * 62} width="220" height="7" rx="3.5" fill={brand.textSoft} />
        <rect x="420" y={96 + i * 62} width="80" height="20" rx="10" fill={brand.cardWhite} stroke={brand.border} />
      </g>
    ))}
  </ShotFrame>
);

const ShotCopyWeek = () => (
  <ShotFrame label="Week/maand kopiëren">
    <rect width="560" height="300" fill="rgba(46,46,42,0.35)" />
    <rect x="120" y="40" width="320" height="220" rx="22" fill={brand.cardWhite} stroke={brand.border} />
    <rect x="140" y="60" width="170" height="11" rx="5.5" fill={brand.text} />
    <rect x="140" y="92" width="130" height="20" rx="10" fill={brand.green} />
    <rect x="278" y="92" width="120" height="20" rx="10" fill={brand.cream} stroke={brand.border} />
    <rect x="140" y="128" width="260" height="8" rx="4" fill={brand.textSoft} />
    <g>
      <rect x="140" y="150" width="110" height="34" rx="10" fill={brand.cream} stroke={brand.border} />
      <path d="M270 167 h40 m-8 -8 l8 8 l-8 8" stroke={brand.coral} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="320" y="150" width="110" height="34" rx="10" fill={brand.cream} stroke={brand.border} />
    </g>
    <rect x="140" y="222" width="180" height="14" rx="7" fill={brand.sage} opacity="0.5" />
    <rect x="330" y="216" width="100" height="26" rx="13" fill={brand.green} />
  </ShotFrame>
);

const ShotBulk = () => (
  <ShotFrame label="Bulkacties op meerdere diensten">
    <rect width="560" height="300" fill={brand.cream} />
    <rect x="20" y="20" width="520" height="260" rx="20" fill={brand.cardWhite} stroke={brand.border} />
    <rect x="40" y="36" width="200" height="24" rx="12" fill={brand.coral} opacity="0.15" />
    <rect x="52" y="44" width="140" height="9" rx="4.5" fill={brand.coralDark} />
    {[0, 1, 2, 3].map((i) => (
      <g key={i}>
        <rect x="40" y={76 + i * 44} width="480" height="34" rx="12" fill={i % 2 === 0 ? brand.cream : brand.cardWhite} stroke={brand.border} />
        <rect x="54" y={86 + i * 44} width="16" height="16" rx="4" fill={i < 2 ? brand.green : brand.cardWhite} stroke={brand.green} strokeWidth="2" />
        {i < 2 && <path d={`M58 ${94 + i * 44} l4 4 l7 -8`} stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
        <rect x="84" y={86 + i * 44} width="160" height="8" rx="4" fill={brand.text} opacity="0.75" />
        <rect x="270" y={86 + i * 44} width="90" height="8" rx="4" fill={brand.textSoft} />
      </g>
    ))}
    <rect x="330" y="246" width="190" height="26" rx="13" fill={brand.green} />
  </ShotFrame>
);

const ShotLeave = () => (
  <ShotFrame label="Verlofaanvragen">
    <rect width="560" height="300" fill={brand.cream} />
    <rect x="20" y="20" width="520" height="46" rx="18" fill={brand.cardWhite} stroke={brand.border} />
    <rect x="38" y="36" width="220" height="11" rx="5.5" fill={brand.text} />
    <rect x="440" y="32" width="100" height="26" rx="13" fill={brand.green} />
    {[
      { label: "Goedgekeurd", c: brand.green },
      { label: "In behandeling", c: brand.coral },
      { label: "Geweigerd", c: brand.textSoft },
    ].map((s, i) => (
      <g key={i}>
        <rect x="20" y={80 + i * 66} width="520" height="52" rx="16" fill={brand.cardWhite} stroke={brand.border} />
        <rect x="36" y={94 + i * 66} width="130" height="9" rx="4.5" fill={brand.text} opacity="0.85" />
        <rect x="36" y={110 + i * 66} width="200" height="7" rx="3.5" fill={brand.textSoft} />
        <rect x="440" y={96 + i * 66} width="80" height="22" rx="11" fill={s.c} opacity={i === 1 ? 1 : 0.15} />
      </g>
    ))}
  </ShotFrame>
);

const ShotSwap = () => (
  <ShotFrame label="Ruilbord">
    <rect width="560" height="300" fill={brand.cream} />
    <rect x="20" y="20" width="520" height="260" rx="20" fill={brand.cardWhite} stroke={brand.border} />
    <rect x="40" y="40" width="180" height="11" rx="5.5" fill={brand.greenDark} />
    <rect x="440" y="34" width="100" height="26" rx="13" fill={brand.green} />
    <rect x="40" y="80" width="216" height="80" rx="14" fill={brand.cream} stroke={brand.border} />
    <rect x="56" y="94" width="90" height="8" rx="4" fill={brand.text} opacity="0.8" />
    <rect x="56" y="110" width="150" height="7" rx="3.5" fill={brand.textSoft} />
    <rect x="56" y="126" width="120" height="7" rx="3.5" fill={brand.textSoft} />
    <circle cx="284" cy="120" r="18" fill={brand.coral} opacity="0.15" />
    <path d="M276 120 h16 m-6 -6 l6 6 l-6 6 M292 128 h-16 m6 6 l-6 -6 l6 -6" stroke={brand.coral} strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="304" y="80" width="216" height="80" rx="14" fill={brand.cream} stroke={brand.border} />
    <rect x="320" y="94" width="90" height="8" rx="4" fill={brand.text} opacity="0.8" />
    <rect x="320" y="110" width="150" height="7" rx="3.5" fill={brand.textSoft} />
    <rect x="320" y="126" width="120" height="7" rx="3.5" fill={brand.textSoft} />
    <rect x="40" y="176" width="480" height="60" rx="14" fill={brand.cardWhite} stroke={brand.border} />
    <rect x="56" y="192" width="200" height="8" rx="4" fill={brand.textSoft} />
    <rect x="56" y="208" width="140" height="8" rx="4" fill={brand.textSoft} />
    <rect x="330" y="188" width="80" height="24" rx="12" fill={brand.green} />
    <rect x="418" y="188" width="80" height="24" rx="12" fill={brand.cardWhite} stroke={brand.coral} />
  </ShotFrame>
);

const ShotAvailability = () => (
  <ShotFrame label="Mijn Beschikbaarheid">
    <rect width="560" height="300" fill={brand.cream} />
    <rect x="20" y="20" width="520" height="260" rx="20" fill={brand.cardWhite} stroke={brand.border} />
    <rect x="40" y="38" width="220" height="11" rx="5.5" fill={brand.greenDark} />
    <rect x="40" y="70" width="230" height="70" rx="14" fill={brand.cream} stroke={brand.border} />
    <rect x="56" y="86" width="140" height="8" rx="4" fill={brand.text} opacity="0.8" />
    <rect x="56" y="104" width="90" height="22" rx="11" fill={brand.cardWhite} stroke={brand.border} />
    <rect x="290" y="70" width="230" height="70" rx="14" fill={brand.cream} stroke={brand.border} />
    <rect x="306" y="86" width="140" height="8" rx="4" fill={brand.text} opacity="0.8" />
    <rect x="306" y="104" width="90" height="22" rx="11" fill={brand.cardWhite} stroke={brand.border} />
    <rect x="40" y="156" width="480" height="34" rx="10" fill={brand.cardWhite} stroke={brand.border} />
    {Array.from({ length: 7 }).map((_, i) => (
      <circle key={i} cx={70 + i * 62} cy="173" r="10" fill={i % 3 === 0 ? brand.sage : brand.cream} stroke={brand.border} />
    ))}
    <rect x="40" y="206" width="480" height="50" rx="14" fill={brand.cream} stroke={brand.border} />
    <rect x="56" y="222" width="160" height="8" rx="4" fill={brand.textSoft} />
    <rect x="400" y="216" width="100" height="24" rx="12" fill={brand.coral} />
  </ShotFrame>
);

const ShotAdminEmployees = () => (
  <ShotFrame label="Beheercentrum — Gebruikers">
    <rect width="560" height="300" fill={brand.cream} />
    <rect x="20" y="20" width="520" height="42" rx="16" fill={brand.cardWhite} stroke={brand.border} />
    {["Rapporten", "Gebruikers", "Instellingen", "E-mails", "Meldingen", "Logboek"].map((_, i) => (
      <rect key={i} x={34 + i * 82} y="32" width="74" height="18" rx="9" fill={i === 1 ? brand.green : brand.cream} />
    ))}
    <rect x="20" y="74" width="520" height="206" rx="18" fill={brand.cardWhite} stroke={brand.border} />
    <rect x="440" y="90" width="80" height="24" rx="12" fill={brand.green} />
    {[0, 1, 2, 3].map((i) => (
      <g key={i}>
        <rect x="36" y={124 + i * 34} width="488" height="26" rx="8" fill={i % 2 === 0 ? brand.cream : brand.cardWhite} />
        <circle cx="52" cy={137 + i * 34} r="8" fill={brand.sage} />
        <rect x="68" y={132 + i * 34} width="120" height="8" rx="4" fill={brand.text} opacity="0.8" />
        <rect x="420" y={132 + i * 34} width="60" height="8" rx="4" fill={brand.textSoft} />
      </g>
    ))}
  </ShotFrame>
);

const ShotAdminSettings = () => (
  <ShotFrame label="Beheercentrum — E-mail & Instellingen">
    <rect width="560" height="300" fill={brand.cream} />
    <rect x="20" y="20" width="250" height="260" rx="18" fill={brand.cardWhite} stroke={brand.border} />
    <rect x="36" y="36" width="140" height="10" rx="5" fill={brand.greenDark} />
    {["Simulatiemodus", "Resend API", "Eigen SMTP-server"].map((_, i) => (
      <g key={i}>
        <rect x="36" y={60 + i * 30} width="218" height="22" rx="11" fill={i === 2 ? brand.green : brand.cream} stroke={brand.border} opacity={i === 2 ? 1 : 1} />
      </g>
    ))}
    <rect x="36" y="156" width="218" height="20" rx="10" fill={brand.cream} stroke={brand.border} />
    <rect x="36" y="184" width="218" height="20" rx="10" fill={brand.cream} stroke={brand.border} />
    <rect x="36" y="220" width="218" height="26" rx="13" fill={brand.green} />
    <rect x="290" y="20" width="250" height="120" rx="18" fill={brand.cardWhite} stroke={brand.border} />
    <rect x="306" y="36" width="160" height="10" rx="5" fill={brand.greenDark} />
    <rect x="306" y="60" width="130" height="18" rx="9" fill={brand.cream} stroke={brand.border} />
    <rect x="444" y="60" width="80" height="18" rx="9" fill={brand.green} />
    <rect x="306" y="90" width="218" height="8" rx="4" fill={brand.textSoft} />
    <rect x="290" y="150" width="250" height="130" rx="18" fill={brand.cardWhite} stroke={brand.coral} />
    <rect x="306" y="166" width="160" height="10" rx="5" fill={brand.coralDark} />
    <rect x="306" y="188" width="218" height="8" rx="4" fill={brand.textSoft} />
    <rect x="306" y="200" width="218" height="8" rx="4" fill={brand.textSoft} />
    <rect x="306" y="240" width="218" height="26" rx="13" fill={brand.coral} />
  </ShotFrame>
);

const ShotIcal = () => (
  <ShotFrame label="Kalendersynchronisatie (iCal)">
    <rect width="560" height="300" fill={brand.cream} />
    <rect x="70" y="40" width="420" height="220" rx="20" fill={brand.cardWhite} stroke={brand.border} />
    <rect x="90" y="58" width="180" height="11" rx="5.5" fill={brand.greenDark} />
    <rect x="90" y="90" width="170" height="24" rx="12" fill={brand.green} />
    <rect x="270" y="90" width="170" height="24" rx="12" fill={brand.cream} stroke={brand.border} />
    <rect x="90" y="130" width="350" height="30" rx="10" fill={brand.cream} stroke={brand.border} />
    <rect x="90" y="172" width="165" height="28" rx="14" fill={brand.green} />
    <rect x="265" y="172" width="165" height="28" rx="14" fill={brand.sage} />
    <rect x="90" y="216" width="340" height="8" rx="4" fill={brand.textSoft} />
  </ShotFrame>
);

const ShotHelpButton = () => (
  <ShotFrame label="Handleiding heropenen">
    <rect width="560" height="300" fill={brand.cream} />
    <rect x="20" y="20" width="520" height="48" rx="18" fill={brand.cardWhite} stroke={brand.border} />
    <circle cx="46" cy="44" r="14" fill={brand.green} />
    <rect x="70" y="38" width="150" height="10" rx="5" fill={brand.text} />
    <circle cx="472" cy="44" r="16" fill={brand.cream} stroke={brand.green} strokeWidth="2" />
    <text x="472" y="49" textAnchor="middle" fontSize="14" fontWeight="700" fill={brand.green}>?</text>
    <circle cx="512" cy="44" r="16" fill={brand.cream} stroke={brand.border} />
  </ShotFrame>
);

/* -------------------------------------------------------------------------
 * Inhoud van de handleiding
 * -----------------------------------------------------------------------*/
type Step = {
  id: string;
  title: string;
  body: React.ReactNode;
  shot?: React.ReactNode;
  tip?: string;
};

type Chapter = {
  id: string;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  steps: Step[];
};

const chapters: Chapter[] = [
  {
    id: "start",
    label: "Aan de slag",
    shortLabel: "Start",
    icon: Home,
    steps: [
      {
        id: "welcome",
        title: "Welkom bij Het Verband Ternat Planner",
        body: (
          <>
            <p>
              Dit is het zelf-gehoste planningssysteem voor de thuisverpleegkundigen en het
              beheerteam van Het Verband Ternat. Deze handleiding neemt je stap voor stap mee
              door elk onderdeel: van inloggen tot het versturen van de maandplanning per e-mail.
            </p>
            <p className="mt-2">
              Gebruik de hoofdstukken links (of onderaan op mobiel) om meteen naar een onderwerp
              te springen, of doorloop alles op volgorde met <em>Volgende</em>.
            </p>
          </>
        ),
        shot: <ShotDashboard />,
      },
      {
        id: "login",
        title: "Inloggen met het standaardaccount",
        body: (
          <>
            <p>Log de eerste keer in met het meegeleverde beheerdersaccount:</p>
            <div
              className="mt-3 p-3 space-y-1"
              style={{ background: brand.cream, border: `1px solid ${brand.border}`, borderRadius: 14 }}
            >
              <code
                className="block text-sm font-mono px-2 py-1 rounded-[10px]"
                style={{ color: brand.greenDark, background: "#fff" }}
              >
                admin@homenursing.org
              </code>
              <code
                className="block text-sm font-mono px-2 py-1 rounded-[10px]"
                style={{ color: brand.greenDark, background: "#fff" }}
              >
                admin123
              </code>
            </div>
            <p className="mt-3 text-sm font-semibold" style={{ color: brand.coralDark }}>
              ⚠️ Wijzig dit wachtwoord onmiddellijk na de eerste login via je profiel — de app
              vraagt hier automatisch om bij een verplichte wachtwoordwijziging.
            </p>
          </>
        ),
        shot: <ShotLogin />,
      },
      {
        id: "navigatie",
        title: "De navigatie: zijbalk, koptekst en mobiele balk",
        body: (
          <>
            <p>
              Op desktop vind je links een <strong>zijbalk</strong> met Dashboard, Dienstregeling,
              Verlofaanvragen, Ruilbord en — enkel voor medewerkers — Mijn Beschikbaarheid.
              Beheerders zien daaronder ook <strong>Beheercentrum</strong>, met een teller voor
              openstaande verlof- en ruilaanvragen. Klap de balk in met de pijltjesknop onderaan
              om meer werkruimte te krijgen.
            </p>
            <p className="mt-2">
              Op mobiel verschijnt dezelfde navigatie als een balk onderaan het scherm. Bovenaan
              staat steeds je naam, rol, het <strong>?</strong>-icoon om deze handleiding opnieuw
              te openen, en de afmeldknop.
            </p>
          </>
        ),
        shot: <ShotHelpButton />,
        tip: "Deze handleiding verschijnt automatisch bij de eerste login van een beheerder, en is daarna altijd terug te vinden via het vraagteken-icoon rechtsboven.",
      },
    ],
  },
  {
    id: "dashboard",
    label: "Dashboard",
    shortLabel: "Dashboard",
    icon: Calendar,
    steps: [
      {
        id: "dashboard-overzicht",
        title: "Je persoonlijke startpagina",
        body: (
          <>
            <p>
              Het dashboard toont je diensten voor de komende 7 dagen, gescheiden in
              "vandaag" en "binnenkort". Beheerders zien de diensten van het hele team,
              medewerkers zien enkel hun eigen rooster.
            </p>
            <p className="mt-2">
              Rechts vind je het <strong>meldingencentrum</strong> en het{" "}
              <strong>wekelijks overzicht</strong> met het aantal geplande diensten, hoeveel
              daarvan een medewerker toegewezen kregen, en het dekkingspercentage.
            </p>
          </>
        ),
        shot: <ShotDashboard />,
      },
      {
        id: "meldingen",
        title: "Meldingen beheren",
        body: (
          <>
            <p>
              Elke melding kun je <strong>markeren als gelezen</strong>,{" "}
              <strong>archiveren</strong> of <strong>verwijderen</strong>. Klik op een melding
              met een link (bijvoorbeeld een mededeling of aanvraag) om er direct naartoe te
              springen. Ongelezen meldingen krijgen een groene teller bovenaan het paneel.
            </p>
          </>
        ),
      },
      {
        id: "ical",
        title: "Kalender synchroniseren (iCal)",
        body: (
          <>
            <p>
              Iedereen — medewerker of beheerder — kan het eigen werkrooster koppelen aan
              iPhone/Apple Calendar, Google Calendar of Outlook via een persoonlijke iCal-link.
              Kies eerst de reikwijdte:
            </p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>
                <strong>Enkel mijn shifts</strong> — alleen de diensten die aan jou zijn
                toegewezen.
              </li>
              <li>
                <strong>Alle shifts</strong> — het volledige teamrooster.
              </li>
            </ul>
            <p className="mt-2">
              Klik daarna op <strong>Kopieer Link</strong> om de URL te plakken in je
              agenda-app, of gebruik <strong>Direct Abonneren</strong> om ze meteen te openen
              met <code>webcal://</code> (ideaal op iOS/macOS). Wijzigingen in het planbord
              verschijnen automatisch in je agenda — er is geen handmatige export nodig.
            </p>
          </>
        ),
        shot: <ShotIcal />,
      },
    ],
  },
  {
    id: "kalender",
    label: "Dienstregeling",
    shortLabel: "Planning",
    icon: Calendar,
    steps: [
      {
        id: "weergaves",
        title: "Weekweergave, maandweergave en dagweergave",
        body: (
          <>
            <p>
              De Dienstregeling is het hart van de planner. Schakel bovenaan tussen{" "}
              <strong>dag-</strong>, <strong>week-</strong> en <strong>maandweergave</strong>,
              blader met de pijltjes naar een andere periode, en filter op een specifieke
              medewerker om enkel diens diensten te zien. Een <strong>printmodus</strong> maakt
              een opgeschoonde, afdrukbare versie van het rooster zonder knoppen of invoervelden.
            </p>
          </>
        ),
        shot: <ShotCalendarWeek />,
      },
      {
        id: "dienst-aanmaken",
        title: "Een nieuwe dienst aanmaken of bewerken",
        body: (
          <>
            <p>Klik op een dag (of op "Nieuwe dienst") om een dienst te configureren:</p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li><strong>Naam</strong> van de dienst (bv. Voormiddag, Namiddag, Nacht)</li>
              <li><strong>Begin- en eindtijd</strong></li>
              <li><strong>Kleurlabel</strong>, zodat je diensttypes visueel herkent op het rooster</li>
              <li><strong>Aantal benodigde medewerkers</strong> voor die dienst</li>
              <li><strong>Notities</strong> voor bijzonderheden</li>
              <li>Optioneel meteen een <strong>medewerker toewijzen</strong></li>
            </ul>
            <p className="mt-2">
              Een bestaande dienst open je door erop te klikken; hetzelfde formulier verschijnt
              dan gevuld met de huidige gegevens, met een verwijderoptie onderaan.
            </p>
          </>
        ),
        shot: <ShotShiftModal />,
        tip: "Sleep een medewerker-tegel simpelweg naar een ander diensttje op het rooster om snel te herschikken (drag & drop), zonder het formulier te openen.",
      },
      {
        id: "presets",
        title: "Sneldiensten (presets) instellen",
        body: (
          <>
            <p>
              Onder <strong>Sneldiensten</strong> leg je veelgebruikte combinaties vast — label,
              start- en eindtijd, kleur en eventueel een standaard-medewerker. Bij het aanmaken
              van een nieuwe dienst kies je zo'n preset met één klik in plaats van elk veld
              telkens opnieuw in te vullen. Presets zijn te allen tijde te bewerken of te
              verwijderen in hetzelfde beheervenster.
            </p>
          </>
        ),
      },
      {
        id: "templates",
        title: "Terugkerende sjablonen & automatisch genereren",
        body: (
          <>
            <p>
              Voor vaste, wekelijks terugkerende bezetting gebruik je{" "}
              <strong>Sjablonen</strong>. Een sjabloon bevat naam, tijden, kleur, benodigd
              aantal medewerkers, notities, de <strong>dagen van de week</strong> waarop het
              van toepassing is, en het herhalingsritme: <strong>wekelijks</strong> of{" "}
              <strong>tweewekelijks</strong>, met een start- en optionele einddatum.
            </p>
            <p className="mt-2">
              Klik op <strong>Genereer diensten</strong> bij een sjabloon en kies een
              periode (bv. de hele komende maand): de planner maakt dan automatisch alle
              individuele diensten aan volgens dat patroon, en wijst — indien aangevinkt — meteen
              de standaard-medewerker toe. Zo hoef je een terugkerend rooster nooit meer met de
              hand in te typen.
            </p>
          </>
        ),
        shot: <ShotTemplates />,
        tip: "Een sjabloon verwijderen kan zonder de al gegenereerde diensten te wissen, of net inclusief — je kiest dit expliciet bij het verwijderen.",
      },
      {
        id: "kopieren",
        title: "Week of maand kopiëren",
        body: (
          <>
            <p>
              Heb je een week die je gewoon wilt herhalen, zonder een sjabloon op te zetten?
              Gebruik <strong>Kopieer week</strong> om:
            </p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>een bronweek naar één doelweek te kopiëren,</li>
              <li>diezelfde week meerdere keren achter elkaar te <strong>herhalen</strong> (zelf aantal weken instellen), of</li>
              <li>een hele <strong>maand</strong> naar een andere maand te kopiëren.</li>
            </ul>
            <p className="mt-2">
              Vink <strong>medewerkers meekopiëren</strong> aan om ook de toewijzingen over te
              nemen, of laat dit uit als je enkel de lege diensten wilt dupliceren.
            </p>
          </>
        ),
        shot: <ShotCopyWeek />,
      },
      {
        id: "bulk",
        title: "Bulkacties op meerdere diensten tegelijk",
        body: (
          <>
            <p>
              Schakel de <strong>bulkmodus</strong> in om meerdere diensten aan te vinken en in
              één beweging te bewerken:
            </p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li><strong>Toewijzen</strong> aan één medewerker</li>
              <li><strong>Datums verschuiven</strong> met een zelf gekozen aantal dagen</li>
              <li><strong>Verwijderen</strong>, met een bevestigingsstap ter voorkoming van fouten</li>
            </ul>
          </>
        ),
        shot: <ShotBulk />,
      },
    ],
  },
  {
    id: "verlof",
    label: "Verlof & Afwezigheid",
    shortLabel: "Verlof",
    icon: ClipboardList,
    steps: [
      {
        id: "aanvragen",
        title: "Een verlofaanvraag indienen",
        body: (
          <>
            <p>Elke medewerker kan een aanvraag indienen met:</p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li><strong>Type</strong>: Betaald verlof / Vakantie, Ziekteverlof, Opleiding / Training, of Persoonlijk verlof</li>
              <li><strong>Begin- en einddatum</strong></li>
              <li>Een <strong>toelichting</strong></li>
            </ul>
            <p className="mt-2">
              Na indienen krijgt de aanvraag status <strong>in behandeling</strong> en verschijnt
              ze bij de beheerder(s), die ze kunnen goedkeuren of weigeren — steeds met een
              optioneel antwoordbericht. Een nog niet-behandelde aanvraag kan de indiener zelf
              annuleren.
            </p>
          </>
        ),
        shot: <ShotLeave />,
      },
      {
        id: "goedkeuren",
        title: "Aanvragen goedkeuren als beheerder",
        body: (
          <>
            <p>
              Beheerders zien alle aanvragen van het team, met filters op status. Bij{" "}
              <strong>goedkeuren</strong> of <strong>weigeren</strong> kun je een reactie
              toevoegen die de medewerker als melding ontvangt — handig om bijvoorbeeld een
              weigering te motiveren of een goedkeuring te bevestigen met praktische afspraken.
            </p>
          </>
        ),
        tip: "Openstaande verlofaanvragen tellen mee in de badge naast 'Beheercentrum' in de zijbalk, zodat niets over het hoofd wordt gezien.",
      },
    ],
  },
  {
    id: "ruilbord",
    label: "Ruilbord",
    shortLabel: "Ruilbord",
    icon: ArrowLeftRight,
    steps: [
      {
        id: "ruil-aanvragen",
        title: "Een dienst voorstellen om te ruilen",
        body: (
          <>
            <p>
              Op het <strong>Ruilbord</strong> kies je een van je eigen toegewezen diensten,
              selecteert een collega en — indien van toepassing — een specifieke dienst van die
              collega om mee te ruilen. Voeg een reden toe zodat de collega en de beheerder
              begrijpen waarom je wilt ruilen.
            </p>
          </>
        ),
        shot: <ShotSwap />,
      },
      {
        id: "ruil-workflow",
        title: "Het volledige goedkeuringstraject",
        body: (
          <>
            <p>
              Een ruilverzoek doorloopt doorgaans twee stappen: eerst reageert de betrokken
              collega (accepteren of afwijzen, met een optioneel commentaar), en vervolgens
              bevestigt de beheerder de definitieve ruil zodat het rooster automatisch wordt
              aangepast. Zo blijft de bezetting altijd correct en traceerbaar.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: "beschikbaarheid",
    label: "Mijn Beschikbaarheid",
    shortLabel: "Beschikbaar",
    icon: Clock,
    steps: [
      {
        id: "voorkeuren",
        title: "Wekelijkse limieten en voorkeuren",
        body: (
          <>
            <p>
              Medewerkers stellen hier hun eigen{" "}
              <strong>maximaal aantal uren per week</strong> en{" "}
              <strong>maximaal aantal opeenvolgende werkdagen</strong> in. Deze voorkeuren
              geven de beheerder houvast bij het plannen, zonder dat ze een harde blokkade
              vormen.
            </p>
          </>
        ),
        shot: <ShotAvailability />,
      },
      {
        id: "uitzonderingen",
        title: "Specifieke dagen markeren",
        body: (
          <>
            <p>
              Naast de algemene voorkeuren kun je individuele datums markeren als{" "}
              <strong>beschikbaar</strong> of <strong>niet beschikbaar</strong> — bijvoorbeeld
              voor een eenmalige afspraak. Deze uitzonderingen zijn zichtbaar voor de beheerder
              bij het samenstellen van het rooster.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: "beheer",
    label: "Beheercentrum",
    shortLabel: "Beheer",
    icon: Settings,
    steps: [
      {
        id: "gebruikers",
        title: "Medewerkers en accounts beheren",
        body: (
          <>
            <p>
              Onder het tabblad <strong>Gebruikers</strong> maak je nieuwe accounts aan voor
              verpleegkundigen en andere beheerders, pas je gegevens aan, en krijg je een
              overzicht van elk teamlid met rol en status. Nieuwe medewerkers ontvangen zo
              meteen toegang tot hun eigen rooster, verlof- en ruilfunctionaliteit.
            </p>
          </>
        ),
        shot: <ShotAdminEmployees />,
      },
      {
        id: "rapporten",
        title: "Rapporten en dekkingsoverzicht",
        body: (
          <>
            <p>
              Het tabblad <strong>Rapporten</strong> toont statistieken zoals het aantal
              openstaande verlof- en ruilaanvragen en de teambezetting — dezelfde cijfers die
              ook de badge in de zijbalk voeden.
            </p>
          </>
        ),
      },
      {
        id: "email",
        title: "E-mailnotificaties configureren",
        body: (
          <>
            <p>Onder <strong>Instellingen</strong> kies je hoe de planner mailt:</p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li><strong>Simulatiemodus</strong> — e-mails worden enkel gelogd, niet echt verzonden (handig om te testen)</li>
              <li><strong>Resend API</strong> — met een Resend API-sleutel, ideaal voor een snelle, betrouwbare setup</li>
              <li><strong>Eigen SMTP-server</strong> — bijvoorbeeld Gmail met een app-wachtwoord, of de SMTP-gegevens van je eigen provider</li>
            </ul>
            <p className="mt-2">
              Stel steeds het <strong>afzenderadres</strong> in. Test de configuratie met de
              knop <strong>Test e-mail</strong> voor je verder gaat.
            </p>
          </>
        ),
        shot: <ShotAdminSettings />,
      },
      {
        id: "maandplanning",
        title: "Maandplanning per e-mail versturen",
        body: (
          <>
            <p>
              Kies een maand en verstuur het vastgestelde rooster automatisch naar iedereen
              per e-mail. Wil je bepaalde accounts uitsluiten (bijvoorbeeld een stagiair of een
              testaccount), vink ze dan af in de lijst voor je verstuurt.
            </p>
          </>
        ),
      },
      {
        id: "mededelingen",
        title: "Mededelingen plaatsen",
        body: (
          <>
            <p>
              Onder <strong>Mededelingen</strong> plaats je berichten die op ieders dashboard
              verschijnen — bijvoorbeeld een organisatiebrede aankondiging. Elke gebruiker kan
              zo'n mededeling later archiveren of verwijderen uit zijn eigen meldingencentrum.
            </p>
          </>
        ),
      },
      {
        id: "logs",
        title: "Auditlog en e-maillog",
        body: (
          <>
            <p>
              Voor traceerbaarheid houdt de planner een <strong>auditlogboek</strong> bij van
              belangrijke acties, en een apart <strong>e-maillogboek</strong> van elk verzonden
              bericht (inclusief testmails en maandplanningen) — onmisbaar bij het oplossen van
              een probleem met een SMTP- of Resend-configuratie.
            </p>
          </>
        ),
      },
      {
        id: "reset",
        title: "Database resetten naar Nederlandstalige seeddata",
        body: (
          <>
            <p>
              Onderaan <strong>Instellingen</strong> vind je een herstartknop die de volledige
              database terugzet naar de vertaalde Nederlandstalige voorbeeldgegevens
              (verpleegkundigen, zorgverleners en voorbeelddiensten).
            </p>
            <p className="mt-2 text-sm font-semibold" style={{ color: brand.coralDark }}>
              ⚠️ Dit wist onomkeerbaar alle handmatig aangemaakte diensten, geregistreerde
              medewerkers en ingediende verlofaanvragen. Gebruik dit enkel bewust, bijvoorbeeld
              bij een eerste opzet of om terug te keren naar een schone testomgeving.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: "afronding",
    label: "Klaar om te starten",
    shortLabel: "Klaar",
    icon: ShieldCheck,
    steps: [
      {
        id: "checklist",
        title: "Je opstart-checklist",
        body: (
          <>
            <p>Je hebt nu alle functionaliteiten van de planner gezien. Voor je start, loop kort deze checklist na:</p>
            <ul className="mt-3 space-y-2">
              {[
                "Wachtwoord van het beheerdersaccount gewijzigd",
                "E-mailconfiguratie ingesteld en getest",
                "Medewerkers toegevoegd via Beheercentrum",
                "Sneldiensten en/of sjablonen aangemaakt voor terugkerende bezetting",
                "Eerste rooster samengesteld of gegenereerd",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[7px]"
                    style={{ background: brand.green, color: "#fff" }}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <span style={{ color: brand.text }}>{item}</span>
                </li>
              ))}
            </ul>
          </>
        ),
      },
      {
        id: "hulp",
        title: "Hulp nodig? Zo vind je deze gids terug",
        body: (
          <>
            <p>
              Klik op elk moment op het <strong>?</strong>-icoon naast je profiel om deze
              volledige handleiding opnieuw te openen — je hoeft niets te onthouden.
            </p>
          </>
        ),
        shot: <ShotHelpButton />,
      },
    ],
  },
];

const flatSteps: { chapterIndex: number; stepIndex: number }[] = chapters.flatMap((ch, ci) =>
  ch.steps.map((_, si) => ({ chapterIndex: ci, stepIndex: si }))
);

/* -------------------------------------------------------------------------
 * Component
 * -----------------------------------------------------------------------*/
export default function FirstTimeGuide({ onClose, onComplete }: FirstTimeGuideProps) {
  const [flatIndex, setFlatIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showChapterNav, setShowChapterNav] = useState(false);

  const totalFlatSteps = flatSteps.length;
  const { chapterIndex, stepIndex } = flatSteps[flatIndex];
  const currentChapter = chapters[chapterIndex];
  const currentStep = currentChapter.steps[stepIndex];
  const isVeryLast = flatIndex === totalFlatSteps - 1;

  const overallProgress = useMemo(() => ((flatIndex + 1) / totalFlatSteps) * 100, [flatIndex]);

  const goTo = (newIndex: number) => {
    if (isAnimating || newIndex < 0 || newIndex >= totalFlatSteps) return;
    setIsAnimating(true);
    setTimeout(() => {
      setFlatIndex(newIndex);
      setIsAnimating(false);
    }, 180);
  };

  const handleNext = () => {
    if (isVeryLast) {
      onComplete();
      onClose();
      return;
    }
    goTo(flatIndex + 1);
  };

  const handlePrev = () => goTo(flatIndex - 1);

  const jumpToChapter = (ci: number) => {
    const firstFlat = flatSteps.findIndex((s) => s.chapterIndex === ci);
    if (firstFlat >= 0) goTo(firstFlat);
    setShowChapterNav(false);
  };

  const handleClose = () => onClose();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
      style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600&family=Inter:wght@400;500&display=swap"
        rel="stylesheet"
      />

      {/* Backdrop */}
      <div
        className="fixed inset-0 backdrop-blur-sm transition-opacity animate-fade-in"
        style={{ background: "rgba(46,46,42,0.55)" }}
        onClick={handleClose}
      />

      {/* Modal container */}
      <div
        className="relative w-full max-w-4xl overflow-hidden animate-slide-up flex flex-col"
        style={{
          background: brand.cream,
          borderRadius: 28,
          boxShadow: "0 24px 60px -20px rgba(58,95,69,0.45)",
          maxHeight: "92vh",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between gap-3 p-4 sm:p-5"
          style={{ background: brand.cardWhite, borderBottom: `1px solid ${brand.border}` }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setShowChapterNav((v) => !v)}
              className="md:hidden flex h-9 w-9 shrink-0 items-center justify-center transition active:scale-95"
              style={{ background: brand.cream, border: `1px solid ${brand.border}`, borderRadius: 14, color: brand.greenDark }}
              title="Hoofdstukken"
            >
              <Menu className="h-4.5 w-4.5" />
            </button>
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center"
              style={{ background: brand.green, borderRadius: 14, color: "#fff" }}
            >
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2
                className="font-semibold truncate"
                style={{ fontFamily: "Poppins, sans-serif", color: brand.text, fontSize: 17 }}
              >
                Volledige handleiding — Het Verband Ternat
              </h2>
              <p className="text-xs truncate" style={{ color: brand.textSoft }}>
                {currentChapter.label} · Stap {stepIndex + 1} van {currentChapter.steps.length}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center transition active:scale-95"
            style={{ borderRadius: 14, color: brand.textSoft }}
            onMouseEnter={(e) => (e.currentTarget.style.background = brand.cream)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            title="Sluiten"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body: chapter nav + content */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Chapter sidebar (desktop) */}
          <nav
            className="hidden md:flex md:w-56 shrink-0 flex-col gap-1 p-3 overflow-y-auto"
            style={{ borderRight: `1px solid ${brand.border}` }}
          >
            {chapters.map((ch, ci) => {
              const Icon = ch.icon;
              const isActiveChapter = ci === chapterIndex;
              return (
                <button
                  key={ch.id}
                  onClick={() => jumpToChapter(ci)}
                  className="flex items-center gap-2.5 px-3 py-2.5 text-left text-sm font-semibold transition"
                  style={{
                    borderRadius: 14,
                    background: isActiveChapter ? "#EAF2EC" : "transparent",
                    color: isActiveChapter ? brand.greenDark : brand.textSoft,
                  }}
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center"
                    style={{
                      borderRadius: 10,
                      background: isActiveChapter ? brand.green : brand.cream,
                      color: isActiveChapter ? "#fff" : brand.textSoft,
                    }}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="truncate flex-1">{ch.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Mobile chapter drawer */}
          {showChapterNav && (
            <div
              className="md:hidden absolute inset-0 z-10 flex flex-col p-3 gap-1 overflow-y-auto"
              style={{ background: brand.cream }}
            >
              {chapters.map((ch, ci) => {
                const Icon = ch.icon;
                const isActiveChapter = ci === chapterIndex;
                return (
                  <button
                    key={ch.id}
                    onClick={() => jumpToChapter(ci)}
                    className="flex items-center gap-2.5 px-3 py-3 text-left text-sm font-semibold transition"
                    style={{
                      borderRadius: 14,
                      background: isActiveChapter ? "#EAF2EC" : brand.cardWhite,
                      border: `1px solid ${brand.border}`,
                      color: isActiveChapter ? brand.greenDark : brand.text,
                    }}
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center"
                      style={{
                        borderRadius: 10,
                        background: isActiveChapter ? brand.green : brand.cream,
                        color: isActiveChapter ? "#fff" : brand.textSoft,
                      }}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="flex-1">{ch.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Step content */}
          <div className="flex-1 min-w-0 overflow-y-auto p-5 sm:p-7">
            <div
              className={`transition-all duration-200 ${
                isAnimating ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"
              }`}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* Text column */}
                <div className={currentStep.shot ? "" : "md:col-span-2"}>
                  <h3
                    className="font-semibold mb-3"
                    style={{ fontFamily: "Poppins, sans-serif", color: brand.greenDark, fontSize: 22 }}
                  >
                    {currentStep.title}
                  </h3>
                  <div className="text-[14.5px] leading-relaxed" style={{ color: brand.text }}>
                    {currentStep.body}
                  </div>

                  {currentStep.tip && (
                    <div
                      className="mt-4 p-3.5 text-sm"
                      style={{
                        background: "#FBF0EC",
                        border: `1px solid ${brand.border}`,
                        borderRadius: 16,
                        color: brand.coralDark,
                      }}
                    >
                      💡 {currentStep.tip}
                    </div>
                  )}
                </div>

                {/* Screenshot column */}
                {currentStep.shot && <div className="md:pt-1">{currentStep.shot}</div>}
              </div>
            </div>

            {/* Step dots within chapter */}
            <div className="mt-8 flex items-center gap-1.5">
              {currentChapter.steps.map((s, si) => {
                const globalIndexOfThisStep = flatSteps.findIndex(
                  (f) => f.chapterIndex === chapterIndex && f.stepIndex === si
                );
                const isDone = globalIndexOfThisStep <= flatIndex;
                return (
                  <button
                    key={s.id}
                    onClick={() => goTo(globalIndexOfThisStep)}
                    className="h-1.5 flex-1 rounded-full transition-all duration-200"
                    style={{ background: isDone ? brand.green : brand.border, maxWidth: 60 }}
                    title={s.title}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="p-4 sm:p-5 flex flex-col gap-3"
          style={{ background: brand.cardWhite, borderTop: `1px solid ${brand.border}` }}
        >
          {/* Overall progress bar */}
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: brand.border }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${overallProgress}%`, background: brand.green }}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              onClick={handlePrev}
              disabled={flatIndex === 0}
              className="flex items-center gap-1.5 px-4 py-2.5 font-semibold text-sm transition disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
              style={{
                borderRadius: 30,
                border: `1.5px solid ${brand.green}`,
                color: brand.greenDark,
                background: "transparent",
              }}
            >
              <ChevronLeft className="h-4 w-4" />
              Terug
            </button>

            <span className="text-xs font-semibold hidden sm:inline" style={{ color: brand.textSoft }}>
              Stap {flatIndex + 1} van {totalFlatSteps}
            </span>

            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 px-6 py-2.5 font-semibold text-sm text-white transition active:scale-95"
              style={{ borderRadius: 30, background: brand.green }}
            >
              {isVeryLast ? (
                <>
                  <Check className="h-4 w-4" />
                  Afronden
                </>
              ) : (
                <>
                  Volgende
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
