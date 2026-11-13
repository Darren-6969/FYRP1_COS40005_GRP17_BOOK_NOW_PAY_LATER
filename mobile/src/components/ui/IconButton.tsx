import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

type IconButtonProps = {
  icon: IconName;
  /** Required: icon-only buttons are unnamed to screen readers otherwise. */
  label: string;
  onPress?: () => void;
  /** "glass" on the ambient background, "onHero" inside the dark hero card. */
  variant?: 'glass' | 'onHero';
  /** Small orange dot, e.g. unread notifications. */
  dot?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Round 44pt icon button (back, notifications, refresh). */
export function IconButton({ icon, label, onPress, variant = 'glass', dot = false, disabled = false, style }: IconButtonProps) {
  const { tokens } = useTheme();
  const onHero = variant === 'onHero';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={dot ? `${label}, new` : label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        onHero
          ? { backgroundColor: 'rgba(255,255,255,0.1)' }
          : {
              backgroundColor: tokens.glass,
              borderColor: tokens.glassLine,
              borderWidth: StyleSheet.hairlineWidth,
              boxShadow: `inset 0px 1px 0px ${tokens.glassHighlight}`,
            },
        { opacity: disabled ? 0.45 : pressed ? 0.7 : 1 },
        style,
      ]}
    >
      <Ionicons name={icon} size={21} color={onHero ? tokens.onHero : tokens.ink} />
      {dot ? <View style={[styles.dot, { backgroundColor: tokens.cta }]} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: TouchTarget,
    height: TouchTarget,
    borderRadius: TouchTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
