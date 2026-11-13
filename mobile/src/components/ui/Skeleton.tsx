import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Grey placeholder shown while data loads, in the shape of what's coming.
 * Pulses gently; holds still when the phone's Reduce Motion setting is on.
 */
export function Skeleton({ width = '100%', height = 16, radius = 8, style }: SkeletonProps) {
  const { tokens } = useTheme();
  const opacity = useRef(new Animated.Value(0.55)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(0.7);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.55, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reduceMotion]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: radius, backgroundColor: tokens.neutralBg, opacity }, style]}
    />
  );
}

/** A few lines of placeholder text; the last one is shorter. */
export function SkeletonText({ lines = 3, style }: { lines?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[{ gap: 8 }, style]}
      accessible
      accessibilityLabel="Loading"
      accessibilityState={{ busy: true }}
    >
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} height={13} width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </View>
  );
}
