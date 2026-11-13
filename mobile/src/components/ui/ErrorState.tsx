import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ERROR_CODES } from '@/services/api';
import { useTheme } from '@/hooks/use-theme';
import { describeError } from '@/utils/errors';

import { AppText } from './AppText';
import { Button } from './Button';
import { GlassCard } from './GlassCard';

type ErrorStateProps = {
  /** Whatever the failed request threw. */
  error: unknown;
  /** Shown as a Retry button when the error is retryable. May return a promise. */
  onRetry?: () => unknown;
  /** Smaller card for a failed section inside a screen, instead of the whole screen. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * A failed request, shown in place of the content it was loading
 * (rule 05b: failed requests get an inline error with Retry, not an alert).
 */
export function ErrorState({ error, onRetry, compact = false, style }: ErrorStateProps) {
  const { tokens } = useTheme();
  const info = describeError(error);

  const icon =
    info.code === ERROR_CODES.NETWORK
      ? 'cloud-offline-outline'
      : info.code === ERROR_CODES.TIMEOUT
        ? 'time-outline'
        : 'alert-circle-outline';

  const content = (
    <View style={[styles.inner, compact && styles.innerCompact]} accessibilityRole="alert">
      <View style={[styles.icon, compact && styles.iconCompact, { backgroundColor: tokens.errBg }]}>
        <Ionicons name={icon} size={compact ? 20 : 28} color={tokens.errFg} />
      </View>
      <View style={compact ? styles.textCompact : styles.text}>
        <AppText variant="headline" align={compact ? 'left' : 'center'}>
          {info.title}
        </AppText>
        <AppText variant="caption" align={compact ? 'left' : 'center'}>
          {info.message}
        </AppText>
        {info.requestId ? (
          <AppText variant="mono" color="label" align={compact ? 'left' : 'center'} style={styles.ref} selectable>
            Ref {info.requestId.slice(0, 8)}
          </AppText>
        ) : null}
      </View>
      {onRetry && info.retryable ? (
        <Button label="Try again" icon="refresh" variant="line" size="sm" onPress={onRetry} />
      ) : null}
    </View>
  );

  return compact ? (
    <GlassCard style={style}>{content}</GlassCard>
  ) : (
    <View style={[styles.full, style]}>{content}</View>
  );
}

const styles = StyleSheet.create({
  full: {
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  inner: {
    alignItems: 'center',
    gap: 10,
  },
  innerCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCompact: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  text: {
    alignItems: 'center',
    gap: 4,
    maxWidth: 320,
  },
  textCompact: {
    flex: 1,
    gap: 2,
  },
  ref: {
    fontSize: 11,
    marginTop: 2,
  },
});
