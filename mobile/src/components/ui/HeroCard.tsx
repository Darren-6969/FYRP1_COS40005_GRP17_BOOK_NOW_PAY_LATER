import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { AppText } from './AppText';

type HeroCardProps = {
  children?: ReactNode;
  /** Small pill at the top with a leaf dot, e.g. "Next payment". */
  tag?: string;
  /** Element in the top-right corner, e.g. an IconButton with variant "onHero". */
  corner?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * The dark green card at the top of Home, booking detail and the operator
 * dashboard. Drawn with native gradients (React Native backgroundImage),
 * so no gradient package is needed. Text inside uses onHero / onHeroSoft.
 */
export function HeroCard({ children, tag, corner, style }: HeroCardProps) {
  const { tokens } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundImage: [
            'radial-gradient(120% 90% at 100% 0%, rgba(166,227,184,0.22) 0%, rgba(166,227,184,0) 55%)',
            `linear-gradient(160deg, ${tokens.heroFrom} 0%, ${tokens.heroTo} 100%)`,
          ].join(', '),
          backgroundColor: tokens.heroTo,
          boxShadow: '0px 20px 40px -24px rgba(20,35,31,0.7), inset 0px 1px 0px rgba(255,255,255,0.12)',
        },
        style,
      ]}
    >
      {tag || corner ? (
        <View style={styles.top}>
          {tag ? (
            <View style={styles.tag}>
              <View style={[styles.leaf, { backgroundColor: tokens.leaf }]} />
              <AppText variant="caption" style={{ color: tokens.onHero }}>
                {tag}
              </AppText>
            </View>
          ) : (
            <View />
          )}
          {corner}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.hero,
    padding: 16,
    gap: 12,
    overflow: 'hidden',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  leaf: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
});
