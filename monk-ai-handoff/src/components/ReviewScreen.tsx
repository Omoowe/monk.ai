import { useState } from 'react';
import { AppState, personalities } from '../store';
import { generateWeeklyReview, buildCoachContext } from '../ai';

interface Props { state: AppState; }

export default function ReviewScreen({ state }: Props) {
  const [review, setReview] = useState('');
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const pConfig = personalities[state.personality];

  const weekTotal = state.weekData.reduce((s, d) => s + d.completed, 0);
  const weekMax = state.weekData.reduce((s, d) => s + d.total, 0);
  const weekPct = Math.round((weekTotal / weekMax) * 100);
  const perfectDays = state.weekData.filter(d => d.completed === d.total).length;

  const generate = async () => {
    setLoading(true);
    const ctx = buildCoachContext(state.userName, state.streak, state.dopamineScore, state.habits, state.goals, state.checkIns, state.identityStatement);
    try {
      const r = await generateWeeklyReview(state.personality, ctx, weekTotal, weekMax, state.checkIns);
      setReview(r);
      setGenerated(true);
    } catch {
      setReview(`${state.userName}: ${weekTotal}/${weekMax} habits this week — ${weekPct}%. ${perfectDays} perfect days. Streak: ${state.streak}. The data doesn't lie. Next week, close the gap.`);
      setGenerated(true);
    } finally { setLoading(false); }
  };

  const highlights = [
    { label: 'Habits', val: `${weekTotal}/${weekMax}`, color: 'var(--accent)' },
    { label: 'Rate', val: `${weekPct}%`, color: 'var(--teal)' },
    { label: 'Perfect days', val: `${perfectDays}/7`, color: pConfig.color },
    { label: 'Score Δ', val: '+6', color: 'var(--gold)' },
  ];

  const bestHabit = [...state.habits].sort((a, b) => b.streakDays - a.streakDays)[0];
  const weakestHabit = state.habits.find(h => !h.completedToday);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--muted)', fontSize: 10 }}>Weekly Review</div>
        <h1 className="text-2xl font-black" style={{ color: 'var(--text)', letterSpacing: '-0.5px' }}>
          {weekPct >= 80 ? '🔥 Strong week.' : weekPct >= 60 ? '⚠️ Room to grow.' : '❌ Face the truth.'}
        </h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>May 10–16, 2026</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 animate-fade-up">
          {highlights.map(h => (
            <div key={h.label} className="rounded-2xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <div className="text-2xl font-black font-mono" style={{ color: h.color }}>{h.val}</div>
              <div className="text-xs mt-1 font-bold uppercase tracking-wider" style={{ color: 'var(--muted)', fontSize: 9 }}>{h.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 animate-fade-up delay-100">
          {bestHabit && (
            <div className="rounded-2xl p-4" style={{ background: 'rgba(184,240,88,0.07)', border: '1px solid rgba(184,240,88,0.2)' }}>
              <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--accent)', fontSize: 9 }}>🏆 Best Habit</div>
              <div className="text-xl">{bestHabit.emoji}</div>
              <div className="font-bold text-sm mt-1 leading-tight" style={{ color: 'var(--text)' }}>{bestHabit.name}</div>
              <div className="font-mono text-xs mt-0.5" style={{ color: 'var(--accent)' }}>🔥 {bestHabit.streakDays}d</div>
            </div>
          )}
          {weakestHabit && (
            <div className="rounded-2xl p-4" style={{ background: 'rgba(240,96,96,0.07)', border: '1px solid rgba(240,96,96,0.2)' }}>
              <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--accent3)', fontSize: 9 }}>⚠️ Needs Work</div>
              <div className="text-xl">{weakestHabit.emoji}</div>
              <div className="font-bold text-sm mt-1 leading-tight" style={{ color: 'var(--text)' }}>{weakestHabit.name}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Slipping</div>
            </div>
          )}
        </div>

        <div className="rounded-2xl p-4 animate-fade-up delay-200" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)', fontSize: 10 }}>Goal Progress</div>
          <div className="flex flex-col gap-3">
            {state.goals.map(g => {
              const days = Math.floor((Date.now() - new Date(g.madeAt).getTime()) / 86400000);
              const stalled = g.progress < 30 && days > 14;
              return (
                <div key={g.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold truncate flex-1 pr-2" style={{ color: stalled ? 'var(--accent3)' : 'var(--text)' }}>
                      {stalled ? '⚠️ ' : ''}{g.name}
                    </span>
                    <span className="font-mono text-xs" style={{ color: 'var(--accent2)' }}>{g.progress}%</span>
                  </div>
                  <div className="rounded-full overflow-hidden mb-0.5" style={{ height: 4, background: 'var(--bg4)' }}>
                    <div className="h-full rounded-full" style={{ width: `${g.progress}%`, background: stalled ? 'var(--accent3)' : 'var(--accent2)' }} />
                  </div>
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>
                    {stalled ? `Stalled — promised ${days} days ago` : `Promised ${days} days ago · ${g.deadline}`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl p-4 animate-fade-up delay-300" style={{ background: 'var(--bg2)', border: `1px solid ${pConfig.color}25` }}>
          <div className="flex items-center gap-2 mb-3">
            <span>{pConfig.emoji}</span>
            <div className="text-xs font-bold uppercase tracking-widest" style={{ color: pConfig.color, fontSize: 10 }}>
              {pConfig.name} Analysis
            </div>
          </div>

          {!generated && !loading && (
            <div className="text-center py-4">
              <p className="text-sm mb-1 font-semibold" style={{ color: 'var(--text)' }}>Your coach has been watching.</p>
              <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>The review references your specific missions, failures, and stalled goals.</p>
              <button onClick={generate} className="px-6 py-3 rounded-xl font-black text-sm"
                style={{ background: pConfig.color, color: '#000', border: 'none', cursor: 'pointer' }}>
                Get the truth →
              </button>
            </div>
          )}

          {loading && (
            <div className="py-6 flex flex-col items-center gap-3" style={{ color: 'var(--muted)' }}>
              <div className="flex gap-2"><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /></div>
              <p className="text-xs">{pConfig.name} is reviewing your data...</p>
            </div>
          )}

          {generated && review && (
            <div className="animate-fade-in">
              <div className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}
                dangerouslySetInnerHTML={{ __html: review.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} />
              <button onClick={() => { setGenerated(false); setReview(''); }}
                className="mt-4 px-4 py-2 rounded-xl text-xs font-bold"
                style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer' }}>
                ↺ Regenerate
              </button>
            </div>
          )}
        </div>

        <div className="rounded-2xl p-4 animate-fade-up delay-400" style={{ background: 'var(--bg3)', border: '1px solid var(--border2)' }}>
          <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: pConfig.color, fontSize: 10 }}>🎯 Next Week's Non-Negotiable</div>
          <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>One habit, one mission. What will you protect at all costs?</p>
          <textarea placeholder="I will not miss..." rows={2} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
            style={{ background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'var(--font)' }} />
        </div>
      </div>
    </div>
  );
}
