import { useState } from 'react';
import { CoachPersonality, personalities } from '../store';

interface Props {
  onComplete: (name: string, personality: CoachPersonality, identity: string) => void;
}

export default function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [personality, setPersonality] = useState<CoachPersonality>('stoic_mentor');
  const [identity, setIdentity] = useState('');

  const steps = ['welcome', 'name', 'personality', 'identity'];

  const next = () => setStep(s => s + 1);

  if (step === 0) {
    return (
      <div className="flex flex-col items-center justify-between min-h-screen px-6 py-14" style={{ background: 'var(--bg)' }}>
        <div className="self-start">
          <span className="text-lg font-black" style={{ color: 'var(--text)' }}>Monk<span style={{ color: 'var(--accent)' }}>.</span>ai</span>
        </div>
        <div className="text-center max-w-sm animate-fade-up">
          <div className="text-6xl mb-6">🧘</div>
          <h1 className="text-3xl font-black mb-4" style={{ color: 'var(--text)', letterSpacing: '-1px', lineHeight: 1.1 }}>
            Become the person<br />who follows through.
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
            Not another habit tracker. An AI that remembers your failures, calls you out, and stays on you until you change.
          </p>
        </div>
        <div className="w-full max-w-sm">
          <button onClick={next} className="w-full py-4 rounded-2xl font-black text-base"
            style={{ background: 'var(--accent)', color: '#000', border: 'none', cursor: 'pointer' }}>
            I'm ready to be held accountable →
          </button>
          <p className="text-center text-xs mt-3" style={{ color: 'var(--muted)' }}>No fluff. No hand-holding. Just results.</p>
        </div>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6" style={{ background: 'var(--bg)' }}>
        <div className="w-full max-w-sm animate-fade-up">
          <div className="text-3xl mb-4 text-center">👤</div>
          <h2 className="text-2xl font-black text-center mb-2" style={{ color: 'var(--text)', letterSpacing: '-0.5px' }}>
            What do I call you?
          </h2>
          <p className="text-sm text-center mb-8" style={{ color: 'var(--muted)' }}>
            Your coach will use this to hold you accountable — personally.
          </p>
          <input autoFocus value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && name.trim() && next()}
            placeholder="First name..."
            className="w-full px-4 py-3.5 rounded-2xl text-base outline-none mb-4"
            style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)', fontSize: 16 }} />
          <button onClick={() => name.trim() && next()} disabled={!name.trim()}
            className="w-full py-4 rounded-2xl font-black text-base"
            style={{ background: name.trim() ? 'var(--accent)' : 'var(--bg3)', color: name.trim() ? '#000' : 'var(--muted)', border: 'none', cursor: name.trim() ? 'pointer' : 'not-allowed' }}>
            That's me →
          </button>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="flex flex-col min-h-screen px-5 py-10 overflow-y-auto" style={{ background: 'var(--bg)' }}>
        <div className="max-w-sm mx-auto w-full animate-fade-up">
          <h2 className="text-2xl font-black mb-1" style={{ color: 'var(--text)', letterSpacing: '-0.5px' }}>
            Pick your coach, {name}.
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
            Each has a completely different personality. Choose the one that'll actually get you moving.
          </p>
          <div className="flex flex-col gap-3 mb-8">
            {(Object.keys(personalities) as CoachPersonality[]).map(p => {
              const config = personalities[p];
              const selected = personality === p;
              return (
                <button key={p} onClick={() => setPersonality(p)}
                  className="flex items-center gap-4 px-4 py-3.5 rounded-2xl text-left transition-all"
                  style={{
                    background: selected ? `${config.color}15` : 'var(--bg2)',
                    border: `1px solid ${selected ? config.color : 'var(--border)'}`,
                    cursor: 'pointer',
                  }}>
                  <span className="text-2xl flex-shrink-0">{config.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm flex items-center gap-2">
                      <span style={{ color: selected ? config.color : 'var(--text)' }}>{config.name}</span>
                      {selected && <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                        style={{ background: `${config.color}25`, color: config.color }}>Selected</span>}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{config.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
          <button onClick={next} className="w-full py-4 rounded-2xl font-black text-base"
            style={{ background: personalities[personality].color, color: '#000', border: 'none', cursor: 'pointer' }}>
            {personalities[personality].emoji} This is my coach →
          </button>
        </div>
      </div>
    );
  }

  // step 3 — identity
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm animate-fade-up">
        <div className="text-3xl mb-4 text-center">⚡</div>
        <h2 className="text-2xl font-black text-center mb-2" style={{ color: 'var(--text)', letterSpacing: '-0.5px' }}>
          Who are you becoming?
        </h2>
        <p className="text-sm text-center mb-2" style={{ color: 'var(--muted)' }}>
          This is the identity your coach will protect. Complete the sentence:
        </p>
        <p className="text-center font-bold mb-6" style={{ color: 'var(--accent)', fontSize: 15 }}>
          "I am the type of person who..."
        </p>
        <textarea
          autoFocus
          value={identity}
          onChange={e => setIdentity(e.target.value)}
          placeholder="...never quits, shows up every day, and does what I say I'm going to do."
          rows={3}
          className="w-full px-4 py-3.5 rounded-2xl text-sm outline-none resize-none mb-4"
          style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)', fontFamily: 'var(--font)', lineHeight: 1.6 }}
        />
        <button onClick={() => onComplete(name, personality, identity)}
          className="w-full py-4 rounded-2xl font-black text-base mb-3"
          style={{ background: 'var(--accent)', color: '#000', border: 'none', cursor: 'pointer' }}>
          Lock it in. Let's go. 🔒
        </button>
        <button onClick={() => onComplete(name, personality, '')}
          className="w-full py-2 text-sm"
          style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
          Skip for now
        </button>
      </div>
    </div>
  );
}
