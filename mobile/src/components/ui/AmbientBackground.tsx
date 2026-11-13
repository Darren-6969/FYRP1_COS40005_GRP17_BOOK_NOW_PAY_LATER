import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

const SOURCES = {
  light: require('@/assets/images/ambient-light.webp'),
  dark: require('@/assets/images/ambient-dark.webp'),
} as const;

/**
 * The soft green ambient backdrop from the mocks. Pre-rendered images
 * (scripts/generate-ambient-backgrounds.py), so no gradient library is
 * needed and nothing re-renders while screens scroll.
 *
 * Mounted once behind the navigator (phase 1), with transparent screens
 * on top. Both images stay mounted so switching scheme doesn't flash.
 */
export function AmbientBackground() {
  const { scheme, tokens } = useTheme();

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: tokens.background }]}
    >
      <Image
        source={SOURCES.light}
        style={[StyleSheet.absoluteFill, { opacity: scheme === 'light' ? 1 : 0 }]}
        contentFit="cover"
        transition={0}
        accessible={false}
      />
      <Image
        source={SOURCES.dark}
        style={[StyleSheet.absoluteFill, { opacity: scheme === 'dark' ? 1 : 0 }]}
        contentFit="cover"
        transition={0}
        accessible={false}
      />
    </View>
  );
}
