import { Ionicons } from "@expo/vector-icons";

import {
  useRouter,
} from "expo-router";

import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function TermsScreen() {
  const router =
    useRouter();

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
    >
      <View
        style={
          styles.topBar
        }
      >
        <Pressable
          style={({ pressed }) => [
            styles.backButton,

            pressed && {
              opacity: 0.65,
            },
          ]}
          onPress={() =>
            router.back()
          }
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color="#17313C"
          />
        </Pressable>

        <Text
          style={
            styles.topBarTitle
          }
        >
          Terms & Conditions
        </Text>

        <View
          style={
            styles.topBarSpacer
          }
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.content
        }
      >
        <View
          style={
            styles.heroCard
          }
        >
          <View
            style={
              styles.heroIcon
            }
          >
            <Ionicons
              name="document-text-outline"
              size={28}
              color="#07869B"
            />
          </View>

          <View
            style={{
              flex: 1,
            }}
          >
            <Text
              style={
                styles.heroEyebrow
              }
            >
              BNPL PLATFORM
            </Text>

            <Text
              style={
                styles.heroTitle
              }
            >
              Terms & Conditions
            </Text>

            <Text
              style={
                styles.heroText
              }
            >
              Please review the following terms before using the BNPL booking and payment services.
            </Text>
          </View>
        </View>

        <View
          style={
            styles.noticeCard
          }
        >
          <Ionicons
            name="information-circle-outline"
            size={19}
            color="#07869B"
          />

          <Text
            style={
              styles.noticeText
            }
          >
            These terms describe the general use of the BNPL platform for booking, payment, receipt verification, and account services.
          </Text>
        </View>

        <TermsSection
          number="1"
          title="Acceptance of Terms"
        >
          By accessing or using the BNPL platform, you agree to comply with these Terms & Conditions and any applicable booking or rental requirements provided by the operator.
        </TermsSection>

        <TermsSection
          number="2"
          title="Account Information"
        >
          Customers are responsible for providing accurate account information, including their name, email address, phone number, and other information required for booking and payment processing.
        </TermsSection>

        <TermsSection
          number="3"
          title="Booking Requests"
        >
          A booking request submitted through the BNPL platform is not considered confirmed immediately. The booking remains pending until it is reviewed and accepted by the relevant operator.
        </TermsSection>

        <TermsSection
          number="4"
          title="Booking Approval"
        >
          Operators may accept or reject booking requests based on vehicle availability, booking requirements, customer information, or other operational considerations.
        </TermsSection>

        <TermsSection
          number="5"
          title="Payment Requirements"
        >
          Once a booking is accepted, customers may be required to complete a down payment, final payment, or full payment according to the payment arrangement assigned to the booking.
        </TermsSection>

        <TermsSection
          number="6"
          title="Payment Deadline"
        >
          Customers are responsible for completing required payments within the payment deadline shown in the booking or payment information. Failure to complete payment before the deadline may affect the booking status.
        </TermsSection>

        <TermsSection
          number="7"
          title="Manual Payment Receipts"
        >
          When manual payment is available, customers may upload a payment receipt for verification. Uploaded receipts remain pending until they are reviewed by the operator.
        </TermsSection>

        <TermsSection
          number="8"
          title="Receipt Verification"
        >
          Submission of a receipt does not automatically confirm payment. Payment is considered verified only after the operator reviews and approves the submitted receipt.
        </TermsSection>

        <TermsSection
          number="9"
          title="Payment Information"
        >
          Customers should review the payment amount and payment type before completing a transaction. Payment information displayed in the platform is based on the current booking and payment status.
        </TermsSection>

        <TermsSection
          number="10"
          title="Invoices"
        >
          An invoice may be generated for eligible bookings. Customers can access available invoice information through the booking or payment sections of the platform.
        </TermsSection>

        <TermsSection
          number="11"
          title="Booking Changes"
        >
          Changes to booking dates, vehicles, rental details, or other booking information may require approval from the operator and may affect the payment amount or booking status.
        </TermsSection>

        <TermsSection
          number="12"
          title="Booking Cancellation"
        >
          Booking cancellation may be subject to the operator's cancellation policy, payment status, rental conditions, and other applicable booking requirements.
        </TermsSection>

        <TermsSection
          number="13"
          title="Customer Responsibility"
        >
          Customers are responsible for reviewing their booking information, payment status, deadlines, notifications, and any instructions provided through the platform.
        </TermsSection>

        <TermsSection
          number="14"
          title="Platform Availability"
        >
          The BNPL platform may occasionally be unavailable due to maintenance, technical issues, network conditions, or other circumstances outside normal operation.
        </TermsSection>

        <TermsSection
          number="15"
          title="Security"
        >
          Customers are responsible for protecting their account credentials and should not share their password or authentication information with unauthorized persons.
        </TermsSection>

        <TermsSection
          number="16"
          title="Notifications"
        >
          The platform may provide booking, payment, invoice, receipt, and account-related notifications. Customers can manage supported notification preferences from their profile settings.
        </TermsSection>

        <TermsSection
          number="17"
          title="Operator Services"
        >
          Vehicle rental services are provided by the relevant operator. The BNPL platform supports the booking and payment process but does not replace the rental terms or operational requirements established by the operator.
        </TermsSection>

        <TermsSection
          number="18"
          title="Updates to Terms"
        >
          These Terms & Conditions may be updated when platform features, booking processes, payment services, or operational requirements change.
        </TermsSection>

        <View
          style={
            styles.footerCard
          }
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={21}
            color="#07869B"
          />

          <View
            style={{
              flex: 1,
            }}
          >
            <Text
              style={
                styles.footerTitle
              }
            >
              Need Assistance?
            </Text>

            <Text
              style={
                styles.footerText
              }
            >
              If you have questions about these terms, use Help & Support from your Profile page.
            </Text>
          </View>
        </View>

        <Text
          style={
            styles.lastUpdated
          }
        >
          Last updated: November 2026
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function TermsSection({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: string;
}) {
  return (
    <View
      style={
        styles.sectionCard
      }
    >
      <View
        style={
          styles.sectionHeader
        }
      >
        <View
          style={
            styles.sectionNumber
          }
        >
          <Text
            style={
              styles.sectionNumberText
            }
          >
            {number}
          </Text>
        </View>

        <Text
          style={
            styles.sectionTitle
          }
        >
          {title}
        </Text>
      </View>

      <Text
        style={
          styles.sectionText
        }
      >
        {children}
      </Text>
    </View>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        "#F5F8F9",
    },

    topBar: {
      height: 58,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      paddingHorizontal: 18,
      backgroundColor:
        "#FFFFFF",
      borderBottomWidth: 1,
      borderBottomColor:
        "#E6ECEE",
    },

    backButton: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        "#F2F6F7",
    },

    topBarTitle: {
      color: "#17313C",
      fontSize: 15,
      fontWeight: "900",
    },

    topBarSpacer: {
      width: 38,
    },

    content: {
      padding: 18,
      paddingBottom: 50,
    },

    heroCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      padding: 18,
      borderRadius: 22,
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#E1E8EB",
      marginBottom: 14,
    },

    heroIcon: {
      width: 54,
      height: 54,
      borderRadius: 18,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        "#EAF8FA",
    },

    heroEyebrow: {
      color: "#07869B",
      fontSize: 8,
      fontWeight: "900",
      letterSpacing: 1,
    },

    heroTitle: {
      marginTop: 4,
      color: "#17313C",
      fontSize: 20,
      fontWeight: "900",
    },

    heroText: {
      marginTop: 5,
      color: "#7E9098",
      fontSize: 9,
      lineHeight: 14,
    },

    noticeCard: {
      flexDirection: "row",
      alignItems:
        "flex-start",
      gap: 9,
      padding: 14,
      borderRadius: 15,
      backgroundColor:
        "#EAF8FA",
      marginBottom: 18,
    },

    noticeText: {
      flex: 1,
      color: "#55707A",
      fontSize: 8,
      lineHeight: 14,
    },

    sectionCard: {
      padding: 16,
      borderRadius: 17,
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#E1E8EB",
      marginBottom: 11,
    },

    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 9,
    },

    sectionNumber: {
      width: 28,
      height: 28,
      borderRadius: 9,
      backgroundColor:
        "#EAF8FA",
      alignItems: "center",
      justifyContent:
        "center",
    },

    sectionNumberText: {
      color: "#07869B",
      fontSize: 9,
      fontWeight: "900",
    },

    sectionTitle: {
      flex: 1,
      color: "#17313C",
      fontSize: 11,
      fontWeight: "900",
    },

    sectionText: {
      color: "#6F838C",
      fontSize: 9,
      lineHeight: 16,
    },

    footerCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      padding: 15,
      borderRadius: 17,
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#DCEBED",
      marginTop: 8,
    },

    footerTitle: {
      color: "#17313C",
      fontSize: 10,
      fontWeight: "900",
    },

    footerText: {
      marginTop: 3,
      color: "#7E9098",
      fontSize: 8,
      lineHeight: 13,
    },

    lastUpdated: {
      marginTop: 17,
      textAlign: "center",
      color: "#9BA8AD",
      fontSize: 8,
    },
  });