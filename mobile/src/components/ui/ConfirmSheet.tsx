import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { describeError } from '@/utils/errors';

import { AppText } from './AppText';
import { Button } from './Button';
import { useResetOnChange } from '@/hooks/use-reset-on-change';

type ConfirmSheetProps = {
  visible: boolean;
  title: string;
  /** One or two sentences on what will happen. */
  message?: string;
  /** Extra content between the message and the buttons, e.g. the refund amount. */
  children?: ReactNode;
  /**
   * Says exactly what happens: "Cancel booking", "Reject request".
   * Never "OK" or "Yes" (rule 05b).
   */
  confirmLabel: string;
  /** "danger" for things that can't be undone. Default "brand". */
  confirmVariant?: 'brand' | 'danger' | 'cta';
  /** Default "Go back". */
  cancelLabel?: string;
  /**
   * May return a promise. The confirm button shows a spinner until it
   * settles; on failure the error is shown in the sheet and it stays open.
   * Close the sheet yourself (visible=false) when it succeeds.
   */
  onConfirm: () => unknown;
  onCancel: () => void;
};

/**
 * Bottom sheet for decisions with consequences (rule 05b), replacing
 * Alert.alert confirmations. Tapping outside or Android back cancels,
 * except while the action is running.
 */
export function ConfirmSheet({
  visible,
  title,
  message,
  children,
  confirmLabel,
  confirmVariant = 'brand',
  cancelLabel = 'Go back',
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // Cleared whenever it closes, ready for the next time.
  useResetOnChange(visible, () => {
    if (!visible) {
      setError(null);
      setBusy(false);
    }
  });

  const dismiss = () => {
    if (!busy) onCancel();
  };

  const confirm = async () => {
    setError(null);
    setBusy(true);
    try {
      await onConfirm();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const errorInfo = error ? describeError(error) : null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={dismiss}>
      {/* Same keyboard handling as BottomSheet: a reason or note field stays above the keyboard. */}
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: tokens.scrim }]}
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: tokens.background,
              borderColor: tokens.glassLine,
              paddingBottom: Math.max(insets.bottom, 16) + 8,
            },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: tokens.line }]} />
          {/* Scrolls when the content is taller than the screen, e.g. at the largest text size. */}
          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <AppText variant="title" accessibilityRole="header">
            {title}
          </AppText>
          {message ? <AppText style={styles.message}>{message}</AppText> : null}
          {children ? <View style={styles.children}>{children}</View> : null}

          {errorInfo ? (
            <View style={[styles.error, { backgroundColor: tokens.errBg }]} accessibilityRole="alert">
              <AppText variant="label" style={{ color: tokens.errFg }}>
                {errorInfo.title}
              </AppText>
              <AppText variant="caption" style={{ color: tokens.errFg }}>
                {errorInfo.message}
              </AppText>
            </View>
          ) : null}
          </ScrollView>

          <View style={styles.buttons}>
            <Button label={confirmLabel} variant={confirmVariant} loading={busy} onPress={confirm} />
            <Button label={cancelLabel} variant="line" disabled={busy} onPress={dismiss} />
          </View>
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
  scroll: {
    flexGrow: 0,
  },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: Radius.hero,
    borderTopRightRadius: Radius.hero,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 10,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    marginBottom: 8,
  },
  message: {
    marginTop: -2,
  },
  children: {
    marginTop: 4,
  },
  error: {
    borderRadius: Radius.sm,
    padding: 12,
    gap: 2,
  },
  buttons: {
    gap: 10,
    marginTop: 8,
  },
});
