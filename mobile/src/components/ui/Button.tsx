import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { FontFamily, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { logger } from '@/utils/logger';

import { AppText } from './AppText';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type ButtonVariant =
  /** Request and Pay only (decision 3). */
  | 'cta'
  /** Every other primary action. */
  | 'brand'
  /** Secondary action on a glass surface. */
  | 'line'
  /** Destructive confirmation only (ConfirmSheet: "Cancel booking"). */
  | 'danger'
  /** Low-emphasis action, no fill. */
  | 'text';

type ButtonProps = {
  label: string;
  /**
   * May return a promise. While it runs the button shows a spinner and
   * ignores further taps (F17), so a double tap can't fire it twice.
   */
  onPress?: () => unknown;
  variant?: ButtonVariant;
  /** "md" is 50pt tall, "sm" 44pt (the minimum touch target). */
  size?: 'md' | 'sm';
  /** Show the spinner and block taps, for work started elsewhere. */
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  iconPosition?: 'start' | 'end';
  /** Stretch to fill a row. */
  grow?: boolean;
  /** Spoken label when it differs from the visible one. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  onPress,
  variant = 'brand',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'start',
  grow = false,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const { tokens } = useTheme();
  const [running, setRunning] = useState(false);
  // A ref, not state: a second tap in the same frame sees it immediately.
  const lock = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const busy = loading || running;
  const inactive = disabled || busy;

  const handlePress = async () => {
    if (lock.current || inactive || !onPress) return;
    lock.current = true;
    try {
      const result = onPress();
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        setRunning(true);
        await result;
      }
    } catch (err) {
      // The screen shows its own error; this only stops an unhandled rejection.
      logger.warn('[Button] action failed', err);
    } finally {
      lock.current = false;
      if (mounted.current) setRunning(false);
    }
  };

  const palette = {
    cta: { bg: tokens.cta, fg: tokens.onCta, border: 'transparent' },
    brand: { bg: tokens.brand, fg: tokens.onBrand, border: 'transparent' },
    line: { bg: tokens.glassStrong, fg: tokens.ink, border: tokens.glassLine },
    danger: { bg: tokens.errFg, fg: tokens.background, border: 'transparent' },
    text: { bg: 'transparent', fg: tokens.leafInk, border: 'transparent' },
  }[variant];

  const height = size === 'md' ? 50 : 44;
  const iconNode = icon ? <Ionicons name={icon} size={size === 'md' ? 19 : 17} color={palette.fg} /> : null;

  return (
    <Pressable
      onPress={handlePress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy }}
      hitSlop={size === 'sm' ? 4 : 0}
      style={({ pressed }) => [
        styles.base,
        {
          height,
          paddingHorizontal: variant === 'text' ? 10 : size === 'md' ? 20 : 16,
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderWidth: variant === 'line' ? StyleSheet.hairlineWidth : 0,
          opacity: disabled && !busy ? 0.45 : 1,
          transform: [{ scale: pressed && !inactive ? 0.98 : 1 }],
        },
        grow && styles.grow,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.row}>
          {iconPosition === 'start' && iconNode}
          <AppText
            numberOfLines={1}
            style={{ color: palette.fg, fontFamily: FontFamily.semibold, fontSize: size === 'md' ? 15.5 : 14.5 }}
          >
            {label}
          </AppText>
          {iconPosition === 'end' && iconNode}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  grow: {
    flex: 1,
  },
});
