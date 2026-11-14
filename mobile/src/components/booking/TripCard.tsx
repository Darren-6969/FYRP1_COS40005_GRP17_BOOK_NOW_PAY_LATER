import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText, GlassCard } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { formatMYT, mytToIso } from '@/utils/datetime';

type TripCardProps = {
  /** "2026-12-15" */
  fromDate?: string | null;
  /** "10:00" */
  fromTime?: string | null;
  toDate?: string | null;
  toTime?: string | null;
  /** Makes the card a button, e.g. to open the trip picker. */
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

function Side({ label, date, time }: { label: string; date?: string | null; time?: string | null }) {
  const iso = date ? mytToIso(date, time || '10:00') : null;

  return (
    <View style={styles.side}>
      <AppText variant="caption">{label}</AppText>
      {iso ? (
        <>
          <AppText variant="bodyStrong" numberOfLines={1} style={styles.tabular}>
            {formatMYT(iso, 'dayDate')}
          </AppText>
          <AppText variant="caption" color="text" style={styles.tabular}>
            {formatMYT(iso, 'time')}
          </AppText>
        </>
      ) : (
        <AppText variant="bodyStrong" color="label">
          Add date
        </AppText>
      )}
    </View>
  );
}

/** Pick-up → Return on a frosted card (Home, car details, review). */
export function TripCard({ fromDate, fromTime, toDate, toTime, onPress, style }: TripCardProps) {
  const { tokens } = useTheme();

  const summary =
    fromDate && toDate
      ? `Pick-up ${formatMYT(mytToIso(fromDate, fromTime || '10:00'), 'dayDateTime')}, return ${formatMYT(
          mytToIso(toDate, toTime || '10:00'),
          'dayDateTime'
        )}`
      : 'Trip dates not set';

  const body = (
    <GlassCard style={style}>
      <View style={styles.row}>
        <Side label="Pick-up" date={fromDate} time={fromTime} />
        <Ionicons name="arrow-forward" size={17} color={tokens.label} />
        <Side label="Return" date={toDate} time={toTime} />
        {onPress ? <Ionicons name="create-outline" size={18} color={tokens.leafInk} /> : null}
      </View>
    </GlassCard>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={summary}>
        {body}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${summary}. Change dates`}
      style={({ pressed }) => pressed && { opacity: 0.85 }}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  side: {
    flex: 1,
    gap: 2,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
});
