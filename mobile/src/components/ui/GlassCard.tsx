import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type GlassCardProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Denser fill for surfaces that carry a lot of text (sheets, bottom bars). */
  strong?: boolean;
  /** Inner padding. Default 14, as in the mocks. */
  padding?: number;
  radius?: number;
};

/**
 * The frosted surface used for cards, fields and bars.
 *
 * iOS: a live blur of what's behind it plus the glass tint.
 * Android: the same tint and border without the live blur, because blurring
 * behind scrolling lists is slow there. Over the ambient background the two
 * look nearly the same.
 */
export function GlassCard({ children, style, strong = false, padding = 14, radius = Radius.card }: GlassCardProps) {
  const { scheme, tokens } = useTheme();

  const surface: ViewStyle = {
    borderRadius: radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.glassLine,
    // Soft drop shadow plus the 1px inner highlight along the top edge.
    boxShadow: `0px 14px 30px -20px ${tokens.shadow}, inset 0px 1px 0px ${tokens.glassHighlight}`,
  };

  const fill = strong ? tokens.glassStrong : tokens.glass;

  if (Platform.OS === 'ios') {
    // Outer view carries the shadow; the inner one clips the blur to the
    // rounded corners (overflow: hidden would also clip the shadow).
    return (
      <View style={[{ borderRadius: radius, boxShadow: surface.boxShadow }, style]}>
        <View
          style={[
            styles.clip,
            { borderRadius: radius, borderWidth: surface.borderWidth, borderColor: surface.borderColor },
          ]}
        >
          <BlurView
            intensity={40}
            tint={scheme === 'dark' ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />
          <View style={{ padding }}>{children}</View>
        </View>
      </View>
    );
  }

  return <View style={[surface, { backgroundColor: fill, padding }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
});
