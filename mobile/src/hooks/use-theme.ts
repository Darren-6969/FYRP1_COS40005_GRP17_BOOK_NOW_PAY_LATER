/**
 * The current theme: the redesign tokens plus the saved preference.
 * Screens read `tokens`, and `scheme`, `preference`, `setPreference`.
 */

import { Tokens, type ColorScheme } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeContext, type ThemePreference } from '@/providers/theme-provider';

const noop = () => {};

export function useTheme() {
  const context = useThemeContext();
  const phoneScheme = useColorScheme();

  // Outside <ThemeProvider> (should not happen once app/_layout wraps the
  // tree) fall back to the phone's setting.
  const scheme: ColorScheme = context?.scheme ?? (phoneScheme === 'dark' ? 'dark' : 'light');

  return {
    scheme,
    tokens: context?.tokens ?? Tokens[scheme],
    preference: (context?.preference ?? 'system') as ThemePreference,
    setPreference: context?.setPreference ?? noop,
  };
}
