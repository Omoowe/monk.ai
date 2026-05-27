import { useState, useRef, useEffect, useCallback } from 'react';
import { AppState, ChatMessage, personalities } from '../store';
import { askCoach, getPepTalk, buildCoachContext } from '../ai';

interface Props {
  state: AppState;
  setState: (fn: (s: AppState) => AppState) => void;
}

function getQuickPrompts(state: AppState) {
  const missed = state.habits.filter(h => !h.completedToday).map(h => h.name);
  const morning = state.checkIns.find(c => c.type === 'morning' && c.date === new Date().toISOString().split('T')[0]);
  const prompts = [];
  if (missed.length > 0) prompts.push({ label: `❌ ${missed[0]}`, msg: `I still haven't done ${missed[0]}. I'm avoiding it.` });
  if (morning?.mission) prompts.push({ label: '🎯 Mission', msg: `How am I doing on: "${morning.mission}"?` });
  if (morning?.distraction) prompts.push({ label: `⚠️ ${morning.distraction.slice(0, 10)}…`, msg: `${morning.distraction} is getting to me.` });
  prompts.push({ label: '💪 Push me', msg: "I need a push. Don't be gentle." });
  prompts.push({ label: '🌙 Wind down', msg: "Help me close today and set up tomorrow." });
  return prompts.slice(0, 4);
}

// ── Monk Mode Panel ──────────────────────────────────────────
interface MonkPanelProps {
  color: string;
  onClose: () => void;
}

function MonkPanel({ color, onClose }: MonkPanelProps) {
  const [timerSecs, setTimerSecs] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerPreset, setTimerPreset] = useState(25 * 60);
  const [challengeActive, setChallengeActive] = useState(false);
  const [strictGoals, setStrictGoals] = useState(false);
  const [detoxActive, setDetoxActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const presets = [
    { label: '15 min', secs: 15 * 60 },
    { label: '30 min', secs: 30 * 60 },
    { label: '60 min', secs: 60 * 60 },
  ];

  const adjustMins = (delta: number) => {
    setTimerPreset(prev => {
      const mins = Math.round(prev / 60);
      const next = Math.max(1, Math.min(180, mins + delta));
      return next * 60;
    });
  };

  useEffect(() => {
    if (timerRunning && timerSecs > 0) {
      timerRef.current = setInterval(() => setTimerSecs(s => s - 1), 1000);
    } else if (timerSecs === 0 && timerRunning) {
      setTimerRunning(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning, timerSecs]);

  const startTimer = () => {
    setTimerSecs(timerPreset);
    setTimerRunning(true);
  };
  const stopTimer = () => {
    setTimerRunning(false);
    setTimerSecs(0);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const pct = timerSecs > 0 ? (timerSecs / timerPreset) * 100 : 0;

  return (
    <div className="animate-fade-in" style={{
      position: 'absolute', inset: 0, background: 'var(--bg)', zIndex: 20,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🧘</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: color }}>Monk Mode</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Gamify your discipline</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer', padding: '4px 8px' }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 24px' }}>

        {/* ── Dopamine Detox Timer ── */}
        <div style={{ background: 'var(--bg2)', border: `1px solid ${timerRunning ? color : 'var(--border)'}`, borderRadius: 18, padding: 20, marginBottom: 14, transition: 'border-color 0.3s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 18 }}>⏱️</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>Dopamine Detox Timer</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Lock in. No distractions. Just work.</div>
            </div>
          </div>

          {/* Timer ring */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <div style={{ position: 'relative', width: 130, height: 130 }}>
              <svg width="130" height="130" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="65" cy="65" r="58" fill="none" stroke="var(--bg4)" strokeWidth="8" />
                <circle cx="65" cy="65" r="58" fill="none" stroke={color} strokeWidth="8"
                  strokeDasharray={`${2 * Math.PI * 58}`}
                  strokeDashoffset={`${2 * Math.PI * 58 * (1 - pct / 100)}`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 26, fontWeight: 700, color: timerRunning ? color : 'var(--text)', letterSpacing: '-1px' }}>
                  {timerRunning || timerSecs > 0 ? fmt(timerSecs) : fmt(timerPreset)}
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 2 }}>
                  {timerRunning ? 'focus' : 'ready'}
                </div>
              </div>
            </div>
          </div>

          {/* Presets + up/down */}
          {!timerRunning && (
            <>
              {/* Quick preset chips */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 12, justifyContent: 'center' }}>
                {presets.map(p => (
                  <button key={p.label} onClick={() => setTimerPreset(p.secs)}
                    style={{
                      padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                      border: `1px solid ${timerPreset === p.secs ? color : 'var(--border)'}`,
                      background: timerPreset === p.secs ? `${color}18` : 'var(--bg3)',
                      color: timerPreset === p.secs ? color : 'var(--muted)', cursor: 'pointer',
                    }}>{p.label}</button>
                ))}
              </div>

              {/* Up / Down minute adjuster */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, marginBottom: 14 }}>
                <button onClick={() => adjustMins(-5)}
                  style={{
                    width: 40, height: 40, borderRadius: '50%', fontSize: 20, fontWeight: 900,
                    background: 'var(--bg3)', border: '1px solid var(--border2)',
                    color: 'var(--text)', cursor: 'pointer', lineHeight: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>−</button>

                <div style={{ textAlign: 'center', minWidth: 70 }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--muted)', letterSpacing: '0.5px' }}>
                    {Math.round(timerPreset / 60)} min
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>±5 min</div>
                </div>

                <button onClick={() => adjustMins(5)}
                  style={{
                    width: 40, height: 40, borderRadius: '50%', fontSize: 20, fontWeight: 900,
                    background: 'var(--bg3)', border: '1px solid var(--border2)',
                    color: 'var(--text)', cursor: 'pointer', lineHeight: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>+</button>
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            {!timerRunning ? (
              <button onClick={startTimer} style={{ flex: 1, padding: '11px', borderRadius: 12, background: color, color: '#000', border: 'none', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
                Start Focus Block
              </button>
            ) : (
              <button onClick={stopTimer} style={{ flex: 1, padding: '11px', borderRadius: 12, background: 'var(--accent3)', color: '#fff', border: 'none', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
                Stop Session
              </button>
            )}
          </div>
        </div>

        {/* ── No Excuses Challenge ── */}
        <div
          onClick={() => setChallengeActive(a => !a)}
          style={{
            background: challengeActive ? `rgba(240,96,96,0.1)` : 'var(--bg2)',
            border: `1px solid ${challengeActive ? 'var(--accent3)' : 'var(--border)'}`,
            borderRadius: 18, padding: 16, marginBottom: 14, cursor: 'pointer',
            transition: 'all 0.2s',
          }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>💀</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, color: challengeActive ? 'var(--accent3)' : 'var(--text)' }}>No Excuses Mode</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Coach gives zero sympathy. Raw accountability only.</div>
              </div>
            </div>
            <div style={{
              width: 44, height: 24, borderRadius: 12, background: challengeActive ? 'var(--accent3)' : 'var(--bg4)',
              border: '1px solid var(--border2)', position: 'relative', transition: 'background 0.2s',
            }}>
              <div style={{
                position: 'absolute', top: 3, left: challengeActive ? 22 : 2, width: 16, height: 16,
                borderRadius: '50%', background: challengeActive ? '#fff' : 'var(--muted)', transition: 'left 0.2s',
              }} />
            </div>
          </div>
          {challengeActive && (
            <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(240,96,96,0.1)', fontSize: 12, color: 'var(--accent3)' }}>
              ⚠️ Your coach will call out every excuse, skip the sympathy, and demand results. No softening.
            </div>
          )}
        </div>

        {/* ── Strict Daily Goals ── */}
        <div
          onClick={() => setStrictGoals(a => !a)}
          style={{
            background: strictGoals ? `rgba(184,240,88,0.07)` : 'var(--bg2)',
            border: `1px solid ${strictGoals ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 18, padding: 16, marginBottom: 14, cursor: 'pointer',
            transition: 'all 0.2s',
          }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>🎯</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, color: strictGoals ? 'var(--accent)' : 'var(--text)' }}>Strict Daily Goals</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>All habits locked in. Miss one = streak penalty.</div>
              </div>
            </div>
            <div style={{
              width: 44, height: 24, borderRadius: 12, background: strictGoals ? 'var(--accent)' : 'var(--bg4)',
              border: '1px solid var(--border2)', position: 'relative', transition: 'background 0.2s',
            }}>
              <div style={{
                position: 'absolute', top: 3, left: strictGoals ? 22 : 2, width: 16, height: 16,
                borderRadius: '50%', background: strictGoals ? '#000' : 'var(--muted)', transition: 'left 0.2s',
              }} />
            </div>
          </div>
          {strictGoals && (
            <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(184,240,88,0.1)', fontSize: 12, color: 'var(--accent)' }}>
              ✓ Every habit is now a non-negotiable. Your coach tracks and penalises misses in real-time.
            </div>
          )}
        </div>

        {/* ── Dopamine Detox Block ── */}
        <div
          onClick={() => setDetoxActive(a => !a)}
          style={{
            background: detoxActive ? `rgba(123,106,240,0.1)` : 'var(--bg2)',
            border: `1px solid ${detoxActive ? 'var(--accent2)' : 'var(--border)'}`,
            borderRadius: 18, padding: 16, marginBottom: 14, cursor: 'pointer',
            transition: 'all 0.2s',
          }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>📵</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, color: detoxActive ? 'var(--accent2)' : 'var(--text)' }}>Block Distractions</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Social media, news & dopamine traps go dark.</div>
              </div>
            </div>
            <div style={{
              width: 44, height: 24, borderRadius: 12, background: detoxActive ? 'var(--accent2)' : 'var(--bg4)',
              border: '1px solid var(--border2)', position: 'relative', transition: 'background 0.2s',
            }}>
              <div style={{
                position: 'absolute', top: 3, left: detoxActive ? 22 : 2, width: 16, height: 16,
                borderRadius: '50%', background: detoxActive ? '#fff' : 'var(--muted)', transition: 'left 0.2s',
              }} />
            </div>
          </div>
          {detoxActive && (
            <div style={{ marginTop: 10 }}>
              <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(123,106,240,0.1)', fontSize: 12, color: 'var(--accent2)', marginBottom: 8 }}>
                📵 Distraction shield active. Your brain is recalibrating.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {['🐦 Twitter/X', '📷 Instagram', '🎵 TikTok', '📺 YouTube', '👻 Snapchat', '🎮 Games'].map(app => (
                  <div key={app} style={{
                    padding: '6px 10px', borderRadius: 8, background: 'rgba(240,96,96,0.1)',
                    border: '1px solid rgba(240,96,96,0.2)', fontSize: 11, color: 'var(--accent3)', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <span style={{ fontSize: 8, color: 'var(--accent3)' }}>●</span> {app}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Challenge mode badge */}
        {(challengeActive || strictGoals || detoxActive || timerRunning) && (
          <div style={{
            padding: '12px 16px', borderRadius: 14,
            background: `linear-gradient(135deg, ${color}15, ${color}05)`,
            border: `1px solid ${color}40`,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 20 }}>⚡</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: color }}>Monk Mode Active</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                {[timerRunning && 'Focus timer', challengeActive && 'No excuses', strictGoals && 'Strict goals', detoxActive && 'Detox'].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Coach Screen ─────────────────────────────────────────
export default function CoachScreen({ state, setState }: Props) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pepLoading, setPepLoading] = useState(false);
  const [showMonk, setShowMonk] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported] = useState(() => 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const pConfig = personalities[state.personality];

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [state.chatHistory, loading]);

  const getCtx = () => buildCoachContext(
    state.userName, state.streak, state.dopamineScore,
    state.habits, state.goals, state.checkIns, state.identityStatement
  );

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    setInput('');
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: text.trim(), ts: Date.now() };
    setState(s => ({ ...s, chatHistory: [...s.chatHistory, userMsg] }));
    setLoading(true);
    try {
      const reply = await askCoach(text.trim(), state.personality, getCtx());
      const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'ai', text: reply, ts: Date.now() };
      setState(s => ({ ...s, chatHistory: [...s.chatHistory, aiMsg] }));
    } catch {
      setState(s => ({ ...s, chatHistory: [...s.chatHistory, { id: (Date.now() + 1).toString(), role: 'ai', text: `${state.userName}. Connection dropped — your discipline shouldn't.`, ts: Date.now() }] }));
    } finally { setLoading(false); }
  };

  const handlePep = async () => {
    setPepLoading(true);
    try {
      const pep = await getPepTalk(state.personality, getCtx());
      setState(s => ({ ...s, chatHistory: [...s.chatHistory, { id: Date.now().toString(), role: 'ai', text: '🎙️ ' + pep, ts: Date.now() }] }));
    } catch {
      const missed = state.habits.filter(h => !h.completedToday)[0]?.name;
      setState(s => ({ ...s, chatHistory: [...s.chatHistory, { id: Date.now().toString(), role: 'ai', text: `🎙️ ${state.userName}. ${missed ? `${missed} — right now.` : `${state.streak} days. Don't make it ${state.streak - 1}.`}`, ts: Date.now() }] }));
    } finally { setPepLoading(false); }
  };

  // ── Voice input ──
  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (e: any) => {
      const transcript = Array.from(e.results)
        .map((r: any) => r[0].transcript)
        .join('');
      setInput(transcript);
      // If final result, auto-send
      if (e.results[e.results.length - 1].isFinal) {
        setTimeout(() => {
          send(transcript);
          setInput('');
        }, 400);
      }
    };

    recognition.start();
  }, [state]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const completed = state.habits.filter(h => h.completedToday).length;
  const total = state.habits.length;
  const quickPrompts = getQuickPrompts(state);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

      {/* Monk Mode panel overlay */}
      {showMonk && <MonkPanel color={pConfig.color} onClose={() => setShowMonk(false)} />}

      {/* Coach identity bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--border)', background: `${pConfig.color}08`, flexShrink: 0 }}>
        <span style={{ fontSize: 22 }}>{pConfig.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: pConfig.color }}>{pConfig.name}</div>
          <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{pConfig.tagline}"</div>
        </div>
        {/* Monk Mode button */}
        <button
          onClick={() => setShowMonk(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
            background: state.monkMode ? `${pConfig.color}20` : 'var(--bg3)',
            color: state.monkMode ? pConfig.color : 'var(--muted)',
            border: `1px solid ${state.monkMode ? pConfig.color : 'var(--border2)'}`,
            cursor: 'pointer',
          }}>
          🧘 Monk
        </button>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 13, color: 'var(--gold)' }}>🔥 {state.streak}d</div>
          <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: completed === total ? 'var(--accent)' : 'var(--muted)' }}>{completed}/{total}</div>
        </div>
      </div>

      {/* Identity bar */}
      {state.identityStatement && (
        <div style={{ padding: '7px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', flexShrink: 0 }}>
          <p style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.4 }}>
            <span style={{ color: pConfig.color }}>You: </span>"I am the type of person who {state.identityStatement}"
          </p>
        </div>
      )}

      {/* Chat */}
      <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {state.chatHistory.map((msg, i) => (
          <div key={msg.id} style={{ maxWidth: '86%', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', animationDelay: `${Math.min(i, 5) * 0.03}s` }} className="animate-fade-up">
            {msg.role === 'ai' && <div style={{ fontSize: 10, marginBottom: 4, fontWeight: 700, color: pConfig.color }}>{pConfig.emoji} {pConfig.name}</div>}
            <div
              style={{
                padding: '10px 14px', fontSize: 14, lineHeight: 1.55,
                background: msg.role === 'ai' ? 'var(--bg2)' : pConfig.color,
                color: msg.role === 'ai' ? 'var(--text)' : '#000',
                border: msg.role === 'ai' ? `1px solid ${pConfig.color}25` : 'none',
                borderRadius: msg.role === 'ai' ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
              }}
              dangerouslySetInnerHTML={{ __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
            />
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: 'flex-start', maxWidth: '86%' }} className="animate-fade-in">
            <div style={{ fontSize: 10, marginBottom: 4, fontWeight: 700, color: pConfig.color }}>{pConfig.emoji} {pConfig.name}</div>
            <div style={{ padding: '10px 14px', background: 'var(--bg2)', border: `1px solid ${pConfig.color}25`, borderRadius: '4px 16px 16px 16px', display: 'flex', gap: 5, alignItems: 'center' }}>
              <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
            </div>
          </div>
        )}
      </div>

      {/* Quick prompts */}
      <div style={{ padding: '6px 14px', display: 'flex', gap: 7, overflowX: 'auto', flexShrink: 0, scrollbarWidth: 'none' }}>
        {quickPrompts.map(q => (
          <button key={q.label} onClick={() => send(q.msg)}
            style={{
              padding: '6px 12px', borderRadius: 20, whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600,
              background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--muted)',
              cursor: 'pointer', flexShrink: 0,
            }}
            onMouseEnter={e => { const el = e.currentTarget; el.style.color = pConfig.color; el.style.borderColor = pConfig.color; }}
            onMouseLeave={e => { const el = e.currentTarget; el.style.color = 'var(--muted)'; el.style.borderColor = 'var(--border2)'; }}
          >{q.label}</button>
        ))}
      </div>

      {/* Input row */}
      <div style={{ padding: '6px 14px 14px', flexShrink: 0 }}>
        {/* Voice listening indicator */}
        {isListening && (
          <div className="animate-fade-in" style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', marginBottom: 8,
            background: `${pConfig.color}15`, border: `1px solid ${pConfig.color}40`,
            borderRadius: 12, fontSize: 12, color: pConfig.color, fontWeight: 600,
          }}>
            <span style={{ fontSize: 16 }}>🎙️</span>
            <span>Listening… speak now</span>
            <div style={{ display: 'flex', gap: 3, marginLeft: 'auto' }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{
                  width: 3, borderRadius: 2, background: pConfig.color,
                  animation: `pulse-dot 0.8s ${i * 0.15}s infinite alternate`,
                  height: `${8 + i * 4}px`,
                }} />
              ))}
            </div>
          </div>
        )}

        <div style={{
          display: 'flex', gap: 8, alignItems: 'flex-end',
          background: 'var(--bg2)',
          border: `1.5px solid ${input.trim() ? pConfig.color : 'var(--border2)'}`,
          borderRadius: 16, padding: '10px 12px',
          transition: 'border-color 0.2s',
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder={isListening ? 'Listening…' : `Talk to ${pConfig.name}...`}
            rows={1}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              resize: 'none', fontSize: 15, lineHeight: 1.5, color: 'var(--text)',
              fontFamily: 'var(--font)', maxHeight: 80,
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 2 }}>
            {/* Pep talk */}
            <button onClick={handlePep} disabled={pepLoading} title="Pep talk"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 17, lineHeight: 1, opacity: pepLoading ? 0.4 : 0.7, padding: 0 }}>
              {pepLoading ? '⏳' : '⚡'}
            </button>
            {/* Voice */}
            {voiceSupported && (
              <button
                onMouseDown={startListening}
                onMouseUp={stopListening}
                onTouchStart={startListening}
                onTouchEnd={stopListening}
                title="Hold to speak"
                style={{
                  background: isListening ? pConfig.color : 'none',
                  border: isListening ? 'none' : 'none',
                  borderRadius: '50%', width: 28, height: 28,
                  cursor: 'pointer', fontSize: 15, lineHeight: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.2s',
                  opacity: isListening ? 1 : 0.7,
                }}>
                {isListening ? '🔴' : '🎙️'}
              </button>
            )}
            {/* Send */}
            <button onClick={() => send(input)} disabled={!input.trim() || loading}
              style={{
                padding: '5px 10px', borderRadius: 10, fontSize: 12, fontWeight: 800,
                background: input.trim() && !loading ? pConfig.color : 'var(--bg4)',
                color: input.trim() && !loading ? '#000' : 'var(--muted)',
                border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s',
              }}>↑</button>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: 5, fontSize: 10, color: 'var(--muted)' }}>
          {voiceSupported ? 'Hold 🎙️ to speak · ⚡ pep talk · Enter to send' : '⚡ pep talk · Enter to send'}
        </div>
      </div>
    </div>
  );
}
