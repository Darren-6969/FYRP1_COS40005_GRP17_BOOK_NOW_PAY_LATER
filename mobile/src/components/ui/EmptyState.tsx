import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

import { AppText } from './AppText';

type EmptyStateProps = {
  icon?: ComponentProps<typeof Ionicons>['name'];
  title: string;
  /** One sentence on why it's empty or what to do. */
  message?: string;
  /** Optional <Button /> that gets the customer moving, e.g. "Browse cars". */
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** "Nothing here yet" for lists. For failed loads use ErrorState (unit 4). */
export function EmptyState({ icon = 'albums-outline', title, message, action, style }: EmptyStateProps) {
  const { tokens } = useTheme();

  return (
    <View style={[styles.wrap, style]}>
      <View style={[styles.icon, { backgroundColor: tokens.glassStrong, borderColor: tokens.glassLine }]}>
        <Ionicons name={icon} size={28} color={tokens.leafInk} />
      </View>
      <AppText variant="headline" align="center">
        {title}
      </AppText>
      {message ? (
        <AppText variant="caption" align="center" style={styles.message}>
          {message}
        </AppText>
      ) : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 8,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  message: {
    maxWidth: 300,
  },
  action: {
    marginTop: 10,
  },
});
