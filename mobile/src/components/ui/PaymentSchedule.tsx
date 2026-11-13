import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { MoneyInput } from '@/utils/money';

import { AppText } from './AppText';
import { Money } from './Money';

export type ScheduleStepState = 'done' | 'now' | 'upcoming';

export type ScheduleStep = {
  key: string;
  /** "Down payment", "Balance", "Pick-up". */
  title: string;
  /** "Paid 14 Nov" or "Due Sat, 21 Nov, 10:00 am" (use formatMYT). */
  caption?: string;
  /** Server amount; omit for steps without money (pick-up). */
  amount?: MoneyInput;
  state: ScheduleStepState;
};

type PaymentScheduleProps = {
  steps: readonly ScheduleStep[];
};

/**
 * The numbered "what happens next" list on booking detail and checkout.
 * Display only: steps, states and amounts all come from the server.
 */
export function PaymentSchedule({ steps }: PaymentScheduleProps) {
  const { tokens } = useTheme();

  return (
    <View accessibilityRole="list">
      {steps.map((step, index) => {
        const done = step.state === 'done';
        const now = step.state === 'now';

        const badge = done
          ? { bg: tokens.okBg, fg: tokens.okFg, border: 'transparent' }
          : now
            ? { bg: tokens.cta, fg: tokens.onCta, border: 'transparent' }
            : { bg: tokens.glassStrong, fg: tokens.ink, border: tokens.glassLine };

        const stateWord = done ? 'done' : now ? 'next' : 'upcoming';

        return (
          <View
            key={step.key}
            accessible
            accessibilityLabel={[`Step ${index + 1}, ${stateWord}`, step.title, step.caption]
              .filter(Boolean)
              .join('. ')}
            style={[styles.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.line }]}
          >
            <View style={[styles.badge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
              {done ? (
                <Ionicons name="checkmark" size={15} color={badge.fg} />
              ) : (
                <AppText style={{ color: badge.fg, fontFamily: FontFamily.monoMedium, fontSize: 12 }}>
                  {index + 1}
                </AppText>
              )}
            </View>

            <View style={styles.body}>
              <AppText variant="headline" style={{ fontSize: 15 }}>
                {step.title}
              </AppText>
              {step.caption ? <AppText variant="caption">{step.caption}</AppText> : null}
            </View>

            {step.amount !== undefined ? (
              <Money value={step.amount} color={done ? 'label' : 'ink'} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 11,
  },
  badge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 2,
    paddingTop: 4,
  },
});
