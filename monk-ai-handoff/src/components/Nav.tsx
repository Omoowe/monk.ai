import { Screen } from '../store';

interface Props {
  current: Screen;
  onChange: (s: Screen) => void;
  morningDone: boolean;
  eveningDone: boolean;
  safeAreaBottom: string;
}

const tabs: { id: Screen; emoji: string; label: string }[] = [
  { id: 'coach',   emoji: '🤖', label: 'Coach' },
  { id: 'checkin', emoji: '📋', label: 'Check-In' },
  { id: 'goals',   emoji: '🎯', label: 'Goals' },
  { id: 'stats',   emoji: '📊', label: 'Stats' },
  { id: 'review',  emoji: '🏅', label: 'Review' },
];

export default function Nav({ current, onChange, morningDone, eveningDone, safeAreaBottom }: Props) {
  const bothDone = morningDone && eveningDone;
  const neitherDone = !morningDone && !eveningDone;

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-around',
      padding: `8px 4px`,
      paddingBottom: `calc(8px + ${safeAreaBottom})`,
      borderTop: '1px solid var(--border)',
      background: 'var(--bg2)',
      flexShrink: 0,
    }}>
      {tabs.map(tab => {
        const active = current === tab.id;
        const isCheckin = tab.id === 'checkin';
        const showDot = isCheckin && !bothDone;

        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              padding: '6px 12px', borderRadius: 12,
              background: active ? 'rgba(255,255,255,0.06)' : 'transparent',
              border: 'none', cursor: 'pointer',
              minWidth: 52, minHeight: 52,
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <span style={{ fontSize: active ? 21 : 19, lineHeight: 1 }}>{tab.emoji}</span>
            {showDot && (
              <div style={{
                position: 'absolute', top: 4, right: 8,
                width: 8, height: 8, borderRadius: '50%',
                background: neitherDone ? '#f06060' : '#f5c840',
                border: '1.5px solid var(--bg2)',
              }} />
            )}
            <span style={{
              fontSize: 9, fontWeight: 700,
              color: active ? 'var(--accent)' : 'var(--muted)',
              textTransform: 'uppercase', letterSpacing: '0.5px',
              lineHeight: 1,
            }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
