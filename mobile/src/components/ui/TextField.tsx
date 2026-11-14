import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { FontFamily, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { AppText } from './AppText';
import { FieldError } from './FieldError';

type TextFieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  /** Shown under the field (rule 05b: form errors sit under their field). */
  error?: string | null;
  /** Helper text under the field when there's no error. */
  hint?: string;
};

/** A labelled input on a frosted pill, with its error underneath. */
export function TextField({ label, error, hint, multiline, ...input }: TextFieldProps) {
  const { tokens } = useTheme();

  return (
    <View style={styles.wrap}>
      <AppText variant="label" color="ink">
        {label}
      </AppText>
      <View
        style={[
          styles.field,
          multiline && styles.multiline,
          {
            backgroundColor: tokens.glass,
            borderColor: error ? tokens.errFg : tokens.glassLine,
            borderWidth: error ? 1.5 : StyleSheet.hairlineWidth,
          },
        ]}
      >
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={error || hint}
          placeholderTextColor={tokens.label}
          multiline={multiline}
          style={[styles.input, { color: tokens.ink }, multiline && styles.inputMultiline]}
          {...input}
        />
      </View>
      {error ? <FieldError message={error} /> : hint ? <AppText variant="caption" style={styles.hint}>{hint}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  field: {
    minHeight: 48,
    borderRadius: Radius.pill,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  multiline: {
    borderRadius: Radius.md,
    paddingVertical: 10,
  },
  input: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    paddingVertical: 12,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingVertical: 0,
  },
  hint: {
    paddingHorizontal: 4,
  },
});
