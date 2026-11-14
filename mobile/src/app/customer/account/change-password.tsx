import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AccountScreen, SaveError } from "@/components/account/AccountScreen";
import { AppText, Button, GlassCard, TextField, useToast } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import { isApiError } from "@/services/api";
import { changePassword, getMe } from "@/services/authApi";
import { logger } from "@/utils/logger";

type Field = "current" | "next" | "confirm";
type Errors = Partial<Record<Field, string>>;

/** The server's rules (auth_validator.js passwordSchema), checked here first. */
const RULES: { test: (v: string) => boolean; text: string }[] = [
  { test: (v) => v.length >= 8, text: "At least 8 characters" },
  { test: (v) => /[A-Z]/.test(v), text: "An upper-case letter" },
  { test: (v) => /[a-z]/.test(v), text: "A lower-case letter" },
  { test: (v) => /[0-9]/.test(v), text: "A number" },
];

/** Change password, pushed from Profile (rule 05b: inline errors, no alerts). */
export default function ChangePasswordScreen() {
  const router = useRouter();
  const toast = useToast();
  const { tokens } = useTheme();

  const [values, setValues] = useState<Record<Field, string>>({ current: "", next: "", confirm: "" });
  const [shown, setShown] = useState<Record<Field, boolean>>({ current: false, next: false, confirm: false });
  const [errors, setErrors] = useState<Errors>({});
  const [saveError, setSaveError] = useState<unknown>(null);

  const set = (field: Field) => (text: string) => {
    setValues((v) => ({ ...v, [field]: text }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const eye = (field: Field) => (
    <Pressable
      onPress={() => setShown((s) => ({ ...s, [field]: !s[field] }))}
      accessibilityRole="button"
      accessibilityLabel={shown[field] ? "Hide password" : "Show password"}
      hitSlop={8}
      style={styles.eye}
    >
      <Ionicons name={shown[field] ? "eye-off-outline" : "eye-outline"} size={20} color={tokens.label} />
    </Pressable>
  );

  const save = async () => {
    const next: Errors = {};
    if (!values.current) next.current = "Enter your current password.";
    if (!values.next) next.next = "Enter a new password.";
    else if (!RULES.every((r) => r.test(values.next))) next.next = "Your new password doesn't meet the rules below.";
    else if (values.next === values.current) next.next = "Choose a password different from your current one.";
    if (!values.confirm) next.confirm = "Enter your new password again.";
    else if (values.next && values.confirm !== values.next) next.confirm = "This doesn't match your new password.";
    setErrors(next);
    setSaveError(null);
    if (next.current || next.next || next.confirm) return;

    try {
      // The change-password route doesn't refresh an expired login (a 401
      // there means a wrong password), so refresh it here first.
      await getMe();
      await changePassword({
        currentPassword: values.current,
        newPassword: values.next,
        confirmPassword: values.confirm,
      });
      toast.show("Password changed.", { tone: "ok" });
      router.back();
    } catch (err) {
      logger.debug("Failed to change password:", err);
      if (isApiError(err) && err.status === 401 && err.code !== "TOKEN_EXPIRED" && err.code !== "SESSION_EXPIRED") {
        setErrors({ current: "That isn't your current password." });
        return;
      }
      setSaveError(err);
    }
  };

  return (
    <AccountScreen title="Change password" action={<Button label="Change password" variant="brand" grow onPress={save} />}>
      <TextField
        label="Current password"
        value={values.current}
        onChangeText={set("current")}
        error={errors.current}
        secureTextEntry={!shown.current}
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        maxLength={128}
        trailing={eye("current")}
      />
      <TextField
        label="New password"
        value={values.next}
        onChangeText={set("next")}
        error={errors.next}
        secureTextEntry={!shown.next}
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        maxLength={128}
        trailing={eye("next")}
      />
      <GlassCard>
        <AppText variant="label" color="ink">
          Your new password needs
        </AppText>
        {RULES.map((rule) => {
          const met = rule.test(values.next);
          return (
            <View key={rule.text} style={styles.rule} accessible accessibilityLabel={`${rule.text}, ${met ? "done" : "not yet"}`}>
              <Ionicons
                name={met ? "checkmark-circle" : "ellipse-outline"}
                size={17}
                color={met ? tokens.okFg : tokens.label}
              />
              <AppText variant="caption" color={met ? "ink" : "label"}>
                {rule.text}
              </AppText>
            </View>
          );
        })}
      </GlassCard>
      <TextField
        label="Confirm new password"
        value={values.confirm}
        onChangeText={set("confirm")}
        error={errors.confirm}
        secureTextEntry={!shown.confirm}
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        maxLength={128}
        trailing={eye("confirm")}
      />
      <SaveError error={saveError} />
    </AccountScreen>
  );
}

const styles = StyleSheet.create({
  eye: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  rule: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
});
