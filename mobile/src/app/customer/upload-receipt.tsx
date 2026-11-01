import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function UploadReceiptScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color="#17313C"
          />
        </Pressable>

        <Text style={styles.headerTitle}>
          Upload Receipt
        </Text>

        <View style={{ width: 42 }} />
      </View>

      <View style={styles.content}>
        <Ionicons
          name="receipt-outline"
          size={48}
          color="#07869B"
        />

        <Text style={styles.title}>
          Manual Payment Receipt
        </Text>

        <Text style={styles.description}>
          Complete your DuitNow or SPay payment,
          then upload your payment receipt here
          for operator verification.
        </Text>

        <Text style={styles.comingSoon}>
          Receipt upload will be connected next.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7FAFB",
  },

  header: {
    height: 64,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5ECEF",
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F7F8",
  },

  headerTitle: {
    color: "#17313C",
    fontSize: 17,
    fontWeight: "900",
  },

  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },

  title: {
    marginTop: 18,
    color: "#17313C",
    fontSize: 20,
    fontWeight: "900",
  },

  description: {
    marginTop: 10,
    color: "#7E929A",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },

  comingSoon: {
    marginTop: 18,
    color: "#07869B",
    fontSize: 12,
    fontWeight: "800",
  },
});