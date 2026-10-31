import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function CarDetails() {
  const router = useRouter();

  const handleContinueBNPL = () => {
  router.push("/customer/checkout");
  };  

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <Pressable
            style={styles.headerButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>

          <Text style={styles.headerTitle}>Car Details</Text>

          <Pressable style={styles.headerButton}>
            <Text style={styles.heart}>♡</Text>
          </Pressable>
        </View>

        <View style={styles.imageCard}>
          <Image
            source={{
              uri: "https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&w=1200&q=90",
            }}
            style={styles.carImage}
          />
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.carName}>Toyota Corolla</Text>

          <View style={styles.tags}>
            <View style={styles.tag}>
              <Text style={styles.tagText}>Sedan</Text>
            </View>

            <View style={styles.tag}>
              <Text style={styles.tagText}>Automatic</Text>
            </View>

            <View style={styles.tag}>
              <Text style={styles.tagText}>5 Seats</Text>
            </View>

            <View style={styles.tag}>
              <Text style={styles.tagText}>Petrol</Text>
            </View>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.price}>RM 220</Text>
            <Text style={styles.perDay}> / day</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Pickup & Return Details</Text>

            <Pressable>
              <Text style={styles.changeText}>Change</Text>
            </Pressable>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Text>📍</Text>
            </View>

            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Pickup Location</Text>
              <Text style={styles.detailValue}>
                Kuala Lumpur International Airport (KLIA)
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Text>📅</Text>
            </View>

            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Pickup Date & Time</Text>
              <Text style={styles.detailValue}>
                12 Mar 2026, 10:00 AM
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Text>📅</Text>
            </View>

            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Return Date & Time</Text>
              <Text style={styles.detailValue}>
                15 Mar 2026, 10:00 AM
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Price Summary</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>RM 220 × 3 days</Text>
            <Text style={styles.summaryValue}>RM 660</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Service Fee</Text>
            <Text style={styles.summaryValue}>RM 0</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>RM 660</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.bottomLabel}>Total (3 days)</Text>
          <Text style={styles.bottomPrice}>RM 660</Text>
        </View>

        <Pressable
            style={({ pressed }) => [
                styles.bnplButton,
                pressed && { opacity: 0.8 },
            ]}
            onPress={handleContinueBNPL}
            >
            <Text style={styles.bnplButtonText}>
                Continue with BNPL
            </Text>

            <Text style={styles.bnplArrow}>
                →
            </Text>
            </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7FAFB",
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 120,
    width: "100%",
    maxWidth: 700,
    alignSelf: "center",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EBEE",
    justifyContent: "center",
    alignItems: "center",
  },

  backIcon: {
    fontSize: 34,
    color: "#17313C",
    marginTop: -4,
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#17313C",
  },

  heart: {
    fontSize: 24,
    color: "#07869B",
  },

  imageCard: {
    height: 260,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#EAF1F3",
  },

  carImage: {
    width: "100%",
    height: "100%",
  },

  infoSection: {
    marginTop: 22,
  },

  carName: {
    fontSize: 28,
    fontWeight: "900",
    color: "#17313C",
  },

  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },

  tag: {
    backgroundColor: "#EDF4F6",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },

  tagText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#51666F",
  },

  priceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 18,
  },

  price: {
    fontSize: 25,
    fontWeight: "900",
    color: "#0B5363",
  },

  perDay: {
    fontSize: 13,
    color: "#83949C",
    marginBottom: 4,
  },

  section: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5ECEF",
    borderRadius: 22,
    padding: 18,
    marginTop: 22,
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#17313C",
  },

  changeText: {
    color: "#07869B",
    fontWeight: "800",
    fontSize: 12,
  },

  detailRow: {
    flexDirection: "row",
    marginBottom: 18,
  },

  detailIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#E4F6F8",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  detailContent: {
    flex: 1,
  },

  detailLabel: {
    fontSize: 11,
    color: "#8999A1",
    marginBottom: 4,
  },

  detailValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#253D47",
    lineHeight: 20,
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
  },

  summaryLabel: {
    color: "#6E818A",
    fontSize: 13,
  },

  summaryValue: {
    color: "#253D47",
    fontSize: 13,
    fontWeight: "700",
  },

  divider: {
    height: 1,
    backgroundColor: "#E7ECEF",
    marginTop: 18,
  },

  totalLabel: {
    fontSize: 15,
    fontWeight: "900",
    color: "#17313C",
  },

  totalValue: {
    fontSize: 20,
    fontWeight: "900",
    color: "#07869B",
  },

  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E3EAED",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  bottomLabel: {
    color: "#84959D",
    fontSize: 11,
  },

  bottomPrice: {
    color: "#17313C",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 2,
  },

  bnplButton: {
    height: 54,
    paddingHorizontal: 22,
    borderRadius: 16,
    backgroundColor: "#07869B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  bnplButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },

  bnplArrow: {
    color: "#FFFFFF",
    fontSize: 20,
    marginLeft: 8,
  },
});