// Turns the brand colours saved under Website settings into the CSS variables
// the Tailwind theme (globals.css) reads. Every shade of a colour is derived
// from it, so containers, hovers and tints follow the chosen colour instead of
// staying on the defaults. The default colours return no overrides at all, so
// the hand-tuned palette in globals.css stays exactly as designed.

const DEFAULT_PRIMARY = "#7a1f2b";
const DEFAULT_SECONDARY = "#9a6700";
const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];

function parseHex(value) {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(value || "").trim());
  if (!match) return null;
  const hex = match[1].length === 3 ? match[1].replace(/./g, "$&$&") : match[1];
  return [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16));
}

const toHex = (rgb) => `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;

// amount 0 keeps the colour, 1 gives the target.
const mix = (rgb, target, amount) => toHex(rgb.map((channel, index) => channel + (target[index] - channel) * amount));

// Text colour that stays readable on top of the given colour.
function readableOn(rgb) {
  const [r, g, b] = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#1a1c1b" : "#ffffff";
}

function primaryVariables(rgb) {
  return {
    "--color-primary": toHex(rgb),
    "--color-on-primary": readableOn(rgb),
    "--color-primary-container": mix(rgb, WHITE, 0.15),
    "--color-on-primary-container": mix(rgb, WHITE, 0.9),
    "--color-primary-fixed": mix(rgb, WHITE, 0.85),
    "--color-primary-fixed-dim": mix(rgb, WHITE, 0.65),
    "--color-on-primary-fixed": mix(rgb, BLACK, 0.6),
    "--color-on-primary-fixed-variant": mix(rgb, BLACK, 0.18),
    "--color-inverse-primary": mix(rgb, WHITE, 0.65),
  };
}

function secondaryVariables(rgb) {
  return {
    "--color-secondary": toHex(rgb),
    "--color-on-secondary": readableOn(rgb),
    "--color-secondary-container": mix(rgb, WHITE, 0.25),
    "--color-on-secondary-container": mix(rgb, BLACK, 0.72),
    "--color-secondary-fixed": mix(rgb, WHITE, 0.78),
    "--color-secondary-fixed-dim": mix(rgb, WHITE, 0.5),
    "--color-on-secondary-fixed": mix(rgb, BLACK, 0.72),
    "--color-on-secondary-fixed-variant": mix(rgb, BLACK, 0.32),
  };
}

// Inline style object for <html>, e.g. <html style={siteThemeStyle(site)}>.
export function siteThemeStyle(site) {
  const style = {};
  const primary = parseHex(site?.primary_color);
  const secondary = parseHex(site?.secondary_color);
  if (primary && toHex(primary) !== DEFAULT_PRIMARY) Object.assign(style, primaryVariables(primary));
  if (secondary && toHex(secondary) !== DEFAULT_SECONDARY) Object.assign(style, secondaryVariables(secondary));
  return style;
}

// Applies a site's colours to an element that is already on screen (used
// right after the colours are saved, so no reload is needed).
export function applySiteTheme(element, site) {
  if (!element) return;
  const style = siteThemeStyle(site);
  const allNames = Object.keys({ ...primaryVariables(WHITE), ...secondaryVariables(WHITE) });
  for (const name of allNames) {
    if (style[name]) element.style.setProperty(name, style[name]);
    else element.style.removeProperty(name);
  }
}
