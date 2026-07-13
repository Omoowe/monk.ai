import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface A11yCtx {
  reduceMotion: boolean;
  highContrast: boolean;
  setReduceMotion: (v: boolean) => void;
  setHighContrast: (v: boolean) => void;
}

const AccessibilityContext = createContext<A11yCtx>({
  reduceMotion: false,
  highContrast: false,
  setReduceMotion: () => {},
  setHighContrast: () => {},
});

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [reduceMotion, setReduceMotionState] = useState(false);
  const [highContrast, setHighContrastState] = useState(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem('a11y_reduce_motion'),
      AsyncStorage.getItem('a11y_high_contrast'),
    ]).then(([rm, hc]) => {
      setReduceMotionState(rm === '1');
      setHighContrastState(hc === '1');
    }).catch(() => {});
  }, []);

  const setReduceMotion = (v: boolean) => {
    setReduceMotionState(v);
    AsyncStorage.setItem('a11y_reduce_motion', v ? '1' : '0').catch(() => {});
  };

  const setHighContrast = (v: boolean) => {
    setHighContrastState(v);
    AsyncStorage.setItem('a11y_high_contrast', v ? '1' : '0').catch(() => {});
  };

  return (
    <AccessibilityContext.Provider value={{ reduceMotion, highContrast, setReduceMotion, setHighContrast }}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export const useAccessibility = () => useContext(AccessibilityContext);
