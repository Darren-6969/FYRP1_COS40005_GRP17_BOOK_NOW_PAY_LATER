import { Text, type TextProps } from 'react-native';

import { Type, type ThemeTokens, type TypeVariant } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** A colour from the theme, by name. */
export type ColorToken = {
  [K in keyof ThemeTokens]: ThemeTokens[K] extends string ? K : never;
}[keyof ThemeTokens];

export type AppTextProps = TextProps & {
  /** Size and weight from the type scale. Default "body". */
  variant?: TypeVariant;
  /** Theme colour name. Default: "ink" for titles, "text" for body, "label" for captions. */
  color?: ColorToken;
  align?: 'left' | 'center' | 'right';
};

const DEFAULT_COLOR: Partial<Record<TypeVariant, ColorToken>> = {
  largeTitle: 'ink',
  title: 'ink',
  headline: 'ink',
  bodyStrong: 'ink',
  figureXL: 'ink',
  figureL: 'ink',
  caption: 'label',
  micro: 'label',
  label: 'label',
};

/**
 * All text in redesigned screens. Picks the font family per weight (Geist),
 * so it never sets fontWeight, which Android would ignore for custom fonts.
 * Large accessibility text sizes are allowed up to 1.4x so layouts hold.
 */
export function AppText({
  variant = 'body',
  color,
  align,
  style,
  maxFontSizeMultiplier = 1.4,
  ...rest
}: AppTextProps) {
  const { tokens } = useTheme();
  const colorName = color ?? DEFAULT_COLOR[variant] ?? 'text';

  return (
    <Text
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[Type[variant], { color: tokens[colorName] }, align ? { textAlign: align } : null, style]}
      {...rest}
    />
  );
}
