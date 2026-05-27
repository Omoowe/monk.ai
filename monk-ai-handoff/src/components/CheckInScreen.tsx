import { useState } from 'react';
import { AppState, CheckIn } from '../store';
import { generateMorningBrief, generateEveningFeedback, buildCoachContext } from '../ai';
import { personalities } from '../store';

interface Props {
  state: AppState;
  setState: (fn: (s: AppState) => AppState) => void;
}

export default function CheckInScreen({ state, setState }: Props) {
  const [phase, setPhase] = useState<'pick' | 'morning' | 'evening' | 'result'>('pick');
  const [mission, setMission] = useState('');
  const [energy, setEnergy] = useState(3);
  const [distraction, setDistraction] = useState('');
  const [completed, setCompleted] = useState<boolean | null>(null);
  const [reason, setReason] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const pConfig = personalities[state.personality];

  const getCtx = () => buildCoachContext(
    state.userName, state.streak, state.dopamineScore,
    state.habits, state.goals, state.checkIns, state.identityStatement
  );

  const submitMorning = async () => {
    if (!mission.trim()) return;
    setLoading(true);
    setPhase('result');
    const checkin: CheckIn = {
      date: new Date().toISOString().split('T')[0],
      type: 'morning', mission, energy, distraction,
    };
    setState(s => ({ ...s, checkIns: [...s.checkIns, checkin], morningDone: true }));
    try {
      const reply = await generateMorningBrief(state.personality, getCtx(), mission, energy, distraction);
      setAiResponse(reply);
    } catch {
      setAiResponse(`${state.userName}. "${mission}" — that's the mission. "${distraction}" will try to take the day. Don't let it. Your ${state.streak}-day streak depends on the next 16 hours.`);
    } finally { setLoading(false); }
  };

  const submitEvening = async () => {
    if (completed === null) return;
    setLoading(true);
    setPhase('result');
    const morningCheckin = [...state.checkIns].reverse().find(c => c.type === 'morning');
    const missionText = morningCheckin?.mission || 'your mission';
    const done = state.habits.filter(h => h.completedToday).length;
    const total = state.habits.length;
    const checkin: CheckIn = {
      date: new Date().toISOString().split('T')[0],
      type: 'evening', completed, reason,
    };
    const newStreak = completed ? state.streak + 1 : state.streak;
    const newScore = completed ? Math.min(100, state.dopamineScore + 3) : Math.max(0, state.dopamineScore - 5);
    setState(s => ({ ...s, checkIns: [...s.checkIns, checkin], eveningDone: true, streak: newStreak, dopamineScore: newScore }));
    try {
      const reply = await generateEveningFeedback(state.personality, getCtx(), missionText, completed, reason, done, total);
      setAiResponse(reply);
    } catch {
      setAiResponse(completed
        ? `${state.userName}. "${missionText}" — done. That's ${state.streak + 1} days. The person you're becoming does what they say.`
        : `${state.userName}. "${reason}" — your coach heard it. Tomorrow, "${missionText}" happens first. Before anything else.`
      );
    } finally { setLoading(false); }
  };

  const reset = () => { setPhase('pick'); setMission(''); setCompleted(null); setReason(''); setAiResponse(''); };

  if (phase === 'result') {
    return (
      <div className="flex flex-col h-full px-5 py-6 items-center justify-center">
        <div className="w-full max-w-sm text-center animate-fade-up">
          <div className="text-5xl mb-5">{pConfig.emoji}</div>
          {loading ? (
            <div className="flex flex-col items-center gap-3" style={{ color: 'var(--muted)' }}>
              <div className="flex gap-2"><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /></div>
              <p className="text-sm">{pConfig.name} is responding...</p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl p-5 mb-6 text-left"
                style={{ background: 'var(--bg2)', border: `1px solid ${pConfig.color}40` }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: pConfig.color, fontSize: 10 }}>
                  {pConfig.emoji} {pConfig.name}
                </p>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}
                  dangerouslySetInnerHTML={{ __html: aiResponse.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
              </div>
              <button onClick={reset} className="w-full py-3.5 rounded-2xl font-black text-sm"
                style={{ background: 'var(--accent)', color: '#000', border: 'none', cursor: 'pointer' }}>
                Back to app
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'pick') {
    const todayMorning = state.checkIns.find(c => c.type === 'morning' && c.date === new Date().toISOString().split('T')[0]);
    return (
      <div className="flex flex-col h-full px-5 py-6 overflow-y-auto">
        <h1 className="text-2xl font-black mb-1" style={{ color: 'var(--text)', letterSpacing: '-0.5px' }}>Check-In</h1>
        <p className="text-xs mb-6" style={{ color: 'var(--muted)' }}>Two minutes of honesty. Twice a day.</p>

        {[
          { type: 'morning' as const, emoji: '☀️', title: 'Morning Mission', sub: 'Set your mission. Lock in your day.', done: state.morningDone },
          { type: 'evening' as const, emoji: '🌙', title: 'Evening Debrief', sub: 'Did you follow through? No hiding.', done: state.eveningDone },
        ].map(item => (
          <div key={item.type}
            onClick={() => !item.done && (item.type === 'morning' || state.morningDone) && setPhase(item.type)}
            className="rounded-2xl p-5 mb-4 transition-all"
            style={{
              background: item.done ? `${pConfig.color}08` : 'var(--bg2)',
              border: `1px solid ${item.done ? `${pConfig.color}35` : 'var(--border2)'}`,
              cursor: item.done ? 'default' : (item.type === 'evening' && !state.morningDone) ? 'not-allowed' : 'pointer',
              opacity: item.type === 'evening' && !state.morningDone && !state.eveningDone ? 0.45 : 1,
            }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{item.emoji}</span>
                <div>
                  <div className="font-black text-base" style={{ color: item.done ? pConfig.color : 'var(--text)' }}>{item.title}</div>
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>{item.sub}</div>
                </div>
              </div>
              <span style={{ fontSize: 18 }}>{item.done ? '✅' : '→'}</span>
            </div>
            {item.type === 'evening' && !state.morningDone && (
              <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>Complete morning check-in first</p>
            )}
          </div>
        ))}

        {todayMorning?.mission && (
          <div className="rounded-2xl p-4 mt-2" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
            <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)', fontSize: 10 }}>Today's mission</div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>"{todayMorning.mission}"</p>
            {todayMorning.distraction && (
              <p className="text-xs mt-1" style={{ color: 'var(--accent3)' }}>⚠️ Watch out for: {todayMorning.distraction}</p>
            )}
          </div>
        )}
      </div>
    );
  }

  if (phase === 'morning') {
    return (
      <div className="flex flex-col h-full px-5 py-6 overflow-y-auto">
        <button onClick={() => setPhase('pick')} className="text-sm mb-5 self-start"
          style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>← Back</button>
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">☀️</span>
          <div>
            <h2 className="text-xl font-black" style={{ color: 'var(--text)', letterSpacing: '-0.5px' }}>Morning Mission</h2>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>What matters most today? Be specific.</p>
          </div>
        </div>

        <div className="mb-5">
          <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)', fontSize: 10 }}>
            Today's #1 mission (be specific)
          </label>
          <textarea autoFocus value={mission} onChange={e => setMission(e.target.value)}
            placeholder="e.g. Finish the landing page copy and send it to the designer by 5pm."
            rows={2} className="w-full px-4 py-3 rounded-2xl text-sm outline-none resize-none"
            style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)', fontFamily: 'var(--font)', lineHeight: 1.6 }} />
        </div>

        <div className="mb-5">
          <label className="block text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)', fontSize: 10 }}>Energy level</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => setEnergy(n)}
                className="flex-1 py-3 rounded-xl font-black text-base transition-all"
                style={{
                  background: energy >= n ? pConfig.color : 'var(--bg3)',
                  color: energy >= n ? '#000' : 'var(--muted)',
                  border: `1px solid ${energy >= n ? pConfig.color : 'var(--border)'}`,
                  cursor: 'pointer',
                }}>⚡</button>
            ))}
          </div>
          <div className="flex justify-between mt-1.5 px-1">
            <span className="text-xs" style={{ color: 'var(--muted)' }}>Drained</span>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>Locked in</span>
          </div>
        </div>

        <div className="mb-8">
          <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)', fontSize: 10 }}>
            What could derail you today?
          </label>
          <input value={distraction} onChange={e => setDistraction(e.target.value)}
            placeholder="e.g. My phone, a difficult meeting, low energy after lunch…"
            className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
            style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)' }} />
        </div>

        <button onClick={submitMorning} disabled={!mission.trim()}
          className="w-full py-4 rounded-2xl font-black text-base"
          style={{
            background: mission.trim() ? pConfig.color : 'var(--bg3)',
            color: mission.trim() ? '#000' : 'var(--muted)',
            border: 'none', cursor: mission.trim() ? 'pointer' : 'not-allowed',
          }}>
          Lock in my mission 🔒
        </button>
      </div>
    );
  }

  // Evening
  const morningMission = [...state.checkIns].reverse().find(c => c.type === 'morning')?.mission;
  return (
    <div className="flex flex-col h-full px-5 py-6 overflow-y-auto">
      <button onClick={() => setPhase('pick')} className="text-sm mb-5 self-start"
        style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>← Back</button>
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">🌙</span>
        <div>
          <h2 className="text-xl font-black" style={{ color: 'var(--text)', letterSpacing: '-0.5px' }}>Evening Debrief</h2>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>No editing. Just the truth.</p>
        </div>
      </div>

      {morningMission && (
        <div className="rounded-2xl p-4 mb-5" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--muted)', fontSize: 10 }}>This morning you said:</p>
          <p className="text-sm font-semibold" style={{ color: pConfig.color }}>"{morningMission}"</p>
        </div>
      )}

      <div className="mb-5">
        <label className="block text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)', fontSize: 10 }}>Did you complete it?</label>
        <div className="flex gap-3">
          {[
            { val: true, label: '✅ Yes I did', activeColor: 'rgba(184,240,88,0.15)', activeBorder: 'var(--accent)', activeText: 'var(--accent)' },
            { val: false, label: '❌ I didn\'t', activeColor: 'rgba(240,96,96,0.1)', activeBorder: 'var(--accent3)', activeText: 'var(--accent3)' },
          ].map(opt => (
            <button key={String(opt.val)} onClick={() => setCompleted(opt.val)}
              className="flex-1 py-4 rounded-2xl font-black text-sm transition-all"
              style={{
                background: completed === opt.val ? opt.activeColor : 'var(--bg2)',
                border: `1px solid ${completed === opt.val ? opt.activeBorder : 'var(--border)'}`,
                color: completed === opt.val ? opt.activeText : 'var(--muted)',
                cursor: 'pointer',
              }}>{opt.label}</button>
          ))}
        </div>
      </div>

      {completed === false && (
        <div className="mb-5 animate-fade-in">
          <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--accent3)', fontSize: 10 }}>
            What actually happened? (Your coach will reference this)
          </label>
          <textarea value={reason} onChange={e => setReason(e.target.value)}
            placeholder="Be honest. Your coach will call this out by name tomorrow."
            rows={2} className="w-full px-4 py-3 rounded-2xl text-sm outline-none resize-none"
            style={{ background: 'var(--bg3)', border: '1px solid rgba(240,96,96,0.3)', color: 'var(--text)', fontFamily: 'var(--font)', lineHeight: 1.6 }} />
        </div>
      )}

      <div className="mt-auto pt-4">
        <button onClick={submitEvening} disabled={completed === null}
          className="w-full py-4 rounded-2xl font-black text-base"
          style={{
            background: completed !== null ? pConfig.color : 'var(--bg3)',
            color: completed !== null ? '#000' : 'var(--muted)',
            border: 'none', cursor: completed !== null ? 'pointer' : 'not-allowed',
          }}>
          Face my coach →
        </button>
      </div>
    </div>
  );
}
