import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { AppText } from './AppText';
import { IconButton } from './IconButton';

type BottomSheetProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  /** Small action on the right of the title, e.g. a "Reset" text button. */
  headerAction?: ReactNode;
  /** Scrollable content. */
  children: ReactNode;
  /** Fixed at the bottom, usually the Apply <Button />. */
  footer?: ReactNode;
  /** Fraction of the screen the sheet may take. Default 0.88. */
  maxHeight?: number;
};

/**
 * A bottom panel for pickers and filters (plan 05b: the trip and filter
 * pickers become bottom panels with an Apply button). Tapping outside,
 * the close button or Android Back dismisses without applying.
 * For yes/no decisions use ConfirmSheet instead.
 */
export function BottomSheet({
  visible,
  title,
  subtitle,
  onClose,
  headerAction,
  children,
  footer,
  maxHeight = 0.88,
}: BottomSheetProps) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: tokens.scrim }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              maxHeight: `${Math.round(maxHeight * 100)}%`,
              backgroundColor: tokens.background,
              borderColor: tokens.glassLine,
            },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: tokens.line }]} />

          <View style={styles.header}>
            <View style={styles.headerText}>
              <AppText variant="title" accessibilityRole="header">
                {title}
              </AppText>
              {subtitle ? <AppText variant="caption">{subtitle}</AppText> : null}
            </View>
            {headerAction}
            <IconButton icon="close" label="Close" onPress={onClose} />
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>

          {footer ? (
            <View
              style={[
                styles.footer,
                { borderTopColor: tokens.line, paddingBottom: Math.max(insets.bottom, 12) + 8 },
              ]}
            >
              {footer}
            </View>
          ) : (
            <View style={{ height: Math.max(insets.bottom, 12) }} />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: Radius.hero,
    borderTopRightRadius: Radius.hero,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  scroll: {
    flexGrow: 0,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 18,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
});
