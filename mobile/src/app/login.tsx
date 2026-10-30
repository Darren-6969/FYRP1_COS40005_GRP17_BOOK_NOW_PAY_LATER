import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { loginUser } from "../services/authApi";
import { saveSession } from "../services/session";

export default function LoginScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
  setError("");

  if (!email.trim() || !password) {
    setError("Please enter your email and password.");
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Back */}
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        {/* Heading */}
        <View style={styles.header}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>BNPL</Text>
          </View>

          <Text style={styles.title}>Welcome Back</Text>

          <Text style={styles.subtitle}>
            Sign in to continue to BNPL Car Rental
          </Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <Pressable style={[styles.tab, styles.activeTab]}>
            <Text style={styles.activeTabText}>Login</Text>
          </Pressable>

          <Pressable style={styles.tab}>
            <Text style={styles.tabText}>Register</Text>
          </Pressable>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.label}>Email Address</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputIcon}>✉</Text>

            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#94A3B8"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <Text style={[styles.label, styles.passwordLabel]}>Password</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputIcon}>🔒</Text>

            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor="#94A3B8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />

            <Pressable onPress={() => setShowPassword(!showPassword)}>
              <Text style={styles.showPassword}>
                {showPassword ? "Hide" : "Show"}
              </Text>
            </Pressable>
          </View>

          <Pressable style={styles.forgotButton}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
                styles.signInButton,
                pressed && { opacity: 0.85 },
            ]}
            onPress={handleLogin}
            >
            <Text style={styles.signInText}>
            {loading ? "Signing In..." : "Sign In"}
            </Text>
          </Pressable>

          {error ? (
            <Text
                style={{
                color: "#E5484D",
                fontSize: 12,
                marginTop: 12,
                textAlign: "center",
                }}
            >
                {error}
            </Text>
            ) : null}

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.divider} />
          </View>

          <Pressable style={styles.socialButton}>
            <Text style={styles.googleIcon}>G</Text>
            <Text style={styles.socialText}>Continue with Google</Text>
          </Pressable>

          <View style={styles.registerArea}>
            <Text style={styles.registerText}>
              Don't have an account?{" "}
            </Text>

            <Pressable>
              <Text style={styles.registerLink}>Register</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FBFC",
  },

  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    maxWidth: 500,
    width: "100%",
    alignSelf: "center",
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E3EBEE",
  },

  backText: {
    color: "#0B2533",
    fontSize: 34,
    marginTop: -5,
  },

  header: {
    alignItems: "center",
    marginTop: 24,
    marginBottom: 28,
  },

  logo: {
    backgroundColor: "#087F93",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 14,
    marginBottom: 20,
  },

  logoText: {
    color: "#FFFFFF",
    fontWeight: "900",
    letterSpacing: 1.5,
  },

  title: {
    color: "#102833",
    fontSize: 30,
    fontWeight: "900",
  },

  subtitle: {
    color: "#70838D",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },

  tabs: {
    flexDirection: "row",
    marginBottom: 25,
    backgroundColor: "#EDF3F5",
    borderRadius: 14,
    padding: 4,
  },

  tab: {
    flex: 1,
    paddingVertical: 11,
    alignItems: "center",
    borderRadius: 11,
  },

  activeTab: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 2,
  },

  activeTabText: {
    color: "#087F93",
    fontWeight: "800",
  },

  tabText: {
    color: "#80909A",
    fontWeight: "700",
  },

  form: {
    width: "100%",
  },

  label: {
    color: "#344C57",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },

  passwordLabel: {
    marginTop: 18,
  },

  inputContainer: {
    minHeight: 58,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DFE8EB",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
  },

  inputIcon: {
    fontSize: 17,
    marginRight: 10,
  },

  input: {
    flex: 1,
    color: "#122B35",
    fontSize: 15,
    outlineStyle: "none" as any,
  },

  showPassword: {
    color: "#07869B",
    fontWeight: "700",
    fontSize: 12,
  },

  forgotButton: {
    alignSelf: "flex-end",
    marginTop: 12,
  },

  forgotText: {
    color: "#07869B",
    fontWeight: "700",
    fontSize: 13,
  },

  signInButton: {
    height: 58,
    borderRadius: 16,
    backgroundColor: "#07869B",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 25,
  },

  signInText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 16,
  },

  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 28,
  },

  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "#DFE7EA",
  },

  dividerText: {
    marginHorizontal: 12,
    color: "#8B9AA2",
    fontSize: 12,
  },

  socialButton: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DFE7EA",
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },

  googleIcon: {
    fontSize: 20,
    fontWeight: "900",
    color: "#4285F4",
    marginRight: 12,
  },

  socialText: {
    color: "#253C46",
    fontSize: 14,
    fontWeight: "700",
  },

  registerArea: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 28,
  },

  registerText: {
    color: "#758992",
    fontSize: 13,
  },

  registerLink: {
    color: "#07869B",
    fontSize: 13,
    fontWeight: "800",
  },
});