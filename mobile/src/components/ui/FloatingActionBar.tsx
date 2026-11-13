import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type FloatingActionBarProps = {
  /** Left side: usually a label and a <Money />. */
  children?: ReactNode;
  /** Right side: the main <Button />. */
  action: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Space a scroll view needs at the bottom so content isn't hidden by the bar. */
export const FLOATING_BAR_CLEARANCE = 110;

/**
 * The pill-shaped bar that floats over the bottom of car detail, review and
 * checkout, like the nav bar. Place it last in the screen, outside the
 * ScrollView, and give the ScrollView bottom padding of
 * FLOATING_BAR_CLEARANCE plus the safe-area inset.
 */
export function FloatingActionBar({ children, action, style }: FloatingActionBarProps) {
  const { scheme, tokens } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.wrap,
        { bottom: Math.max(insets.bottom, 12) + 12, boxShadow: `0px 14px 30px -20px ${tokens.shadow}` },
        style,
      ]}
    >
      <View style={[styles.bar, { borderColor: tokens.glassLine }]}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={50} tint={scheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        ) : null}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: tokens.glassStrong }]} />
        <View style={styles.content}>
          <View style={styles.left}>{children}</View>
          {action}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderRadius: Radius.pill,
  },
  bar: {
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingRight: 10,
    paddingLeft: 18,
  },
  left: {
    flex: 1,
    minWidth: 0,
  },
});
