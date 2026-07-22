// Palet voor medewerker-identificatie op het rooster: elke persoon krijgt een
// consistente kleur op basis van hun Employee-id. Afgestemd op de stijlgids
// van Het Verband Ternat (warme, gedempte tinten rond het logo-groen/koraal/
// sage in plaats van felle, generieke webkleuren), terwijl de tinten onderling
// nog voldoende verschillen om personen op het rooster te kunnen onderscheiden.
const USER_COLOR_PALETTE = [
  "#4F8963", // logo-groen
  "#C85F44", // koraal donker
  "#7CA789", // sage
  "#B8894F", // warm okergoud
  "#5F8AA6", // gedempt blauwgrijs
  "#8C6E9C", // gedempt aubergine
  "#3A5F45", // donker leigroen
  "#A65B7A", // gedempte bes
];

export const hexToRgb = (hex: string) => {
  const normalized = hex.replace("#", "");
  const fullHex = normalized.length === 3
    ? normalized.split("").map((char) => char + char).join("")
    : normalized;

  const value = Number.parseInt(fullHex, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
};

const rgbToHsl = (r: number, g: number, b: number) => {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
};

const hslToHex = (h: number, s: number, l: number) => {
  const sn = s / 100, ln = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) => ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
};

/**
 * Preset- en shift-kleuren worden door de admin vrij gekozen via een gewone
 * kleurenkiezer en zo (als volledig verzadigde hex) opgeslagen - in
 * tegenstelling tot het vaste medewerkerspalet hierboven passen ze zich niet
 * vanzelf aan het thema aan. Een verzadigde kleur die op een wit vlak een
 * zachte, gedempte tint geeft, oogt op een donker kaartje al snel te fel/hard,
 * omdat diezelfde kleur veel minder "verdund" wordt door een lichte
 * ondergrond. Deze functie geeft, enkel voor donkere modus, dezelfde tint
 * terug maar dan lichter en iets minder verzadigd (zelfde tint/hue, dus nog
 * steeds herkenbaar als "die kleur"); in lichte modus blijft de kleur exact
 * zoals opgeslagen.
 */
export const getDisplayColor = (hex: string, isDarkMode: boolean) => {
  if (!isDarkMode) return hex;
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  return hslToHex(h, Math.min(s, 55), Math.max(l, 62));
};

/**
 * Combinatie van een tint-achtergrond en dezelfde kleur als linkerrand, zoals
 * gebruikt voor de shift-blokjes in de maandweergave. Gebruikt intern telkens
 * de dark-mode-aangepaste kleur (zie `getDisplayColor`) zodat het blokje in
 * donkere modus niet te fel oogt.
 */
export const getPresetTintStyle = (hex: string, isDarkMode: boolean, alpha = 0.16) => {
  const displayColor = getDisplayColor(hex, isDarkMode);
  const { r, g, b } = hexToRgb(displayColor);
  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, ${isDarkMode ? alpha + 0.08 : alpha})`,
    borderLeftColor: displayColor,
  };
};

const stringHash = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = value.charCodeAt(index) + ((hash << 5) - hash);
    hash |= 0;
  }
  return Math.abs(hash);
};

/**
 * Geeft de vaste kleur van een medewerker terug, gebaseerd op een hash van
 * het meegegeven id.
 *
 * BELANGRIJK — geef hier altijd het `Employee.id` door, nooit het `User.id`.
 * Dit zijn in het datamodel twee losstaande UUID's voor dezelfde persoon
 * (een `User`-account heeft een gekoppeld maar apart `Employee`-record). Omdat
 * de kleur op basis van de string-waarde van het id wordt berekend, geeft een
 * verkeerd id-type een andere (inconsistente) kleur voor dezelfde persoon,
 * ook al is het conceptueel "dezelfde" gebruiker. Elke plek in de app die een
 * medewerkerkleur toont, moet dus `employee.id` gebruiken — bijvoorbeeld via
 * `user.employee.id` wanneer je uitgaat van het ingelogde account.
 */
export const getUserColor = (employeeId?: string | null) => {
  if (!employeeId) return USER_COLOR_PALETTE[0];
  return USER_COLOR_PALETTE[stringHash(employeeId) % USER_COLOR_PALETTE.length];
};

/** Zie de waarschuwing bij `getUserColor`: geef hier altijd `employee.id` door. */
export const getUserColorStyle = (employeeId?: string | null, alpha = 0.14) => {
  const color = getUserColor(employeeId);
  const { r, g, b } = hexToRgb(color);

  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, ${alpha})`,
    borderColor: `rgba(${r}, ${g}, ${b}, ${Math.min(alpha + 0.2, 0.85)})`,
    color,
  };
};