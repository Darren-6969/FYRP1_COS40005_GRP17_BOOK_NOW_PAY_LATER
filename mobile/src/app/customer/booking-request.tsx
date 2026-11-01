import { Ionicons } from "@expo/vector-icons";
import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useState } from "react";

import DateTimePicker from "@react-native-community/datetimepicker";

export default function BookingRequest() {
  const router = useRouter();

  const params =
    useLocalSearchParams<{
      listingId?: string;
      city?: string;
      from?: string;
      ft?: string;
      to?: string;
      tt?: string;
    }>();

  const [fullName, setFullName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [driverIsBooker, setDriverIsBooker] =
    useState(true);

  const [driverName, setDriverName] =
    useState("");

  const [dateOfBirth, setDateOfBirth] =
    useState("");

  const [showDobPicker, setShowDobPicker] =
  useState(false);

  const [licenceIssuedIn, setLicenceIssuedIn] =
    useState("Malaysia");

  const [termsAccepted, setTermsAccepted] =
    useState(false);

  const [
    rentalTermsAccepted,
    setRentalTermsAccepted,
  ] = useState(false);

  const [
    forfeitureAccepted,
    setForfeitureAccepted,
  ] = useState(false);

  const handleContinue = () => {
  const finalDriverName =
    driverIsBooker
      ? fullName
      : driverName;

  router.push({
    pathname:
      "/customer/review-booking",

    params: {
      listingId:
        params.listingId || "",

      city:
        params.city || "",

      from:
        params.from || "",

      ft:
        params.ft || "10:00",

      to:
        params.to || "",

      tt:
        params.tt || "10:00",

      fullName:
        fullName.trim(),

      email:
        email.trim(),

      phone:
        phone.trim(),

      driverIsBooker:
        String(driverIsBooker),

      driverName:
        finalDriverName || "",

      dateOfBirth,

      licenceIssuedIn:
        licenceIssuedIn.trim(),

      termsAccepted:
        String(termsAccepted),

      rentalTermsAccepted:
        String(
          rentalTermsAccepted
        ),

      forfeitureAccepted:
        String(
          forfeitureAccepted
        ),
    },
  });
};

  const canContinue =
    fullName.trim().length >= 2 &&
    phone.trim().length > 0 &&
    dateOfBirth.trim().length > 0 &&
    licenceIssuedIn.trim().length > 0 &&
    termsAccepted &&
    rentalTermsAccepted &&
    forfeitureAccepted &&
    (driverIsBooker ||
      driverName.trim().length >= 2);

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <StatusBar style="dark" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        <View style={styles.header}>
          <Pressable
            style={styles.headerButton}
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

          <View style={{ flex: 1 }}>
            <Text
              style={styles.headerTitle}
            >
              Booking Request
            </Text>

            <Text
              style={
                styles.headerSubtitle
              }
            >
              Complete your rental
              information
            </Text>
          </View>
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
            style={styles.tripCard}
          >
            <View
              style={
                styles.tripHeader
              }
            >
              <Ionicons
                name="car-sport-outline"
                size={21}
                color="#07869B"
              />

              <Text
                style={
                  styles.tripTitle
                }
              >
                Your Rental
              </Text>
            </View>

            <View
              style={styles.tripRow}
            >
              <Text
                style={
                  styles.tripLabel
                }
              >
                Location
              </Text>

              <Text
                style={
                  styles.tripValue
                }
              >
                {params.city ||
                  "Selected branch"}
              </Text>
            </View>

            <View
              style={styles.tripRow}
            >
              <Text
                style={
                  styles.tripLabel
                }
              >
                Pick-up
              </Text>

              <Text
                style={
                  styles.tripValue
                }
              >
                {params.from ||
                  "—"}{" "}
                ·{" "}
                {params.ft ||
                  "10:00"}
              </Text>
            </View>

            <View
              style={styles.tripRow}
            >
              <Text
                style={
                  styles.tripLabel
                }
              >
                Return
              </Text>

              <Text
                style={
                  styles.tripValue
                }
              >
                {params.to ||
                  "—"}{" "}
                ·{" "}
                {params.tt ||
                  "10:00"}
              </Text>
            </View>
          </View>

          <Text
            style={
              styles.sectionTitle
            }
          >
            Contact Information
          </Text>

          <View
            style={styles.section}
          >
            <Text
              style={
                styles.inputLabel
              }
            >
              Full Name
            </Text>

            <TextInput
              value={fullName}
              onChangeText={
                setFullName
              }
              placeholder="Enter your full name"
              style={styles.input}
            />

            <Text
              style={
                styles.inputLabel
              }
            >
              Email
            </Text>

            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="example@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />

            <Text
              style={
                styles.inputLabel
              }
            >
              Malaysian Phone Number
            </Text>

            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="+60123456789"
              keyboardType="phone-pad"
              style={styles.input}
            />
          </View>

          <Text
            style={
              styles.sectionTitle
            }
          >
            Driver Information
          </Text>

          <View
            style={styles.section}
          >
            <View
              style={
                styles.switchRow
              }
            >
              <View
                style={{ flex: 1 }}
              >
                <Text
                  style={
                    styles.switchTitle
                  }
                >
                  I am the driver
                </Text>

                <Text
                  style={
                    styles.switchDescription
                  }
                >
                  Use the contact
                  name as the driver
                  name.
                </Text>
              </View>

              <Switch
                value={
                  driverIsBooker
                }
                onValueChange={
                  setDriverIsBooker
                }
                trackColor={{
                  true: "#07869B",
                }}
              />
            </View>

            {!driverIsBooker ? (
              <>
                <Text
                  style={
                    styles.inputLabel
                  }
                >
                  Driver Full Name
                </Text>

                <TextInput
                  value={driverName}
                  onChangeText={
                    setDriverName
                  }
                  placeholder="Enter driver's full name"
                  style={styles.input}
                />
              </>
            ) : null}

            <Text style={styles.inputLabel}>
            Date of Birth
            </Text>

            <Pressable
            style={styles.datePickerButton}
            onPress={() =>
                setShowDobPicker(true)
            }
            >
            <View style={styles.datePickerLeft}>
                <Ionicons
                name="calendar-outline"
                size={19}
                color="#07869B"
                />

                <Text
                style={[
                    styles.datePickerText,
                    !dateOfBirth &&
                    styles.datePickerPlaceholder,
                ]}
                >
                {dateOfBirth
                    ? new Date(
                        `${dateOfBirth}T12:00:00`
                    ).toLocaleDateString(
                        "en-MY",
                        {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        }
                    )
                    : "Select date of birth"}
                </Text>
            </View>

            <Ionicons
                name="chevron-forward"
                size={18}
                color="#9AABB2"
            />
            </Pressable>

            <Text
              style={
                styles.inputLabel
              }
            >
              Licence Issued In
            </Text>

            <TextInput
              value={
                licenceIssuedIn
              }
              onChangeText={
                setLicenceIssuedIn
              }
              placeholder="Malaysia"
              style={styles.input}
            />
          </View>

          {showDobPicker && (
            <View style={styles.dobPickerWrapper}>
                <DateTimePicker
                value={
                    dateOfBirth
                    ? new Date(
                        `${dateOfBirth}T12:00:00`
                        )
                    : new Date(
                        2000,
                        0,
                        1
                        )
                }
                mode="date"
                display={
                    Platform.OS === "ios"
                    ? "spinner"
                    : "default"
                }
                themeVariant="light"
                textColor="#17313C"
                maximumDate={new Date()}
                onChange={(
                    event,
                    selectedDate
                ) => {
                    if (!selectedDate) {
                    if (
                        Platform.OS !== "ios"
                    ) {
                        setShowDobPicker(false);
                    }

                    return;
                    }

                    const year =
                    selectedDate.getFullYear();

                    const month =
                    String(
                        selectedDate.getMonth() +
                        1
                    ).padStart(2, "0");

                    const day =
                    String(
                        selectedDate.getDate()
                    ).padStart(2, "0");

                    setDateOfBirth(
                    `${year}-${month}-${day}`
                    );

                    if (
                    Platform.OS !== "ios"
                    ) {
                    setShowDobPicker(false);
                    }
                }}
                />

                {Platform.OS === "ios" && (
                <Pressable
                    style={
                    styles.dobDoneButton
                    }
                    onPress={() =>
                    setShowDobPicker(false)
                    }
                >
                    <Text
                    style={
                        styles.dobDoneText
                    }
                    >
                    Done
                    </Text>
                </Pressable>
                )}
            </View>
            )}

          <Text
            style={
              styles.sectionTitle
            }
          >
            Agreements
          </Text>

          <View
            style={styles.section}
          >
            <AgreementRow
              value={termsAccepted}
              onChange={
                setTermsAccepted
              }
              title="Terms of Service"
              description="I agree to the platform Terms of Service."
            />

            <AgreementRow
              value={
                rentalTermsAccepted
              }
              onChange={
                setRentalTermsAccepted
              }
              title="Rental Terms"
              description="I agree to the rental terms for this booking."
            />

            <AgreementRow
              value={
                forfeitureAccepted
              }
              onChange={
                setForfeitureAccepted
              }
              title="Deposit Forfeiture"
              description="I acknowledge the applicable deposit forfeiture rule."
            />
          </View>

          <View
            style={
              styles.infoCard
            }
          >
            <Ionicons
              name="information-circle-outline"
              size={20}
              color="#07869B"
            />

            <Text
              style={styles.infoText}
            >
              Submitting this form
              sends a booking request
              to the rental operator.
              Payment is only required
              after the operator
              accepts the request.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            disabled={!canContinue}
            style={[
              styles.continueButton,
              !canContinue &&
                styles.continueButtonDisabled,
            ]}
            onPress={
              handleContinue
            }
          >
            <Text
              style={
                styles.continueText
              }
            >
              Review Booking
            </Text>

            <Ionicons
              name="arrow-forward"
              size={18}
              color="#FFFFFF"
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AgreementRow({
  value,
  onChange,
  title,
  description,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <Pressable
      style={styles.agreementRow}
      onPress={() =>
        onChange(!value)
      }
    >
      <View
        style={[
          styles.checkbox,
          value &&
            styles.checkboxActive,
        ]}
      >
        {value ? (
          <Ionicons
            name="checkmark"
            size={16}
            color="#FFFFFF"
          />
        ) : null}
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={
            styles.agreementTitle
          }
        >
          {title}
        </Text>

        <Text
          style={
            styles.agreementDescription
          }
        >
          {description}
        </Text>
      </View>
    </Pressable>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        "#F7FAFB",
    },

    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 18,
      paddingVertical: 14,
      backgroundColor:
        "#FFFFFF",
      borderBottomWidth: 1,
      borderBottomColor:
        "#E5ECEF",
    },

    headerButton: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor:
        "#F3F7F8",
      alignItems: "center",
      justifyContent: "center",
    },

    headerTitle: {
      color: "#17313C",
      fontSize: 18,
      fontWeight: "900",
    },

    headerSubtitle: {
      color: "#83969E",
      fontSize: 10,
      marginTop: 2,
    },

    content: {
      padding: 18,
      paddingBottom: 130,
    },

    tripCard: {
      backgroundColor:
        "#EAF8FA",
      borderRadius: 18,
      padding: 16,
      marginBottom: 20,
    },

    tripHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 12,
    },

    tripTitle: {
      color: "#17313C",
      fontSize: 14,
      fontWeight: "900",
    },

    tripRow: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      marginTop: 8,
      gap: 20,
    },

    tripLabel: {
      color: "#749099",
      fontSize: 10,
    },

    tripValue: {
      flex: 1,
      textAlign: "right",
      color: "#17313C",
      fontSize: 11,
      fontWeight: "800",
    },

    sectionTitle: {
      color: "#17313C",
      fontSize: 15,
      fontWeight: "900",
      marginTop: 7,
      marginBottom: 10,
    },

    section: {
      backgroundColor:
        "#FFFFFF",
      borderRadius: 18,
      borderWidth: 1,
      borderColor: "#E3EAED",
      padding: 15,
      marginBottom: 20,
    },

    inputLabel: {
      color: "#70858E",
      fontSize: 10,
      fontWeight: "700",
      marginBottom: 6,
      marginTop: 9,
    },

    input: {
      minHeight: 50,
      borderWidth: 1,
      borderColor: "#DDE7EA",
      borderRadius: 14,
      paddingHorizontal: 13,
      color: "#17313C",
      fontSize: 13,
      backgroundColor:
        "#FAFCFD",
    },

    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 10,
    },

    switchTitle: {
      color: "#17313C",
      fontSize: 13,
      fontWeight: "800",
    },

    switchDescription: {
      color: "#84969E",
      fontSize: 10,
      marginTop: 3,
    },

    agreementRow: {
      flexDirection: "row",
      gap: 11,
      paddingVertical: 10,
      alignItems: "flex-start",
    },

    checkbox: {
      width: 23,
      height: 23,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: "#C8D6DA",
      alignItems: "center",
      justifyContent: "center",
      marginTop: 1,
    },

    checkboxActive: {
      backgroundColor:
        "#07869B",
      borderColor: "#07869B",
    },

    agreementTitle: {
      color: "#17313C",
      fontSize: 12,
      fontWeight: "800",
    },

    agreementDescription: {
      color: "#83969E",
      fontSize: 10,
      lineHeight: 15,
      marginTop: 3,
    },

    infoCard: {
      flexDirection: "row",
      gap: 10,
      padding: 14,
      borderRadius: 16,
      backgroundColor:
        "#EAF8FA",
    },

    infoText: {
      flex: 1,
      color: "#52727B",
      fontSize: 10,
      lineHeight: 16,
    },

    footer: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor:
        "#FFFFFF",
      borderTopWidth: 1,
      borderTopColor: "#E4EBEE",
      paddingHorizontal: 18,
      paddingTop: 13,
      paddingBottom: 20,
    },

    continueButton: {
      height: 54,
      borderRadius: 16,
      backgroundColor:
        "#07869B",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },

    continueButtonDisabled: {
      backgroundColor:
        "#A9BEC3",
    },

    continueText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "900",
    },

    datePickerButton: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: "#DDE7EA",
    borderRadius: 14,
    paddingHorizontal: 13,
    backgroundColor: "#FAFCFD",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    },

    datePickerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    },

    datePickerText: {
    color: "#17313C",
    fontSize: 13,
    fontWeight: "800",
    },

    datePickerPlaceholder: {
    color: "#9AA9AF",
    fontWeight: "600",
    },

    dobPickerWrapper: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EAED",
    borderRadius: 18,
    marginBottom: 20,
    overflow: "hidden",
    },

    dobDoneButton: {
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderTopWidth: 1,
    borderTopColor: "#E7ECEF",
    },

    dobDoneText: {
    color: "#07869B",
    fontSize: 13,
    fontWeight: "900",
    },
  });