import { Ionicons } from '@expo/vector-icons';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { AppText } from './AppText';

export type ToastTone = 'ok' | 'info' | 'err';

type ToastOptions = {
  tone?: ToastTone;
  /** Milliseconds on screen. Default 3000 (rule 05b: about 3 seconds). */
  duration?: number;
};

type ToastState = { id: number; message: string; tone: ToastTone; duration: number };

type ToastContextValue = {
  show: (message: string, options?: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS = {
  ok: 'checkmark-circle',
  info: 'information-circle',
  err: 'alert-circle',
} as const;

/**
 * Short feedback after an action ("Saved", "Receipt sent"), replacing
 * Alert.alert for anything that needs no decision (rule 05b). One at a time;
 * a new toast replaces the current one. Tap to dismiss early.
 * Mounted once in app/_layout.tsx.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const nextId = useRef(1);

  const show = useCallback((message: string, options?: ToastOptions) => {
    setToast({ id: nextId.current++, message, tone: options?.tone ?? 'ok', duration: options?.duration ?? 3000 });
    // Screen readers hear it even though it doesn't take focus.
    AccessibilityInfo.announceForAccessibility(message);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? <ToastView key={toast.id} toast={toast} onDone={() => setToast(null)} /> : null}
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onDone }: { toast: ToastState; onDone: () => void }) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;

  const hide = useCallback(() => {
    Animated.timing(progress, { toValue: 0, duration: 180, easing: Easing.in(Easing.ease), useNativeDriver: true }).start(
      () => onDone()
    );
  }, [onDone, progress]);

  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 220, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
    const timer = setTimeout(hide, toast.duration);
    return () => clearTimeout(timer);
  }, [hide, progress, toast.duration]);

  const fg = { ok: tokens.okFg, info: tokens.infoFg, err: tokens.errFg }[toast.tone];

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          top: insets.top + 8,
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
        },
      ]}
    >
      <Pressable
        onPress={hide}
        accessibilityRole="button"
        accessibilityLabel={`${toast.message}. Dismiss`}
        style={[
          styles.toast,
          {
            backgroundColor: tokens.background,
            borderColor: tokens.glassLine,
            boxShadow: `0px 14px 30px -18px ${tokens.shadow}`,
          },
        ]}
      >
        <Ionicons name={ICONS[toast.tone]} size={20} color={fg} />
        <AppText variant="label" color="ink" style={styles.text} numberOfLines={3}>
          {toast.message}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}

/** `const toast = useToast(); toast.show('Saved');` */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 480,
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: {
    flexShrink: 1,
  },
});
