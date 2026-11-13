import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

import { AppText } from './AppText';

/**
 * A form error, shown directly under the field it's about
 * (rule 05b: never an alert). Renders nothing when there's no message.
 */
export function FieldError({ message }: { message?: string | null }) {
  const { tokens } = useTheme();
  if (!message) return null;

  return (
    <View style={styles.row} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Ionicons name="alert-circle" size={14} color={tokens.errFg} />
      <AppText variant="caption" style={{ color: tokens.errFg, flex: 1 }}>
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 4,
  },
});
