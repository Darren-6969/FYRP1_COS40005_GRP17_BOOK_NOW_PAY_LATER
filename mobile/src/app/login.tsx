import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  loginUser,
  registerUser,
} from "../services/authApi";

import {
  saveSession,
} from "../services/session";

export default function LoginScreen() {
  const router = useRouter();

  const [mode, setMode] =
    useState<"login" | "register">("login");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] =
    useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [termsAccepted, setTermsAccepted] =
    useState(false);

  const [privacyAccepted, setPrivacyAccepted] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const handleLogin = async () => {
    setError("");

    if (!email.trim() || !password) {
      setError(
        "Please enter your email and password."
      );
      return;
    }

    try {
      setLoading(true);

      const data = await loginUser(
        email.trim(),
        password
      );

      await saveSession(
        data.token,
        data.refreshToken,
        data.user
      );

      if (data.user?.role === "CUSTOMER") {
        router.replace("/customer/home");
        return;
      }

      setError(
        "This mobile app currently supports customer accounts only."
      );
    } catch (err: any) {
      setError(
        err?.message || "Login failed."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setError("");

    if (
      !name.trim() ||
      !email.trim() ||
      !password ||
      !confirmPassword
    ) {
      setError(
        "Please complete all fields."
      );
      return;
    }

    if (name.trim().length < 2) {
      setError(
        "Name must be at least 2 characters."
      );
      return;
    }

    if (password.length < 8) {
      setError(
        "Password must be at least 8 characters."
      );
      return;
    }

    if (!/[A-Z]/.test(password)) {
      setError(
        "Password must contain at least one uppercase letter."
      );
      return;
    }

    if (!/[a-z]/.test(password)) {
      setError(
        "Password must contain at least one lowercase letter."
      );
      return;
    }

    if (!/[0-9]/.test(password)) {
      setError(
        "Password must contain at least one number."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        "Passwords do not match."
      );
      return;
    }

    if (!termsAccepted) {
      setError(
        "Please accept the Terms & Conditions."
      );
      return;
    }

    if (!privacyAccepted) {
      setError(
        "Please accept the Privacy Policy."
      );
      return;
    }

    try {
      setLoading(true);

      // 1. Create real customer account
      await registerUser(
        name.trim(),
        email.trim(),
        password
      );

      // 2. Login immediately after registration
      const loginData = await loginUser(
        email.trim(),
        password
      );

      // 3. Save token / refreshToken / user
      await saveSession(
        loginData.token,
        loginData.refreshToken,
        loginData.user
      );

      // 4. Enter customer mobile app
      router.replace("/customer/home");
    } catch (err: any) {
      setError(
        err?.message ||
          "Registration failed."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (mode === "login") {
      handleLogin();
    } else {
      handleRegister();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={
          styles.container
        }
        keyboardShouldPersistTaps="handled"
      >
        {/* LOGO */}
        <View style={styles.logo}>
          <Text style={styles.logoText}>
            BNPL
          </Text>
        </View>

        {/* HEADER */}
        <Text style={styles.title}>
          {mode === "login"
            ? "Welcome Back"
            : "Create Account"}
        </Text>

        <Text style={styles.subtitle}>
          {mode === "login"
            ? "Sign in to continue to BNPL Car Rental"
            : "Create your BNPL customer account"}
        </Text>

        {/* TABS */}
        <View style={styles.tabs}>
          <Pressable
            style={[
              styles.tab,
              mode === "login" &&
                styles.activeTab,
            ]}
            onPress={() => {
              setMode("login");
              setError("");
            }}
          >
            <Text
              style={[
                styles.tabText,
                mode === "login" &&
                  styles.activeTabText,
              ]}
            >
              Login
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.tab,
              mode === "register" &&
                styles.activeTab,
            ]}
            onPress={() => {
              setMode("register");
              setError("");
            }}
          >
            <Text
              style={[
                styles.tabText,
                mode === "register" &&
                  styles.activeTabText,
              ]}
            >
              Register
            </Text>
          </Pressable>
        </View>

        {/* NAME */}
        {mode === "register" && (
          <>
            <Text style={styles.label}>
              Full Name
            </Text>

            <View style={styles.inputBox}>
              <Text style={styles.icon}>
                👤
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>
          </>
        )}

        {/* EMAIL */}
        <Text style={styles.label}>
          Email Address
        </Text>

        <View style={styles.inputBox}>
          <Text style={styles.icon}>
            ✉
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* PASSWORD */}
        <Text style={styles.label}>
          Password
        </Text>

        <View style={styles.inputBox}>
          <Text style={styles.icon}>
            🔒
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
          />

          <Pressable
            onPress={() =>
              setShowPassword(
                !showPassword
              )
            }
          >
            <Text style={styles.showText}>
              {showPassword
                ? "Hide"
                : "Show"}
            </Text>
          </Pressable>
        </View>

        {/* CONFIRM PASSWORD */}
        {mode === "register" && (
          <>
            <Text style={styles.label}>
              Confirm Password
            </Text>

            <View style={styles.inputBox}>
              <Text style={styles.icon}>
                🔒
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Confirm password"
                value={confirmPassword}
                onChangeText={
                  setConfirmPassword
                }
                secureTextEntry={
                  !showPassword
                }
                autoCapitalize="none"
              />
            </View>

            {/* PASSWORD INFO */}
            <Text style={styles.passwordInfo}>
              Password must contain at
              least 8 characters, including
              uppercase, lowercase and a
              number.
            </Text>

            {/* TERMS */}
            <Pressable
              style={styles.checkboxRow}
              onPress={() =>
                setTermsAccepted(
                  !termsAccepted
                )
              }
            >
              <View
                style={[
                  styles.checkbox,
                  termsAccepted &&
                    styles.checkboxSelected,
                ]}
              >
                {termsAccepted && (
                  <Text
                    style={
                      styles.checkmark
                    }
                  >
                    ✓
                  </Text>
                )}
              </View>

              <Text
                style={
                  styles.checkboxText
                }
              >
                I agree to the Terms &
                Conditions
              </Text>
            </Pressable>

            {/* PRIVACY */}
            <Pressable
              style={styles.checkboxRow}
              onPress={() =>
                setPrivacyAccepted(
                  !privacyAccepted
                )
              }
            >
              <View
                style={[
                  styles.checkbox,
                  privacyAccepted &&
                    styles.checkboxSelected,
                ]}
              >
                {privacyAccepted && (
                  <Text
                    style={
                      styles.checkmark
                    }
                  >
                    ✓
                  </Text>
                )}
              </View>

              <Text
                style={
                  styles.checkboxText
                }
              >
                I agree to the Privacy
                Policy
              </Text>
            </Pressable>
          </>
        )}

        {/* FORGOT PASSWORD */}
        {mode === "login" && (
          <Pressable
            style={styles.forgotButton}
          >
            <Text
              style={styles.forgotText}
            >
              Forgot password?
            </Text>
          </Pressable>
        )}

        {/* ERROR */}
        {error ? (
          <Text style={styles.error}>
            {error}
          </Text>
        ) : null}

        {/* SUBMIT */}
        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            pressed && {
              opacity: 0.85,
            },
            loading && {
              opacity: 0.6,
            },
          ]}
          disabled={loading}
          onPress={handleSubmit}
        >
          <Text style={styles.submitText}>
            {loading
              ? mode === "login"
                ? "Signing In..."
                : "Creating Account..."
              : mode === "login"
              ? "Sign In"
              : "Create Account"}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7FAFB",
  },

  container: {
    width: "100%",
    maxWidth: 620,
    alignSelf: "center",
    paddingHorizontal: 32,
    paddingTop: 20,
    paddingBottom: 50,
  },

  logo: {
    alignSelf: "center",
    backgroundColor: "#07869B",
    borderRadius: 18,
    paddingHorizontal: 22,
    paddingVertical: 12,
    marginBottom: 28,
  },

  logoText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
  },

  title: {
    color: "#17313C",
    fontSize: 36,
    fontWeight: "900",
    textAlign: "center",
  },

  subtitle: {
    color: "#738892",
    fontSize: 16,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 34,
  },

  tabs: {
    flexDirection: "row",
    backgroundColor: "#EAF0F2",
    borderRadius: 18,
    padding: 5,
    marginBottom: 34,
  },

  tab: {
    flex: 1,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 14,
  },

  activeTab: {
    backgroundColor: "#FFFFFF",
  },

  tabText: {
    color: "#81929A",
    fontSize: 15,
    fontWeight: "800",
  },

  activeTabText: {
    color: "#07869B",
  },

  label: {
    color: "#17313C",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 10,
    marginTop: 12,
  },

  inputBox: {
    minHeight: 66,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE6EA",
    borderRadius: 18,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
  },

  icon: {
    fontSize: 17,
    marginRight: 12,
  },

  input: {
    flex: 1,
    fontSize: 15,
    color: "#17313C",
    minHeight: 60,
    outlineStyle: "none",
  } as any,

  showText: {
    color: "#07869B",
    fontSize: 13,
    fontWeight: "800",
  },

  passwordInfo: {
    color: "#81939C",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 10,
  },

  forgotButton: {
    alignSelf: "flex-end",
    marginTop: 16,
    marginBottom: 10,
  },

  forgotText: {
    color: "#07869B",
    fontWeight: "800",
    fontSize: 13,
  },

  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
  },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#B7C6CC",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },

  checkboxSelected: {
    backgroundColor: "#07869B",
    borderColor: "#07869B",
  },

  checkmark: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 14,
  },

  checkboxText: {
    color: "#526A74",
    fontSize: 12,
    flex: 1,
  },

  error: {
    color: "#E5484D",
    fontSize: 12,
    textAlign: "center",
    marginTop: 18,
  },

  submitButton: {
    minHeight: 66,
    backgroundColor: "#078FA5",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
  },

  submitText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
  },
});