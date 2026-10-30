import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const cars = [
  {
    id: 1,
    name: "Toyota Corolla",
    type: "Sedan",
    transmission: "Automatic",
    price: 220,
    image:
      "https://images.unsplash.com/photo-1626072778346-0ab6604d659f?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: 2,
    name: "Honda CR-V",
    type: "SUV",
    transmission: "Automatic",
    price: 280,
    image:
      "https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=800&q=80",
  },
];

export default function CustomerHome() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.deliveryLabel}>Current Location</Text>

            <Text style={styles.location}>
              Kuala Lumpur, Malaysia ▼
            </Text>
          </View>

          <Pressable style={styles.notificationButton}>
            <Text style={styles.notificationIcon}>♢</Text>
            <View style={styles.notificationDot} />
          </Pressable>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>⌕</Text>

            <TextInput
              placeholder="Search cars, location or type..."
              placeholderTextColor="#90A0A8"
              style={styles.searchInput}
            />
          </View>

          <Pressable style={styles.filterButton}>
            <Text style={styles.filterText}>☷</Text>
          </Pressable>
        </View>

        {/* Hero Banner */}
        <View style={styles.heroBanner}>
          <View style={styles.heroTextArea}>
            <Text style={styles.heroTitle}>
              Drive Now{"\n"}Pay Later
            </Text>

            <Text style={styles.heroSubtitle}>
              Flexible car rental with BNPL payment options.
            </Text>

            <Pressable style={styles.heroButton}>
              <Text style={styles.heroButtonText}>View Deals</Text>
              <Text style={styles.heroArrow}>→</Text>
            </Pressable>
          </View>

          <Image
            source={{
              uri: "https://images.unsplash.com/photo-1504215680853-026ed2a45def?auto=format&fit=crop&w=900&q=80",
            }}
            style={styles.heroImage}
          />
        </View>

        {/* Categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categories}
        >
          {["SUV", "Sedan", "Hatchback", "MPV", "Luxury"].map((category) => (
            <Pressable key={category} style={styles.category}>
              <View style={styles.categoryIcon}>
                <Text style={styles.carEmoji}>🚗</Text>
              </View>

              <Text style={styles.categoryText}>{category}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Featured Cars Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Featured Cars</Text>

          <Pressable>
            <Text style={styles.seeAll}>See All</Text>
          </Pressable>
        </View>

        {/* Featured Cars */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carList}
        >
          {cars.map((car) => (
            <Pressable
              key={car.id}
              style={styles.carCard}
              onPress={() => router.push("/customer/car-details")}
            >
              <View style={styles.carImageWrapper}>
                <Image
                  source={{ uri: car.image }}
                  style={styles.carImage}
                />

                <View style={styles.heartButton}>
                  <Text style={styles.heart}>♡</Text>
                </View>
              </View>

              <View style={styles.carInfo}>
                <Text style={styles.carName}>{car.name}</Text>

                <Text style={styles.carDetails}>
                  {car.type} · {car.transmission}
                </Text>

                <View style={styles.priceRow}>
                  <Text style={styles.price}>RM {car.price}</Text>
                  <Text style={styles.perDay}> / day</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        {/* My Booking Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Booking</Text>

          <Pressable>
            <Text style={styles.seeAll}>View All</Text>
          </Pressable>
        </View>

        {/* Booking Card */}
        <Pressable style={styles.bookingCard}>
          <Image
            source={{
              uri: "https://images.unsplash.com/photo-1626072778346-0ab6604d659f?auto=format&fit=crop&w=600&q=80",
            }}
            style={styles.bookingImage}
          />

          <View style={styles.bookingInfo}>
            <View style={styles.bookingTopRow}>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>Upcoming</Text>
              </View>

              <Text style={styles.bookingCode}>BNPL-1048</Text>
            </View>

            <Text style={styles.bookingCar}>Toyota Corolla</Text>

            <Text style={styles.bookingDate}>
              12 Mar 2026 – 15 Mar 2026
            </Text>
          </View>

          <Text style={styles.chevron}>›</Text>
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

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 35,
    width: "100%",
    maxWidth: 700,
    alignSelf: "center",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },

  deliveryLabel: {
    color: "#8698A1",
    fontSize: 12,
    marginBottom: 3,
  },

  location: {
    color: "#17313C",
    fontSize: 15,
    fontWeight: "800",
  },

  notificationButton: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E4ECEF",
    position: "relative",
  },

  notificationIcon: {
    fontSize: 25,
    color: "#17313C",
  },

  notificationDot: {
    width: 8,
    height: 8,
    borderRadius: 8,
    backgroundColor: "#F44545",
    position: "absolute",
    right: 10,
    top: 9,
  },

  searchRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },

  searchBox: {
    flex: 1,
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2EAED",
    paddingHorizontal: 15,
  },

  searchIcon: {
    fontSize: 24,
    color: "#6F828B",
    marginRight: 9,
  },

  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#17313C",
    outlineStyle: "none" as any,
  },

  filterButton: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2EAED",
    alignItems: "center",
    justifyContent: "center",
  },

  filterText: {
    fontSize: 24,
    color: "#17313C",
  },

  heroBanner: {
    height: 185,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#073E4B",
    flexDirection: "row",
    marginBottom: 22,
  },

  heroTextArea: {
    flex: 1.05,
    padding: 20,
    zIndex: 2,
  },

  heroTitle: {
    color: "#FFFFFF",
    fontSize: 27,
    lineHeight: 30,
    fontWeight: "900",
  },

  heroSubtitle: {
    color: "#D0E8ED",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 9,
    maxWidth: 190,
  },

  heroButton: {
    backgroundColor: "#FFFFFF",
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 20,
    marginTop: 15,
  },

  heroButtonText: {
    color: "#087F93",
    fontWeight: "800",
    fontSize: 12,
  },

  heroArrow: {
    color: "#087F93",
    fontWeight: "900",
    marginLeft: 5,
  },

  heroImage: {
    flex: 1,
    height: "100%",
    opacity: 0.9,
  },

  categories: {
    gap: 15,
    paddingBottom: 22,
  },

  category: {
    alignItems: "center",
    width: 72,
  },

  categoryIcon: {
    width: 55,
    height: 55,
    borderRadius: 18,
    backgroundColor: "#DFF5F8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 7,
  },

  carEmoji: {
    fontSize: 25,
  },

  categoryText: {
    color: "#40555F",
    fontSize: 11,
    fontWeight: "700",
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },

  sectionTitle: {
    color: "#172E38",
    fontSize: 19,
    fontWeight: "900",
  },

  seeAll: {
    color: "#07869B",
    fontWeight: "800",
    fontSize: 12,
  },

  carList: {
    gap: 14,
    paddingBottom: 25,
  },

  carCard: {
    width: 210,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E8EEF0",
  },

  carImageWrapper: {
    height: 125,
    backgroundColor: "#EEF4F5",
    position: "relative",
  },

  carImage: {
    width: "100%",
    height: "100%",
  },

  heartButton: {
    position: "absolute",
    right: 10,
    top: 10,
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },

  heart: {
    fontSize: 21,
    color: "#17313C",
  },

  carInfo: {
    padding: 14,
  },

  carName: {
    color: "#17313C",
    fontSize: 15,
    fontWeight: "900",
  },

  carDetails: {
    color: "#8798A1",
    fontSize: 11,
    marginTop: 4,
  },

  priceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 11,
  },

  price: {
    color: "#0B5363",
    fontSize: 17,
    fontWeight: "900",
  },

  perDay: {
    color: "#84969E",
    fontSize: 11,
    marginBottom: 2,
  },

  bookingCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4EBEE",
    borderRadius: 20,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
  },

  bookingImage: {
    width: 82,
    height: 68,
    borderRadius: 14,
    backgroundColor: "#E9F0F2",
  },

  bookingInfo: {
    flex: 1,
    paddingHorizontal: 12,
  },

  bookingTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  statusBadge: {
    backgroundColor: "#D6F6E7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },

  statusText: {
    color: "#159D66",
    fontWeight: "800",
    fontSize: 10,
  },

  bookingCode: {
    color: "#536872",
    fontWeight: "800",
    fontSize: 11,
  },

  bookingCar: {
    color: "#17313C",
    fontWeight: "900",
    fontSize: 14,
    marginTop: 7,
  },

  bookingDate: {
    color: "#899AA2",
    fontSize: 10,
    marginTop: 4,
  },

  chevron: {
    color: "#7D919A",
    fontSize: 28,
  },
});