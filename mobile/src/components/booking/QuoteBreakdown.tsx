import { StyleSheet, View } from 'react-native';

import { AppText, Money, type ScheduleStep } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { formatMYT } from '@/utils/datetime';
import { formatSen } from '@/utils/money';

const PERIOD_NAME: Record<string, [string, string]> = {
  hour: ['hour', 'hours'],
  day: ['day', 'days'],
  week: ['week', 'weeks'],
  month: ['month', 'months'],
};

function Line({ label, sen }: { label: string; sen: number }) {
  return (
    <View style={styles.between}>
      <AppText style={styles.flex}>{label}</AppText>
      <Money sen={sen} variant="body" color="ink" />
    </View>
  );
}

/**
 * The server's quote, line by line, with its total (F16: shown as-is, never
 * re-added in the app). `quote` is the `quote` object from
 * POST /public/cars/:id/quote.
 */
export function QuoteBreakdown({ quote: q }: { quote: any }) {
  const { tokens } = useTheme();
  const extraHours = q.hours % 24;

  return (
    <View style={styles.gap}>
      <AppText variant="headline">
        Price for {q.days} {q.days === 1 ? 'day' : 'days'}
        {extraHours ? ` ${extraHours} h` : ''}
      </AppText>
      {(q.rateLines || []).map((line: any, i: number) => {
        const [one, many] = PERIOD_NAME[line.period] || [line.period, line.period];
        return (
          <Line
            key={`rate-${i}`}
            label={`${line.count} ${line.count === 1 ? one : many} × ${formatSen(line.rateSen)}`}
            sen={line.amountSen}
          />
        );
      })}
      {q.overtimeSen > 0 ? <Line label="Night pick-up or return" sen={q.overtimeSen} /> : null}
      {q.youngDriverSurchargeSen > 0 ? <Line label="Young driver surcharge" sen={q.youngDriverSurchargeSen} /> : null}
      {q.pickupFeeSen > 0 ? <Line label={`Pick-up · ${q.pickupPoint?.label || 'point'}`} sen={q.pickupFeeSen} /> : null}
      {q.dropoffFeeSen > 0 ? <Line label={`Drop-off · ${q.dropoffPoint?.label || 'point'}`} sen={q.dropoffFeeSen} /> : null}
      {(q.addOnLines || []).map((line: any) => (
        <Line key={`addon-${line.id}`} label={line.label} sen={line.amountSen} />
      ))}
      <View style={[styles.rule, { backgroundColor: tokens.line }]} />
      <View style={styles.between}>
        <AppText variant="bodyStrong">Total</AppText>
        <Money sen={q.totalSen} />
      </View>
    </View>
  );
}

/** "How you'll pay": request, down payment, balance, from the quote. */
export function paymentStepsFromQuote(q: any, car: any): ScheduleStep[] {
  const operator = car?.operator?.companyName || 'The operator';
  const replyHours = car?.booking?.responseWindowHours;
  return [
    {
      key: 'request',
      title: 'Request',
      caption: replyHours ? `${operator} replies within ${replyHours} hours` : 'The operator accepts or suggests an alternative',
      amountSen: 0,
      state: 'now',
    },
    {
      key: 'down',
      title: `Down payment · ${q.depositPct}%`,
      caption: q.depositWindowHours ? `Due within ${q.depositWindowHours} hours of acceptance` : 'Due after the operator accepts',
      amountSen: q.depositSen,
      state: 'upcoming',
    },
    {
      key: 'balance',
      title: 'Balance',
      caption: q.balanceDueAt ? `Due ${formatMYT(q.balanceDueAt, 'dayDateTime')}` : 'Due before pick-up',
      amountSen: q.balanceSen,
      state: 'upcoming',
    },
  ];
}

const styles = StyleSheet.create({
  gap: {
    gap: 10,
  },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  flex: {
    flex: 1,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 2,
  },
});
