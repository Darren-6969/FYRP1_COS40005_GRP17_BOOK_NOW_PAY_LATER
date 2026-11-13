import { formatRM, formatSen, type MoneyInput } from '@/utils/money';

import { AppText, type AppTextProps } from './AppText';

type MoneyProps = Omit<AppTextProps, 'children'> &
  (
    | {
        /** A server amount in ringgit: Decimal string ("340.00") or number. */
        value: MoneyInput;
        sen?: never;
      }
    | {
        /** A server amount in integer sen. */
        sen: number | null | undefined;
        value?: never;
      }
  ) & {
    /** Shown when the amount is missing. Default "—". */
    fallback?: string;
  };

/**
 * F16: shows an amount the server computed. It formats and never calculates,
 * so the app can't disagree with the server about money.
 */
export function Money({ value, sen, fallback = '—', variant = 'bodyStrong', style, ...rest }: MoneyProps) {
  const text = sen !== undefined ? formatSen(sen, fallback) : formatRM(value, fallback);

  return (
    <AppText variant={variant} style={[{ fontVariant: ['tabular-nums'] }, style]} {...rest}>
      {text}
    </AppText>
  );
}
