// Design system tokens — single source of truth for all non-coach colors.
// Screens import { C } from '../utils/colors';

export const C = {
  // ── Surfaces ─────────────────────────────────────────────────────────────
  bg:       '#080808',   // root page bg
  s1:       '#111111',   // primary card / panel
  s2:       '#181818',   // nested surface within a card
  s3:       '#222222',   // pressed / secondary input bg
  border:   '#1e1e1e',   // dividers, card outlines
  subtle:   '#252525',   // faint borders, secondary strokes
  lift:     '#2a2a2a',   // stepper buttons, elevated press

  // ── Text ─────────────────────────────────────────────────────────────────
  t1:       '#ffffff',   // primary headlines
  t2:       '#aaaaaa',   // body / secondary
  t3:       '#666666',   // tertiary labels
  t4:       '#444444',   // placeholder / muted
  t5:       '#333333',   // faintest visible text

  // ── Brand accent (lime) ───────────────────────────────────────────────────
  accent:   '#b8f058',
  a60:      '#b8f05899', // strong glow / border emphasis
  a40:      '#b8f05866', // border tint
  a20:      '#b8f05833', // selection bg wash
  a10:      '#b8f0581a', // very faint wash
  accentDim:  '#3a5a12', // filled progress / done indicator
  accentDeep: '#0d1a07', // deepest tinted card surface (selected/done rows)

  // ── Error / destructive ───────────────────────────────────────────────────
  error:    '#f06060',
  errorBg:  '#1a0808',   // error card surface / danger zone
  errorBd:  '#f0606033', // error border

  // ── Semantic tinted surfaces ───────────────────────────────────────────────
  greenSurface: '#0d1a07',   // deep: habit done, active preset, selected card
  greenWash:    '#b8f0581a', // faint: chip selected, row active
  redSurface:   '#1a0808',   // monk mode danger, error bubbles
  blueSurface:  '#0d1a2a',   // streak freeze card bg
  blueBorder:   '#1a3a5a',   // streak freeze card border
} as const;
