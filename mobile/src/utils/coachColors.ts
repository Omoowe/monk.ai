export const COACH_COLORS: Record<string, string> = {
  drill_sergeant: '#f06060',
  stoic_mentor:   '#b8f058',
  anime_sensei:   '#7b6af0',
  goggins:        '#f5c840',
  ceo_coach:      '#40f5c8',
  calm_therapist: '#f0a060',
};

export function getCoachColor(personality: string | undefined): string {
  return COACH_COLORS[personality ?? ''] ?? '#b8f058';
}

/** Returns '#0a0a0a' or '#fff' for readable text on a given hex background. */
export function getContrastText(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#0a0a0a' : '#fff';
}
