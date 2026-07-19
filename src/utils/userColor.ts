// Palet voor medewerker-identificatie op het rooster: elke persoon krijgt een
// consistente kleur op basis van hun ID. Afgestemd op de stijlgids van Het
// Verband Ternat (warme, gedempte tinten rond het logo-groen/koraal/sage in
// plaats van felle, generieke webkleuren), terwijl de tinten onderling nog
// voldoende verschillen om personen op het rooster te kunnen onderscheiden.
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

const hexToRgb = (hex: string) => {
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

const stringHash = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = value.charCodeAt(index) + ((hash << 5) - hash);
    hash |= 0;
  }
  return Math.abs(hash);
};

export const getUserColor = (userId?: string | null) => {
  if (!userId) return USER_COLOR_PALETTE[0];
  return USER_COLOR_PALETTE[stringHash(userId) % USER_COLOR_PALETTE.length];
};

export const getUserColorStyle = (userId?: string | null, alpha = 0.14) => {
  const color = getUserColor(userId);
  const { r, g, b } = hexToRgb(color);

  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, ${alpha})`,
    borderColor: `rgba(${r}, ${g}, ${b}, ${Math.min(alpha + 0.2, 0.85)})`,
    color,
  };
};