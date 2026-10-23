// Adapted from the designer's TODOPOP-desktop prototype, app/index.html.
export const designerPresets = [
  [222, 0.72],
  [350, 0.7],
  [178, 0.9],
  [95, 0.55],
  [268, 0.55],
  [24, 0.85],
  [0, 0],
] as const;
export const rgbHex = (v: number[]) =>
  '#' +
  v
    .map((x) =>
      Math.round(Math.max(0, Math.min(255, x)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
export function hslRgb(h: number, s: number, l: number) {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
}
export const inkLightness = (h: number, s: number) =>
  s < 0.08 ? 0.16 : 0.36 - 0.14 * Math.max(0, 1 - Math.abs(h - 140) / 80);
export const designerInk = (h: number, s: number) => rgbHex(hslRgb(h, s, inkLightness(h, s)));
export function hexHsl(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255),
    max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min,
    l = (max + min) / 2;
  return {
    h: d
      ? ((max === r ? (g - b) / d : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60 + 360) % 360
      : 0,
    s: d ? d / (1 - Math.abs(2 * l - 1)) : 0,
  };
}
export function oklchRgb(L: number, C: number, h: number) {
  const a = C * Math.cos((h * Math.PI) / 180),
    b = C * Math.sin((h * Math.PI) / 180),
    l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3,
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3,
    s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055));
}
export function okHue(hex: string) {
  const lin = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)),
    l = Math.cbrt(0.4122214708 * lin[0] + 0.5363325363 * lin[1] + 0.0514459929 * lin[2]),
    m = Math.cbrt(0.2119034982 * lin[0] + 0.6806995451 * lin[1] + 0.1073969566 * lin[2]),
    s = Math.cbrt(0.0883024619 * lin[0] + 0.2817188376 * lin[1] + 0.6299787005 * lin[2]);
  return (
    ((Math.atan2(
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    ) *
      180) /
      Math.PI +
      360) %
    360
  );
}
const gamut = (v: number[]) => v.every((x) => x >= -0.0005 && x <= 1.0005),
  cusps = new Map<number, { L: number; C: number }>(),
  colors = new Map<string, string>();
export function hueCusp(h: number) {
  h = ((Math.round(h) % 360) + 360) % 360;
  if (cusps.has(h)) return cusps.get(h)!;
  let best = { L: 0.76, C: 0 };
  for (let L = 0.42; L <= 0.96; L += 0.01) {
    let lo = 0,
      hi = 0.42;
    for (let i = 0; i < 16; i++) {
      const mid = (lo + hi) / 2;
      if (gamut(oklchRgb(L, mid, h))) lo = mid;
      else hi = mid;
    }
    if (lo > best.C) best = { L, C: lo };
  }
  cusps.set(h, best);
  return best;
}
export function vividColor(h: number, t: number) {
  h = ((Math.round(h) % 360) + 360) % 360;
  t = Math.max(0, Math.min(1, Math.round(t * 100) / 100));
  const key = h + '|' + t;
  if (colors.has(key)) return colors.get(key)!;
  const c = hueCusp(h),
    L = 0.76 + (c.L - 0.76) * t;
  let C = c.C * t,
    v = oklchRgb(L, C, h);
  while (!gamut(v) && C > 0) {
    C -= 0.003;
    v = oklchRgb(L, Math.max(0, C), h);
  }
  const hex = rgbHex(v.map((x) => x * 255));
  colors.set(key, hex);
  return hex;
}
export function slotColor(slot: number, tint: string) {
  const h = (okHue(tint) + 40 + slot * 56) % 360;
  let v: number[] = [];
  for (let C = 0.15; C >= -0.001; C -= 0.004) {
    v = oklchRgb(0.76, Math.max(0, C), h);
    if (v.every((x) => x >= -0.001 && x <= 1.001)) break;
  }
  return rgbHex(v.map((x) => x * 255));
}
export const slotHue = (slot: number, tint: string) => (okHue(tint) + 40 + slot * 56) % 360;
export const defaultWheelSat = (h: number) => Math.min(1, 0.15 / Math.max(0.01, hueCusp(h).C));
