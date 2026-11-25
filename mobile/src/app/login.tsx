import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SaveError } from "@/components/account/AccountScreen";
import { CODE_LENGTH, CodeInput } from "@/components/account/CodeInput";
import { AppText, Button, FieldError, GlassCard, IconButton, SegmentedControl, TextField, type SegmentOption } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import { ApiError } from "@/services/api";
import { loginUser, registerUser, verifyEmailCode, verifyLoginCode } from "@/services/authApi";
import { saveSession } from "@/services/session";
import { WEBSITE_URL } from "@/utils/chat-links";
import { logger } from "@/utils/logger";

type Mode = "login" | "register";
/**
 * The emailed code the server can ask for after the password:
 * "login" is an operator's two-step sign-in (Shop settings, Security), and
 * "email" confirms a new account's email address before its first sign-in.
 */
type CodeStep = "login" | "email";

const RESEND_SECONDS = 30;
type Field = "name" | "email" | "password" | "confirm" | "terms" | "privacy";
type Errors = Partial<Record<Field, string>>;

const MODES: readonly SegmentOption<Mode>[] = [
  { value: "login", label: "Sign in" },
  { value: "register", label: "Create account" },
];

/** The server's password rules (auth_validator.js), checked here first. */
const RULES: { test: (v: string) => boolean; text: string }[] = [
  { test: (v) => v.length >= 8, text: "8 characters" },
  { test: (v) => /[A-Z]/.test(v), text: "an upper-case letter" },
  { test: (v) => /[a-z]/.test(v), text: "a lower-case letter" },
  { test: (v) => /[0-9]/.test(v), text: "a number" },
];

/** The website's pages for things the app doesn't do itself (open in the in-app browser). */
const openWebsite = (path: string) => WebBrowser.openBrowserAsync(`${WEBSITE_URL}${path}`).catch(() => {});

/**
 * Sign in and create an account (plan phase 5): the ambient background, a
 * frosted form card and errors under each field instead of one message.
 * Opened from Welcome with ?mode=login or ?mode=register.
 */
export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  const params = useLocalSearchParams<{ mode?: string }>();

  const [mode, setMode] = useState<Mode>(params.mode === "register" ? "register" : "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [step, setStep] = useState<CodeStep | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [resent, setResent] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const register = mode === "register";
  const mail = email.trim();

  // Counts down the wait before another code can be sent.
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const clear = (field: Field) => {
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
    if (submitError) setSubmitError(null);
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setErrors({});
    setSubmitError(null);
  };

  const enterApp = async (data: any) => {
    const role = data?.user?.role;
    if (role !== "CUSTOMER" && role !== "NORMAL_SELLER") {
      throw new ApiError({
        status: 403,
        code: "ROLE_NOT_SUPPORTED",
        message: "This account can't use the mobile app. Sign in on the website instead.",
      });
    }
    await saveSession(data.token, data.refreshToken, data.user);
    router.replace((role === "CUSTOMER" ? "/customer/home" : "/operator/dashboard") as Href);
  };

  const startCode = (next: CodeStep) => {
    setStep(next);
    setCode("");
    setCodeError(null);
    setSubmitError(null);
    setResent(false);
    setResendIn(RESEND_SECONDS);
  };

  const leaveCode = () => {
    setStep(null);
    setCode("");
    setCodeError(null);
    setSubmitError(null);
  };

  /** Password sign-in. An operator with two-step sign-in gets a code instead of a session. */
  const signIn = async () => {
    const data = await loginUser(mail, password);
    if (data?.requiresOtp || data?.code === "OTP_REQUIRED") {
      startCode("login");
      return;
    }
    await enterApp(data);
  };

  const verify = async (value = code) => {
    if (verifying) return;
    if (value.length !== CODE_LENGTH) {
      setCodeError(`Enter the ${CODE_LENGTH}-digit code from the email.`);
      return;
    }
    setCodeError(null);
    setSubmitError(null);
    setVerifying(true);
    try {
      if (step === "login") {
        await enterApp(await verifyLoginCode(mail, value));
      } else {
        await verifyEmailCode(mail, value);
        // Email confirmed: sign in with the password already entered.
        setStep(null);
        await signIn();
      }
    } catch (err) {
      logger.debug("Code check failed:", err);
      if (err instanceof ApiError && (err.status === 400 || err.status === 429)) {
        setCodeError(err.message);
        setCode("");
      } else {
        setSubmitError(err);
      }
    } finally {
      setVerifying(false);
    }
  };

  /** Signing in again sends a fresh code for either step. */
  const resend = async () => {
    setCodeError(null);
    setSubmitError(null);
    try {
      await loginUser(mail, password);
    } catch (err) {
      if (!(err instanceof ApiError && err.code === "EMAIL_VERIFICATION_REQUIRED")) {
        logger.debug("Resending the code failed:", err);
        setSubmitError(err);
        return;
      }
    }
    setCode("");
    setResent(true);
    setResendIn(RESEND_SECONDS);
  };

  const submit = async () => {
    const next: Errors = {};
    if (!mail) next.email = "Enter your email address.";
    else if (!/^\S+@\S+\.\S+$/.test(mail)) next.email = "Enter a valid email address, for example name@email.com.";

    if (register) {
      if (name.trim().length < 2) next.name = "Enter your full name.";
      if (!password) next.password = "Choose a password.";
      else if (!RULES.every((r) => r.test(password))) next.password = "Your password doesn't meet the rules below.";
      if (!confirm) next.confirm = "Enter your password again.";
      else if (password && confirm !== password) next.confirm = "This doesn't match your password.";
      if (!terms) next.terms = "Agree to the Terms and Conditions to continue.";
      if (!privacy) next.privacy = "Agree to the Privacy Policy to continue.";
    } else if (!password) {
      next.password = "Enter your password.";
    }

    setErrors(next);
    setSubmitError(null);
    if (Object.values(next).some(Boolean)) return;

    try {
      if (register) {
        // The server emails a code to confirm the address before first sign-in.
        await registerUser(name.trim(), mail, password);
        startCode("email");
        return;
      }
      await signIn();
    } catch (err) {
      // An account whose email isn't confirmed yet: the server has just sent a code.
      if (err instanceof ApiError && err.code === "EMAIL_VERIFICATION_REQUIRED") {
        startCode("email");
        return;
      }
      logger.debug("Sign in failed:", err);
      setSubmitError(err);
    }
  };

  const unmet = RULES.filter((r) => !r.test(password)).map((r) => r.text);

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          {router.canGoBack() ? <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} /> : null}
        </View>

        <View style={styles.brand}>
          <Image source={require("../../assets/images/logo-circle.png")} style={styles.logo} accessible={false} />
          <AppText variant="largeTitle" accessibilityRole="header" align="center">
            {step ? "Check your email" : register ? "Create your account" : "Welcome back"}
          </AppText>
          <AppText variant="body" align="center">
            {step
              ? `We sent a ${CODE_LENGTH}-digit code to ${mail}. It expires in 10 minutes.`
              : register
                ? "Request a car for free. Pay only once it's accepted."
                : "Sign in to see your bookings and payments."}
          </AppText>
        </View>

        {step ? (
          <GlassCard strong padding={16}>
            <View style={styles.codeHead}>
              <View style={[styles.codeIcon, { backgroundColor: tokens.glass }]}>
                <Ionicons name={step === "login" ? "shield-checkmark-outline" : "mail-unread-outline"} size={20} color={tokens.brand} />
              </View>
              <AppText variant="body" style={styles.flex}>
                {step === "login"
                  ? "Your operator account asks for a code each time you sign in."
                  : "Confirm your email address to finish creating your account."}
              </AppText>
            </View>

            <View style={styles.fields}>
              <CodeInput
                label="Code from the email"
                value={code}
                onChange={(value) => {
                  setCode(value);
                  if (codeError) setCodeError(null);
                  if (submitError) setSubmitError(null);
                }}
                onComplete={(value) => verify(value)}
                error={codeError}
              />
              {resent && !codeError ? (
                <AppText variant="caption" color="leafInk" accessibilityLiveRegion="polite">
                  A new code is on its way. Use the newest email.
                </AppText>
              ) : null}
            </View>

            <SaveError error={submitError} />

            <Button
              label={step === "login" ? "Verify and sign in" : "Verify email"}
              variant="brand"
              loading={verifying}
              disabled={code.length !== CODE_LENGTH}
              style={styles.submit}
              onPress={() => verify()}
            />
            <View style={styles.codeActions}>
              <Button
                label={resendIn > 0 ? `Send a new code in ${resendIn}s` : "Send a new code"}
                variant="text"
                size="sm"
                disabled={resendIn > 0 || verifying}
                onPress={resend}
              />
              <Button label="Use another email" variant="text" size="sm" disabled={verifying} onPress={leaveCode} />
            </View>
          </GlassCard>
        ) : (
        <GlassCard strong padding={16}>
          <SegmentedControl options={MODES} value={mode} onChange={switchMode} accessibilityLabel="Sign in or create an account" />

          <View style={styles.fields}>
            {register ? (
              <TextField
                label="Full name"
                value={name}
                onChangeText={(t) => {
                  setName(t);
                  clear("name");
                }}
                error={errors.name}
                placeholder="As on your driving licence"
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                maxLength={120}
              />
            ) : null}
            <TextField
              label="Email"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                clear("email");
              }}
              error={errors.email}
              placeholder="name@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
            />
            <TextField
              label="Password"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                clear("password");
              }}
              error={errors.password}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete={register ? "new-password" : "current-password"}
              textContentType={register ? "newPassword" : "password"}
              maxLength={128}
              hint={register && password && unmet.length ? `Still needs ${unmet.join(", ")}.` : undefined}
              trailing={
                <Pressable
                  onPress={() => setShowPassword((s) => !s)}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                  hitSlop={8}
                  style={styles.eye}
                >
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={tokens.label} />
                </Pressable>
              }
            />
            {register ? (
              <>
                <TextField
                  label="Confirm password"
                  value={confirm}
                  onChangeText={(t) => {
                    setConfirm(t);
                    clear("confirm");
                  }}
                  error={errors.confirm}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="new-password"
                  textContentType="newPassword"
                  maxLength={128}
                />
                <Agree
                  checked={terms}
                  onToggle={() => {
                    setTerms((v) => !v);
                    clear("terms");
                  }}
                  label="I agree to the"
                  link="Terms and Conditions"
                  onLink={() => openWebsite("/info/terms")}
                  error={errors.terms}
                />
                <Agree
                  checked={privacy}
                  onToggle={() => {
                    setPrivacy((v) => !v);
                    clear("privacy");
                  }}
                  label="I agree to the"
                  link="Privacy Policy"
                  onLink={() => openWebsite("/info/privacy")}
                  error={errors.privacy}
                />
              </>
            ) : (
              <Button
                label="Forgot password?"
                variant="text"
                size="sm"
                style={styles.forgot}
                onPress={() => openWebsite("/forgot-password")}
              />
            )}
          </View>

          <SaveError error={submitError} />

          <Button label={register ? "Create account" : "Sign in"} variant={register ? "cta" : "brand"} style={styles.submit} onPress={submit} />
        </GlassCard>
        )}

        <AppText variant="caption" align="center" style={styles.footnote}>
          {step
            ? "Can't find it? Check your spam folder."
            : register
              ? "Operators join through the website."
              : "Customers and operators sign in here."}
        </AppText>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Agree({
  checked,
  onToggle,
  label,
  link,
  onLink,
  error,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  link: string;
  onLink: () => void;
  error?: string;
}) {
  const { tokens } = useTheme();
  return (
    <View>
      <View style={styles.agree}>
        <Pressable
          onPress={onToggle}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          accessibilityLabel={`${label} ${link}`}
          hitSlop={8}
          style={[
            styles.box,
            {
              borderColor: error ? tokens.errFg : checked ? tokens.brand : tokens.label,
              backgroundColor: checked ? tokens.brand : "transparent",
            },
          ]}
        >
          {checked ? <Ionicons name="checkmark" size={16} color={tokens.onBrand} /> : null}
        </Pressable>
        <AppText variant="body" style={styles.flex} onPress={onToggle}>
          {label}{" "}
          <AppText variant="bodyStrong" color="leafInk" onPress={onLink} accessibilityRole="link">
            {link}
          </AppText>
        </AppText>
      </View>
      <FieldError message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    gap: 18,
  },
  flex: {
    flex: 1,
  },
  topRow: {
    minHeight: 44,
    flexDirection: "row",
  },
  brand: {
    alignItems: "center",
    gap: 8,
  },
  logo: {
    width: 72,
    height: 72,
    marginBottom: 4,
  },
  fields: {
    gap: 14,
    marginTop: 16,
  },
  eye: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  forgot: {
    alignSelf: "flex-end",
  },
  agree: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 44,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  submit: {
    marginTop: 16,
  },
  codeHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  codeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  codeActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    marginTop: 8,
  },
  footnote: {
    marginTop: 4,
  },
});
