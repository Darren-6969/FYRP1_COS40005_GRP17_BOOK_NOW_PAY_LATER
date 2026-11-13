import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius } from '@/constants/theme';
import { bookingStatus, paymentStatus, toneColors, type StatusTone } from '@/constants/status';
import { useTheme } from '@/hooks/use-theme';

import { AppText } from './AppText';

type StatusPillProps = (
  | {
      /** A BookingStatus or PaymentStatus value from the server. */
      status: string | null | undefined;
      kind?: 'booking' | 'payment';
      label?: never;
      tone?: never;
    }
  | {
      /** Free-form pill, e.g. "Due in 3 days". */
      label: string;
      tone: StatusTone;
      status?: never;
      kind?: never;
    }
) & {
  /** Leading dot. Default true. */
  dot?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Coloured status label. Unknown statuses get a neutral pill (F10). */
export function StatusPill(props: StatusPillProps) {
  const { tokens } = useTheme();
  const { dot = true, style } = props;

  const info =
    props.label !== undefined
      ? { label: props.label, tone: props.tone }
      : props.kind === 'payment'
        ? paymentStatus(props.status)
        : bookingStatus(props.status);

  const { bg, fg } = toneColors(info.tone, tokens);

  return (
    <View style={[styles.pill, { backgroundColor: bg }, style]} accessibilityRole="text">
      {dot ? <View style={[styles.dot, { backgroundColor: fg }]} /> : null}
      <AppText variant="micro" numberOfLines={1} style={{ color: fg, fontSize: 12.5 }}>
        {info.label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    minHeight: 26,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
