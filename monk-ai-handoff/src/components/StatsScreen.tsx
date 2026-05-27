import { useEffect, useState } from 'react';
import { AppState, leaderboard } from '../store';

interface Props { state: AppState; }

const ranks = [
  { min: 90, label: 'Monk Elite', color: 'var(--accent)', emoji: '🏛️' },
  { min: 75, label: 'Iron Discipline', color: 'var(--accent2)', emoji: '⚡' },
  { min: 60, label: 'Rising Force', color: 'var(--teal)', emoji: '🌊' },
  { min: 40, label: 'Building Blocks', color: 'var(--gold)', emoji: '🧱' },
  { min: 0, label: 'Starting Out', color: 'var(--muted)', emoji: '🌱' },
];

function getRank(score: number) {
  return ranks.find(r => score >= r.min) || ranks[ranks.length - 1];
}

export default function StatsScreen({ state }: Props) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  const rank = getRank(state.dopamineScore);
  const weekTotal = state.weekData.reduce((s, d) => s + d.completed, 0);
  const weekMax = state.weekData.reduce((s, d) => s + d.total, 0);
  const weekPct = Math.round((weekTotal / weekMax) * 100);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <h1 className="text-2xl font-black" style={{ color: 'var(--text)', letterSpacing: '-0.5px' }}>Stats</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Week of {
          new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        }</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {/* Dopamine Score */}
        <div
          className="rounded-2xl p-5 text-center animate-fade-up"
          style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}
        >
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)', fontSize: 10 }}>
            Dopamine Score
          </p>
          <div
            className="text-7xl font-black font-mono leading-none mb-2"
            style={{ color: rank.color, letterSpacing: '-3px' }}
          >
            {state.dopamineScore}
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>+6 from last week · top 12% globally</p>
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold"
            style={{ background: `${rank.color}18`, color: rank.color, border: `1px solid ${rank.color}40` }}
          >
            <span>{rank.emoji}</span>
            <span>{rank.label}</span>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-3 animate-fade-up delay-100">
          {[
            { label: 'Habits this week', val: `${weekTotal}/${weekMax}`, color: 'var(--accent)' },
            { label: 'Completion rate', val: `${weekPct}%`, color: 'var(--teal)' },
            { label: 'Current streak', val: `${state.streak}d`, color: 'var(--gold)' },
            { label: 'Perfect days', val: `${state.weekData.filter(d => d.completed === d.total).length}/7`, color: 'var(--accent2)' },
          ].map(s => (
            <div
              key={s.label}
              className="rounded-2xl p-4"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}
            >
              <div className="text-2xl font-black font-mono" style={{ color: s.color }}>{s.val}</div>
              <div className="text-xs mt-1 font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)', fontSize: 9 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Week chart */}
        <div
          className="rounded-2xl p-4 animate-fade-up delay-200"
          style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}
        >
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--muted)', fontSize: 10 }}>
            This Week
          </p>
          <div className="flex items-end gap-2" style={{ height: 90 }}>
            {state.weekData.map((d, i) => {
              const isToday = i === new Date().getDay() - 1 || (new Date().getDay() === 0 && i === 6);
              const pct = d.score / 100;
              return (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-2">
                  <div
                    className="w-full rounded-lg overflow-hidden flex items-end"
                    style={{ height: 70, background: 'var(--bg4)' }}
                  >
                    <div
                      className="w-full rounded-lg bar-animate"
                      style={{
                        height: `${Math.max(8, pct * 100)}%`,
                        background: isToday ? 'var(--accent)' : pct === 1 ? 'var(--accent2)' : 'var(--bg3)',
                        border: `1px solid ${isToday ? 'var(--accent)' : pct === 1 ? 'var(--accent2)' : 'var(--border2)'}`,
                        animationDelay: `${i * 0.08}s`,
                        opacity: animated ? 1 : 0,
                        transition: 'opacity 0.3s',
                      }}
                    />
                  </div>
                  <span
                    className="text-xs font-mono"
                    style={{
                      color: isToday ? 'var(--accent)' : 'var(--muted)',
                      fontSize: 9,
                      fontWeight: isToday ? 700 : 400,
                    }}
                  >
                    {d.day}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Leaderboard */}
        <div
          className="rounded-2xl overflow-hidden animate-fade-up delay-300"
          style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}
        >
          <div
            className="px-4 py-3"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--muted)', fontSize: 10 }}>
              🏆 Consistency Ranking · This Week
            </p>
          </div>
          {leaderboard.map((entry, i) => (
            <div
              key={entry.rank}
              className="flex items-center gap-3 px-4 py-3 transition-all animate-fade-up"
              style={{
                borderBottom: i < leaderboard.length - 1 ? '1px solid var(--border)' : 'none',
                background: entry.isYou ? 'rgba(184,240,88,0.04)' : 'transparent',
                animationDelay: `${0.3 + i * 0.06}s`,
              }}
            >
              <div
                className="font-mono font-bold text-sm w-5 text-center"
                style={{ color: i < 3 ? 'var(--gold)' : 'var(--muted)' }}
              >
                {entry.rank}
              </div>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                style={{ background: `${entry.color}20`, color: entry.color }}
              >
                {entry.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="font-bold text-sm"
                  style={{ color: entry.isYou ? 'var(--accent)' : 'var(--text)' }}
                >
                  {entry.name} {entry.isYou && '← you'}
                </div>
              </div>
              <div className="font-mono text-xs" style={{ color: 'var(--gold)' }}>🔥 {entry.streak}d</div>
              <div className="font-mono font-bold text-sm" style={{ color: 'var(--accent)' }}>{entry.score}</div>
            </div>
          ))}
        </div>

        {/* Rank progression */}
        <div
          className="rounded-2xl p-4 animate-fade-up delay-400"
          style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}
        >
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)', fontSize: 10 }}>
            Rank Progression
          </p>
          <div className="flex flex-col gap-2">
            {ranks.map((r, i) => (
              <div key={r.label} className="flex items-center gap-3">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                  style={{
                    background: state.dopamineScore >= r.min ? `${r.color}25` : 'var(--bg4)',
                    border: `1px solid ${state.dopamineScore >= r.min ? r.color : 'var(--border)'}`,
                  }}
                >
                  {state.dopamineScore >= r.min ? '✓' : '○'}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold" style={{ color: state.dopamineScore >= r.min ? r.color : 'var(--muted)' }}>
                      {r.emoji} {r.label}
                    </span>
                    <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>{r.min}+</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
