import { useState } from 'react';
import { AppState, Goal } from '../store';
import { getGoalAdvice, buildCoachContext } from '../ai';

interface Props {
  state: AppState;
  setState: (fn: (s: AppState) => AppState) => void;
}

const catColors: Record<Goal['category'], string> = {
  health: 'var(--accent)', business: 'var(--accent2)', mindset: 'var(--accent3)',
  finance: 'var(--gold)', relationships: 'var(--teal)',
};
const catBg: Record<Goal['category'], string> = {
  health: 'rgba(184,240,88,0.1)', business: 'rgba(123,106,240,0.1)', mindset: 'rgba(240,96,96,0.1)',
  finance: 'rgba(245,200,64,0.1)', relationships: 'rgba(64,245,200,0.1)',
};

export default function GoalsScreen({ state, setState }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [newCat, setNewCat] = useState<Goal['category']>('health');
  const [adviceGoalId, setAdviceGoalId] = useState<string | null>(null);
  const [advice, setAdvice] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const addGoal = () => {
    if (!newName.trim()) return;
    const goal: Goal = {
      id: Date.now().toString(), name: newName.trim(), category: newCat,
      progress: 0, target: newTarget || 'Complete the goal',
      deadline: newDeadline || 'No deadline', madeAt: new Date().toISOString(),
    };
    setState(s => ({ ...s, goals: [...s.goals, goal] }));
    setNewName(''); setNewTarget(''); setNewDeadline(''); setShowAdd(false);
  };

  const updateProgress = (id: string, delta: number) => {
    setState(s => ({ ...s, goals: s.goals.map(g => g.id === id ? { ...g, progress: Math.max(0, Math.min(100, g.progress + delta)) } : g) }));
  };

  const fetchAdvice = async (goal: Goal) => {
    if (advice[goal.id]) { setAdviceGoalId(goal.id); return; }
    setLoadingId(goal.id);
    setAdviceGoalId(goal.id);
    const ctx = buildCoachContext(state.userName, state.streak, state.dopamineScore, state.habits, state.goals, state.checkIns, state.identityStatement);
    const daysSince = Math.floor((Date.now() - new Date(goal.madeAt).getTime()) / 86400000);
    try {
      const a = await getGoalAdvice(state.personality, ctx, goal.name, goal.progress, daysSince);
      setAdvice(prev => ({ ...prev, [goal.id]: a }));
    } catch {
      const stalled = goal.progress < 30 && daysSince > 14;
      setAdvice(prev => ({ ...prev, [goal.id]: stalled
        ? `${state.userName}. "${goal.name}" has been sitting at ${goal.progress}% for ${daysSince} days. That's not progress — that's avoidance. What's the one task that would move it forward today?`
        : `${goal.name} at ${goal.progress}%. What's the next concrete action — not "work on it", the specific thing.`
      }));
    } finally { setLoadingId(null); }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black" style={{ color: 'var(--text)', letterSpacing: '-0.5px' }}>Goals</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{state.goals.length} active · your coach is watching</p>
          </div>
          <button onClick={() => setShowAdd(true)} className="px-3.5 py-2 rounded-xl font-bold text-sm"
            style={{ background: 'var(--accent)', color: '#000', border: 'none', cursor: 'pointer' }}>
            + Goal
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        {state.goals.map((g, i) => {
          const daysSince = Math.floor((Date.now() - new Date(g.madeAt).getTime()) / 86400000);
          const stalled = g.progress < 30 && daysSince > 14;
          return (
            <div key={g.id} className="rounded-2xl p-4 animate-fade-up"
              style={{
                background: 'var(--bg2)',
                border: `1px solid ${stalled ? 'rgba(240,96,96,0.3)' : 'var(--border)'}`,
                animationDelay: `${i * 0.07}s`,
              }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 pr-3">
                  <h3 className="font-bold text-sm leading-snug" style={{ color: 'var(--text)' }}>{g.name}</h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                    {stalled ? <span style={{ color: 'var(--accent3)' }}>⚠️ Stalled — {daysSince} days in</span> : `Promised ${daysSince} day${daysSince !== 1 ? 's' : ''} ago`}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="px-2 py-0.5 rounded-lg text-xs font-bold uppercase"
                    style={{ background: catBg[g.category], color: catColors[g.category], fontSize: 9, letterSpacing: '0.5px' }}>
                    {g.category}
                  </span>
                  <button onClick={() => setState(s => ({ ...s, goals: s.goals.filter(x => x.id !== g.id) }))}
                    style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 14 }}>✕</button>
                </div>
              </div>

              <div className="mb-3">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>Progress</span>
                  <span className="text-sm font-mono font-bold" style={{ color: catColors[g.category] }}>{g.progress}%</span>
                </div>
                <div className="rounded-full overflow-hidden" style={{ height: 7, background: 'var(--bg4)' }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${g.progress}%`, background: catColors[g.category] }} />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <button onClick={() => updateProgress(g.id, -5)}
                    className="w-8 h-8 rounded-lg font-bold transition-all"
                    style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer' }}>−</button>
                  <button onClick={() => updateProgress(g.id, 5)}
                    className="w-8 h-8 rounded-lg font-bold transition-all"
                    style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer' }}>+</button>
                </div>
                <span className="text-xs font-mono flex-1" style={{ color: 'var(--muted)' }}>📅 {g.deadline}</span>
                <button onClick={() => fetchAdvice(g)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: adviceGoalId === g.id ? catBg[g.category] : 'var(--bg3)',
                    color: adviceGoalId === g.id ? catColors[g.category] : 'var(--muted)',
                    border: '1px solid var(--border)', cursor: 'pointer',
                  }}>
                  🤖 Advice
                </button>
              </div>

              {adviceGoalId === g.id && (
                <div className="mt-3 px-3 py-2.5 rounded-xl text-xs leading-relaxed animate-fade-in"
                  style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                  {loadingId === g.id
                    ? <div className="flex gap-1.5 items-center" style={{ color: 'var(--muted)' }}><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /></div>
                    : <span dangerouslySetInnerHTML={{ __html: (advice[g.id] || '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                  }
                </div>
              )}
              {g.progress === 100 && (
                <div className="mt-3 text-center py-1.5 rounded-xl text-xs font-black animate-fade-in"
                  style={{ background: 'rgba(184,240,88,0.15)', color: 'var(--accent)' }}>🏆 GOAL ACHIEVED</div>
              )}
            </div>
          );
        })}
        {state.goals.length === 0 && (
          <div className="text-center py-12" style={{ color: 'var(--muted)' }}>
            <div className="text-4xl mb-3">🎯</div>
            <p className="font-semibold">No goals set</p>
            <p className="text-sm mt-1">Your coach can't hold you accountable to nothing.</p>
          </div>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end justify-center animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="w-full max-w-lg rounded-t-3xl p-6 animate-fade-up"
            style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderBottom: 'none' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black" style={{ color: 'var(--text)' }}>New Goal</h2>
              <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>
            <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="What are you committing to?" className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-3"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)' }} />
            <input value={newTarget} onChange={e => setNewTarget(e.target.value)}
              placeholder="What does success look like specifically?" className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-3"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)' }} />
            <input value={newDeadline} onChange={e => setNewDeadline(e.target.value)}
              placeholder="Deadline (e.g. Dec 31 2026)" className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-4"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)' }} />
            <div className="grid grid-cols-5 gap-2 mb-5">
              {(['health', 'business', 'mindset', 'finance', 'relationships'] as Goal['category'][]).map(cat => (
                <button key={cat} onClick={() => setNewCat(cat)}
                  className="py-2 rounded-xl text-xs font-bold capitalize transition-all"
                  style={{ background: newCat === cat ? catBg[cat] : 'var(--bg3)', color: newCat === cat ? catColors[cat] : 'var(--muted)', border: `1px solid ${newCat === cat ? catColors[cat] : 'var(--border)'}`, cursor: 'pointer', fontSize: 9 }}>
                  {cat}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-3 rounded-xl font-bold text-sm"
                style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={addGoal} disabled={!newName.trim()} className="flex-1 py-3 rounded-xl font-bold text-sm"
                style={{ background: newName.trim() ? 'var(--accent)' : 'var(--bg3)', color: newName.trim() ? '#000' : 'var(--muted)', border: 'none', cursor: newName.trim() ? 'pointer' : 'not-allowed' }}>
                Commit ✓
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
