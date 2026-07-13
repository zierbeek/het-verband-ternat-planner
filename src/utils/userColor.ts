const USER_COLOR_PALETTE = [
  "#2563eb",
  "#0f766e",
  "#7c3aed",
  "#be185d",
  "#ea580c",
  "#059669",
  "#dc2626",
  "#1d4ed8",
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