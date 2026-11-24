import { useRef, useState, type ComponentRef } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { AppText, FieldError } from "@/components/ui";
import { FontFamily, Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export const CODE_LENGTH = 6;

/**
 * A 6-digit email code: one real input (so paste, SMS/email autofill and
 * screen readers work) shown as six cells on the same frosted surface as
 * TextField. Calls onComplete once all six digits are in.
 */
export function CodeInput({
  value,
  onChange,
  onComplete,
  error,
  label = "Code",
  autoFocus = true,
}: {
  value: string;
  onChange: (code: string) => void;
  onComplete?: (code: string) => void;
  error?: string | null;
  label?: string;
  autoFocus?: boolean;
}) {
  const { tokens } = useTheme();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(false);

  const change = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, CODE_LENGTH);
    onChange(digits);
    if (digits.length === CODE_LENGTH) onComplete?.(digits);
  };

  return (
    <View style={styles.wrap}>
      <AppText variant="label" color="ink">
        {label}
      </AppText>
      <Pressable onPress={() => input.current?.focus()} accessible={false} style={styles.row}>
        {Array.from({ length: CODE_LENGTH }, (_, i) => {
          const active = focused && (i === value.length || (i === CODE_LENGTH - 1 && value.length === CODE_LENGTH));
          return (
            <View
              key={i}
              style={[
                styles.cell,
                {
                  backgroundColor: tokens.glass,
                  borderColor: error ? tokens.errFg : active ? tokens.brand : tokens.glassLine,
                  borderWidth: error || active ? 1.5 : StyleSheet.hairlineWidth,
                },
              ]}
            >
              <AppText style={[styles.digit, { color: tokens.ink }]}>{value[i] ?? ""}</AppText>
            </View>
          );
        })}
      </Pressable>
      {/* The real field sits over the cells, invisible, so taps and paste land in it. */}
      <TextInput
        ref={input}
        value={value}
        onChangeText={change}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH}
        accessibilityLabel={`${label}, ${CODE_LENGTH} digits`}
        accessibilityHint={error || undefined}
        caretHidden
        style={styles.hidden}
      />
      <FieldError message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  cell: {
    flex: 1,
    height: 56,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  digit: {
    fontFamily: FontFamily.semibold,
    fontSize: 22,
  },
  hidden: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 24,
    height: 56,
    opacity: 0.011,
  },
});
