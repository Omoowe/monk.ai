import { useState } from 'react';
import { AppState, Habit } from '../store';

interface Props {
  state: AppState;
  setState: (fn: (s: AppState) => AppState) => void;
}

const categoryColors: Record<Habit['category'], string> = {
  health: 'var(--accent)',
  mindset: 'var(--accent2)',
  productivity: 'var(--teal)',
  social: 'var(--gold)',
};

const categoryBg: Record<Habit['category'], string> = {
  health: 'rgba(184,240,88,0.1)',
  mindset: 'rgba(123,106,240,0.1)',
  productivity: 'rgba(64,245,200,0.1)',
  social: 'rgba(245,200,64,0.1)',
};

const emojis = ['💪', '🚿', '📖', '🧠', '✍️', '🏃', '🥗', '💧', '🛌', '🧘', '📵', '⏰', '🎯', '🎸', '📝'];

export default function HabitsScreen({ state, setState }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newEmoji, setNewEmoji] = useState('💪');
  const [newCat, setNewCat] = useState<Habit['category']>('health');

  const completed = state.habits.filter(h => h.completedToday).length;
  const total = state.habits.length;
  const pct = Math.round((completed / total) * 100);

  const toggle = (id: string) => {
    setState(s => {
      const habits = s.habits.map(h =>
        h.id === id ? { ...h, completedToday: !h.completedToday } : h
      );
      const done = habits.filter(h => h.completedToday).length;
      const newScore = Math.round(55 + (done / habits.length) * 45);
      return { ...s, habits, dopamineScore: newScore };
    });
  };

  const addHabit = () => {
    if (!newName.trim()) return;
    const habit: Habit = {
      id: Date.now().toString(),
      name: newName.trim(),
      emoji: newEmoji,
      time: newTime || 'Any time',
      streakDays: 0,
      completedToday: false,
      category: newCat,
    };
    setState(s => ({ ...s, habits: [...s.habits, habit] }));
    setNewName('');
    setNewTime('');
    setNewEmoji('💪');
    setShowAdd(false);
  };

  const deleteHabit = (id: string) => {
    setState(s => ({ ...s, habits: s.habits.filter(h => h.id !== id) }));
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-black" style={{ color: 'var(--text)', letterSpacing: '-0.5px' }}>
              Daily Habits
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="px-3.5 py-2 rounded-xl font-bold text-sm"
            style={{ background: 'var(--accent)', color: '#000', border: 'none', cursor: 'pointer' }}
          >
            + Add
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 rounded-full overflow-hidden" style={{ height: 8, background: 'var(--bg4)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: pct === 100 ? 'var(--accent)' : 'var(--accent2)' }}
            />
          </div>
          <span className="font-mono font-bold text-sm" style={{ color: pct === 100 ? 'var(--accent)' : 'var(--text)' }}>
            {completed}/{total}
          </span>
        </div>
        {pct === 100 && (
          <p className="text-xs mt-2 font-semibold animate-fade-in" style={{ color: 'var(--accent)' }}>
            🏆 Perfect day! Keep the streak alive.
          </p>
        )}
      </div>

      {/* Habit list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2.5">
        {state.habits.map((h, i) => (
          <div
            key={h.id}
            className="animate-fade-up"
            style={{ animationDelay: `${i * 0.06}s` }}
          >
            <div
              onClick={() => toggle(h.id)}
              className="flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all cursor-pointer group"
              style={{
                background: h.completedToday ? 'rgba(184,240,88,0.07)' : 'var(--bg2)',
                border: `1px solid ${h.completedToday ? 'rgba(184,240,88,0.25)' : 'var(--border)'}`,
              }}
            >
              {/* Check circle */}
              <div
                className="flex items-center justify-center rounded-full flex-shrink-0 transition-all"
                style={{
                  width: 28, height: 28,
                  background: h.completedToday ? 'var(--accent)' : 'transparent',
                  border: `2px solid ${h.completedToday ? 'var(--accent)' : 'var(--border2)'}`,
                }}
              >
                {h.completedToday && (
                  <span className="text-xs font-black" style={{ color: '#000' }}>✓</span>
                )}
              </div>

              {/* Emoji */}
              <span className="text-xl flex-shrink-0">{h.emoji}</span>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div
                  className="font-bold text-sm leading-tight"
                  style={{
                    color: h.completedToday ? 'var(--text)' : 'var(--text)',
                    textDecoration: h.completedToday ? 'line-through' : 'none',
                    textDecorationColor: 'var(--muted)',
                  }}
                >
                  {h.name}
                </div>
                <div className="text-xs mt-0.5 flex items-center gap-2" style={{ color: 'var(--muted)' }}>
                  <span style={{ fontFamily: 'var(--mono)' }}>{h.time}</span>
                  <span
                    className="px-1.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider"
                    style={{
                      background: categoryBg[h.category],
                      color: categoryColors[h.category],
                      fontSize: 8,
                    }}
                  >
                    {h.category}
                  </span>
                </div>
              </div>

              {/* Streak */}
              <div className="flex flex-col items-end flex-shrink-0">
                <div className="font-mono font-bold text-sm" style={{ color: 'var(--gold)' }}>
                  🔥 {h.streakDays}
                </div>
                <div className="text-xs" style={{ color: 'var(--muted)', fontSize: 9 }}>days</div>
              </div>
            </div>

            {/* Long press hint — delete button */}
            <button
              onClick={() => deleteHabit(h.id)}
              className="text-xs mt-1 ml-auto block opacity-0 group-hover:opacity-100 transition-opacity"
              style={{
                background: 'none', border: 'none', color: 'var(--muted)',
                cursor: 'pointer', fontSize: 10, display: 'none',
              }}
            >
              Remove
            </button>
          </div>
        ))}

        {state.habits.length === 0 && (
          <div className="text-center py-12" style={{ color: 'var(--muted)' }}>
            <div className="text-4xl mb-3">📋</div>
            <p className="font-semibold">No habits yet</p>
            <p className="text-sm mt-1">Add your first habit to start building discipline</p>
          </div>
        )}
      </div>

      {/* Add habit modal */}
      {showAdd && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={e => e.target === e.currentTarget && setShowAdd(false)}
        >
          <div
            className="w-full max-w-lg rounded-t-3xl p-6 animate-fade-up"
            style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderBottom: 'none' }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black" style={{ color: 'var(--text)' }}>New Habit</h2>
              <button
                onClick={() => setShowAdd(false)}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}
              >✕</button>
            </div>

            {/* Emoji picker */}
            <div className="flex gap-2 flex-wrap mb-4">
              {emojis.map(e => (
                <button
                  key={e}
                  onClick={() => setNewEmoji(e)}
                  className="text-xl w-10 h-10 rounded-xl transition-all"
                  style={{
                    background: newEmoji === e ? 'var(--accent2)' : 'var(--bg3)',
                    border: `1px solid ${newEmoji === e ? 'var(--accent2)' : 'var(--border)'}`,
                    cursor: 'pointer',
                  }}
                >
                  {e}
                </button>
              ))}
            </div>

            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Habit name (e.g. Cold shower)"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-3"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)' }}
            />

            <input
              value={newTime}
              onChange={e => setNewTime(e.target.value)}
              placeholder="Time (e.g. 7:00 AM)"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-3"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)' }}
            />

            <div className="grid grid-cols-4 gap-2 mb-5">
              {(['health', 'mindset', 'productivity', 'social'] as Habit['category'][]).map(cat => (
                <button
                  key={cat}
                  onClick={() => setNewCat(cat)}
                  className="py-2 rounded-xl text-xs font-bold capitalize transition-all"
                  style={{
                    background: newCat === cat ? categoryBg[cat] : 'var(--bg3)',
                    color: newCat === cat ? categoryColors[cat] : 'var(--muted)',
                    border: `1px solid ${newCat === cat ? categoryColors[cat] : 'var(--border)'}`,
                    cursor: 'pointer',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 py-3 rounded-xl font-bold text-sm"
                style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={addHabit}
                disabled={!newName.trim()}
                className="flex-1 py-3 rounded-xl font-bold text-sm transition-all"
                style={{
                  background: newName.trim() ? 'var(--accent)' : 'var(--bg3)',
                  color: newName.trim() ? '#000' : 'var(--muted)',
                  border: 'none',
                  cursor: newName.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Add Habit ✓
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
