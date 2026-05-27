import { useState, useCallback } from 'react';
import { AppState, Screen, CoachPersonality, defaultHabits, defaultGoals, defaultWeekData, personalities } from './store';
import Onboarding from './components/Onboarding';
import Nav from './components/Nav';
import CoachScreen from './components/CoachScreen';
import CheckInScreen from './components/CheckInScreen';
import HabitsScreen from './components/HabitsScreen';
import GoalsScreen from './components/GoalsScreen';
import StatsScreen from './components/StatsScreen';
import ReviewScreen from './components/ReviewScreen';

const initialState: AppState = {
  screen: 'coach',
  userName: '',
  monkMode: false,
  streak: 14,
  dopamineScore: 82,
  habits: defaultHabits,
  goals: defaultGoals,
  chatHistory: [],
  weekData: defaultWeekData,
  onboardingDone: false,
  personality: 'stoic_mentor',
  checkIns: [],
  morningDone: false,
  eveningDone: false,
  identityStatement: '',
};

export default function App() {
  const [state, setStateRaw] = useState<AppState>(initialState);

  const setState = useCallback((fn: (s: AppState) => AppState) => {
    setStateRaw(prev => fn(prev));
  }, []);

  const setScreen = (screen: Screen) => setStateRaw(prev => ({ ...prev, screen }));

  const handleOnboardingComplete = (name: string, personality: CoachPersonality, identity: string) => {
    const pConfig = personalities[personality];
    setStateRaw(prev => ({
      ...prev,
      userName: name,
      personality,
      identityStatement: identity,
      onboardingDone: true,
      chatHistory: [{
        id: '0',
        role: 'ai',
        text: `${name}. I'm ${pConfig.name}. I've got one job — make sure you become the person you said you want to be. I don't forget. I don't let up. **Let's get to work.** 🔒`,
        ts: Date.now(),
      }],
    }));
  };

  if (!state.onboardingDone) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  const pConfig = personalities[state.personality];
  const bothCheckInsDone = state.morningDone && state.eveningDone;

  const renderScreen = () => {
    switch (state.screen) {
      case 'coach':   return <CoachScreen state={state} setState={setState} />;
      case 'checkin': return <CheckInScreen state={state} setState={setState} />;
      case 'goals':   return <GoalsScreen state={state} setState={setState} />;
      case 'stats':   return <StatsScreen state={state} />;
      case 'review':  return <ReviewScreen state={state} />;
      default:        return <CoachScreen state={state} setState={setState} />;
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        maxWidth: 480,
        margin: '0 auto',
        background: 'var(--bg)',
        overflow: 'hidden',
        position: 'relative',
        /* Push content below Dynamic Island / notch */
        paddingTop: 'var(--sat)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 20px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg)',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: '-0.5px', color: 'var(--text)' }}>
          Monk<span style={{ color: pConfig.color }}>.</span>ai
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {state.monkMode && (
            <div style={{
              padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
              background: `${pConfig.color}15`, color: pConfig.color,
              border: `1px solid ${pConfig.color}30`,
            }}>
              🧘 Monk
            </div>
          )}
          {!bothCheckInsDone && (
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f06060' }} />
          )}
          <span style={{ fontSize: 13, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--gold)' }}>
            🔥 {state.streak}
          </span>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 900,
            background: `${pConfig.color}20`, color: pConfig.color,
          }}>
            {state.userName.slice(0, 1).toUpperCase()}
          </div>
        </div>
      </div>

      {/* Screen content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {renderScreen()}
      </div>

      {/* Nav — sits above home indicator */}
      <Nav
        current={state.screen}
        onChange={setScreen}
        morningDone={state.morningDone}
        eveningDone={state.eveningDone}
        safeAreaBottom={`var(--sab)`}
      />
    </div>
  );
}
