import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';

import { Tokens, type ColorScheme, type ThemeTokens } from '@/constants/theme';
import { logger } from '@/utils/logger';

/** What the customer chose in Profile (decision 4). Default: follow the phone. */
export type ThemePreference = 'system' | 'light' | 'dark';

const PREFERENCE_KEY = 'bnpl_theme_preference';

type ThemeContextValue = {
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
  scheme: ColorScheme;
  tokens: ThemeTokens;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isPreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

async function readPreference(): Promise<ThemePreference> {
  try {
    const stored =
      Platform.OS === 'web'
        ? globalThis.localStorage?.getItem(PREFERENCE_KEY)
        : await SecureStore.getItemAsync(PREFERENCE_KEY);
    return isPreference(stored) ? stored : 'system';
  } catch (err) {
    logger.warn('[theme] could not read the saved preference', err);
    return 'system';
  }
}

async function writePreference(value: ThemePreference) {
  try {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(PREFERENCE_KEY, value);
    } else {
      await SecureStore.setItemAsync(PREFERENCE_KEY, value);
    }
  } catch (err) {
    logger.warn('[theme] could not save the preference', err);
  }
}

/** Also switches native UI (date pickers, alerts, keyboard) to the chosen scheme. */
function applyToNative(preference: ThemePreference) {
  if (Platform.OS === 'web') return;
  Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const phoneScheme = useColorScheme();

  useEffect(() => {
    let active = true;
    readPreference().then((saved) => {
      if (!active) return;
      setPreferenceState(saved);
      applyToNative(saved);
    });
    return () => {
      active = false;
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    applyToNative(next);
    writePreference(next);
  }, []);

  // The saved choice wins over the phone's setting; "system" follows the phone.
  const scheme: ColorScheme =
    preference === 'system' ? (phoneScheme === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo(
    () => ({ preference, setPreference, scheme, tokens: Tokens[scheme] }),
    [preference, setPreference, scheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Theme state for screens inside <ThemeProvider>. Null outside it. */
export function useThemeContext(): ThemeContextValue | null {
  return useContext(ThemeContext);
}
