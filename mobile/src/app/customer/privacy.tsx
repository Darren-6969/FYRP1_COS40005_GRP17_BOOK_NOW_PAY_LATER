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

export default function PrivacyScreen() {
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
          Privacy Policy
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
              name="shield-checkmark-outline"
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
              YOUR PRIVACY
            </Text>

            <Text
              style={
                styles.heroTitle
              }
            >
              Privacy Policy
            </Text>

            <Text
              style={
                styles.heroText
              }
            >
              This policy explains how information is collected, used, stored, and handled when you use the BNPL platform.
            </Text>
          </View>
        </View>

        <View
          style={
            styles.noticeCard
          }
        >
          <Ionicons
            name="lock-closed-outline"
            size={19}
            color="#07869B"
          />

          <Text
            style={
              styles.noticeText
            }
          >
            The BNPL platform uses customer information to support account management, bookings, payments, receipts, invoices, notifications, and related services.
          </Text>
        </View>

        <PrivacySection
          number="1"
          title="Information We Collect"
        >
          We may collect information provided through your account and booking activities, including your name, email address, phone number, profile image, booking information, payment status, receipt information, and account preferences.
        </PrivacySection>

        <PrivacySection
          number="2"
          title="Account Information"
        >
          Account information is used to identify your customer account, support authentication, display your profile, and associate bookings and payments with the correct customer.
        </PrivacySection>

        <PrivacySection
          number="3"
          title="Booking Information"
        >
          Booking information may include vehicle details, booking dates, pickup and return information, contact details, driver information, booking status, and operator information required to process your rental request.
        </PrivacySection>

        <PrivacySection
          number="4"
          title="Payment Information"
        >
          The platform stores information related to payment status, payment type, payment amount, payment deadlines, and transaction-related records required to manage the booking payment process.
        </PrivacySection>

        <PrivacySection
          number="5"
          title="Payment Processing"
        >
          Online payment processing may be handled through third-party payment service providers. The BNPL platform uses payment results and transaction information required to update the booking and payment status.
        </PrivacySection>

        <PrivacySection
          number="6"
          title="Manual Payment Receipts"
        >
          When you upload a manual payment receipt, the receipt image and related payment information may be stored so that the operator can review and verify the payment.
        </PrivacySection>

        <PrivacySection
          number="7"
          title="Invoices"
        >
          Invoice information may be generated and stored based on booking and payment records. This information may include invoice numbers, booking references, amounts, dates, payment status, and operator information.
        </PrivacySection>

        <PrivacySection
          number="8"
          title="How We Use Information"
        >
          Information may be used to provide account services, process booking requests, manage booking status, support payments, verify receipts, generate invoices, send notifications, and provide customer support.
        </PrivacySection>

        <PrivacySection
          number="9"
          title="Operator Access"
        >
          Relevant booking and payment information may be available to the operator responsible for processing your booking. Operators use this information to review booking requests, manage rentals, verify payments, and provide related services.
        </PrivacySection>

        <PrivacySection
          number="10"
          title="Notifications"
        >
          The platform may use your account and booking information to provide booking updates, payment reminders, invoice notifications, receipt updates, and optional promotional notifications according to your selected preferences.
        </PrivacySection>

        <PrivacySection
          number="11"
          title="Profile Information"
        >
          Customers may update supported profile information such as their name, phone number, and profile image. Some account information, such as the registered email address, may remain restricted to maintain record consistency.
        </PrivacySection>

        <PrivacySection
          number="12"
          title="Authentication and Security"
        >
          Authentication information is used to protect access to your account. Customers should keep their password secure and avoid sharing account credentials with unauthorized persons.
        </PrivacySection>

        <PrivacySection
          number="13"
          title="Data Storage"
        >
          Platform information may be stored in databases and supporting services used by the BNPL system. Reasonable measures should be used to protect stored information from unauthorized access or misuse.
        </PrivacySection>

        <PrivacySection
          number="14"
          title="Third-Party Services"
        >
          The platform may rely on third-party services for functions such as payment processing, hosting, email delivery, storage, and other technical services required to operate the application.
        </PrivacySection>

        <PrivacySection
          number="15"
          title="Data Sharing"
        >
          Customer information should only be shared when required to provide booking, payment, operator, technical, or legal services. Customer information should not be disclosed unnecessarily.
        </PrivacySection>

        <PrivacySection
          number="16"
          title="Data Retention"
        >
          Information may be retained for as long as reasonably necessary to support booking records, payment records, invoice records, account services, operational requirements, and other legitimate platform purposes.
        </PrivacySection>

        <PrivacySection
          number="17"
          title="Customer Choices"
        >
          Customers can manage supported account information and notification preferences through the Profile section of the mobile application.
        </PrivacySection>

        <PrivacySection
          number="18"
          title="Policy Updates"
        >
          This Privacy Policy may be updated when platform functionality, data handling practices, services, or operational requirements change.
        </PrivacySection>

        <View
          style={
            styles.footerCard
          }
        >
          <View
            style={
              styles.footerIcon
            }
          >
            <Ionicons
              name="person-circle-outline"
              size={22}
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
                styles.footerTitle
              }
            >
              Privacy Questions
            </Text>

            <Text
              style={
                styles.footerText
              }
            >
              If you have questions about your information or account, use Help & Support from your Profile page.
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

function PrivacySection({
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

    footerIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor:
        "#EAF8FA",
      alignItems: "center",
      justifyContent:
        "center",
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