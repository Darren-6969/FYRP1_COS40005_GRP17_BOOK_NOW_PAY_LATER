import { AppText, type AppTextProps } from './AppText';

type FigureProps = Omit<AppTextProps, 'variant'> & {
  /** "xl" for the hero number on a screen (countdowns), "l" for the rest. */
  size?: 'xl' | 'l';
};

/**
 * Light, large numbers: countdowns, amounts in hero cards, counts.
 * Tabular digits so values don't shift as they tick.
 */
export function Figure({ size = 'l', style, ...rest }: FigureProps) {
  return (
    <AppText
      variant={size === 'xl' ? 'figureXL' : 'figureL'}
      style={[{ fontVariant: ['tabular-nums'] }, style]}
      {...rest}
    />
  );
}
