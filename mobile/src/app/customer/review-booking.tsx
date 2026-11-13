import { Ionicons } from "@expo/vector-icons";
import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useEffect, useState } from "react";
import { quotePublicCar } from "../../services/carApi";
import { createCarBooking, } from "../../services/customerApi";
import { logger } from "@/utils/logger";
import { useIdempotentAttempt } from "@/hooks/use-idempotent-attempt";

export default function ReviewBooking() {
  const router = useRouter();

  const params =
    useLocalSearchParams<{
      listingId?: string;

      city?: string;
      from?: string;
      ft?: string;
      to?: string;
      tt?: string;

      fullName?: string;
      email?: string;
      phone?: string;

      driverIsBooker?: string;
      driverName?: string;
      dateOfBirth?: string;
      licenceIssuedIn?: string;

      termsAccepted?: string;
      rentalTermsAccepted?: string;
      forfeitureAccepted?: string;

      pickupPointId?: string;
      dropoffPointId?: string;

      cdw?: string;
    }>();

    const cdwSelected = params.cdw === "true";

  const driverIsBooker =
    params.driverIsBooker === "true";

  const termsAccepted =
  params.termsAccepted === "true";

  const rentalTermsAccepted =
  params.rentalTermsAccepted === "true";

  const forfeitureAccepted =
  params.forfeitureAccepted === "true";

  const [submitting, setSubmitting] =
  useState(false);

  const bookingAttempt = useIdempotentAttempt();

  const [submitError, setSubmitError] =
  useState("");

  
  const [bookingQuote, setBookingQuote] =
  useState<any | null>(null);

  const [quoteLoading, setQuoteLoading] =
  useState(true);

  const [quoteError, setQuoteError] =
  useState("");

// Load the backend quote before booking submission.
useEffect(() => {
  if (
    !params.listingId ||
    !params.from ||
    !params.to ||
    !params.pickupPointId ||
    !params.dropoffPointId ||
    !params.cdw
  ) {
    setQuoteLoading(false);
    setQuoteError("Booking location or date is missing.");
    return;
  }

  let active = true;

  const loadQuote = async () => {
    try {
      setQuoteLoading(true);
      setQuoteError("");

      const response = await quotePublicCar(
        params.listingId!,
        {
          from: params.from,
          ft: params.ft || "10:00",
          to: params.to,
          tt: params.tt || "10:00",
          pickupPointId: params.pickupPointId,
          dropoffPointId: params.dropoffPointId,
          driverDateOfBirth: params.dateOfBirth || undefined,
          cdw: cdwSelected,
          addOns: {},
        }
      );

      if (!active) return;

      if (
        response.problems?.length ||
        !response.quote ||
        response.availability?.available === false
      ) {
        throw new Error(
          response.problems?.[0]?.message ||
            "The selected car or rental period is unavailable."
        );
      }

logger.debug("BOOKING PRICE DETAILS:", {
  rentalSen: response.quote.rentalSen,
  pickupFeeSen: response.quote.pickupFeeSen,
  dropoffFeeSen: response.quote.dropoffFeeSen,
  overtimeSen: response.quote.overtimeSen,
  nightHandovers: response.quote.nightHandovers,
  youngDriverSurchargeSen:
    response.quote.youngDriverSurchargeSen,
  addOnsSen: response.quote.addOnsSen,
  addOnLines: response.quote.addOnLines,
  totalSen: response.quote.totalSen,
});

      setBookingQuote(response.quote);
    } catch (err: any) {
      if (active) {
        setBookingQuote(null);
        setQuoteError(
          err?.message || "Unable to calculate booking price."
        );
      }
    } finally {
      if (active) {
        setQuoteLoading(false);
      }
    }
  };

  loadQuote();

  return () => {
    active = false;
  };
}, [
  params.listingId,
  params.from,
  params.ft,
  params.to,
  params.tt,
  params.pickupPointId,
  params.dropoffPointId,
  params.dateOfBirth,
]);


  const finalDriverName =
    driverIsBooker
      ? params.fullName
      : params.driverName;

  const handleSubmit = () =>
    bookingAttempt.run(submitBooking);

  const submitBooking = async () => {
  try {
    setSubmitting(true);
    setSubmitError("");

    if (!params.listingId) {
      throw new Error(
        "Missing vehicle information."
      );
    }

    // Verify the backend quote before booking submission.
    if (quoteLoading || quoteError || !bookingQuote) {
      throw new Error(
        quoteError ||
          "Please wait until the booking price is verified."
      );
    }

    const pickupAt =
      buildMalaysiaDateTime(
        params.from,
        params.ft
      );

    const returnAt =
      buildMalaysiaDateTime(
        params.to,
        params.tt
      );

    if (!pickupAt || !returnAt) {
      throw new Error(
        "Pick-up or return date is missing."
      );
    }

    // Everything the request sends except the acceptance timestamps.
    // Same details -> same attempt and key; changed details -> new key.
    const request = {
        listingId: Number(
          params.listingId
        ),

        pickupAt,
        returnAt,

        
        pickupPointId: params.pickupPointId || null,

        dropoffPointId: params.dropoffPointId || null,

        requestedLocation: null,

        requestedDropoffLocation: null,

        returnToRequested: false,

        cdw: cdwSelected,

        addOns: [],

        bookingDetails: {
          contact: {
            fullName:
              params.fullName || "",

            email:
              params.email || null,

            phone:
              params.phone || "",
          },

          driver: {
            isBooker:
              driverIsBooker,

            fullName:
              finalDriverName || "",

            // Sent only when the operator's age rules asked for it; an
            // empty string would fail the server's date check.
            ...(params.dateOfBirth
              ? { dateOfBirth: params.dateOfBirth }
              : {}),

            licenceIssuedIn:
              params.licenceIssuedIn ||
              "Malaysia",
          },

          chauffeur: {
            requested: false,
            note: null,
          },
        },
      };

    const attempt =
      bookingAttempt.attemptFor(
        JSON.stringify(request)
      );

    // Fixed per attempt, so a retry sends the identical body.
    const acceptedAt = attempt.startedAt;

    const data =
      await createCarBooking(
        {
          ...request,
          bookingDetails: {
            ...request.bookingDetails,
            agreements: {
              termsOfServiceAcceptedAt:
                acceptedAt,

              rentalTermsAcceptedAt:
                acceptedAt,

              forfeitureAcceptedAt:
                acceptedAt,
            },
          },
        },
        attempt.key
      );

    bookingAttempt.finish();

    logger.debug(
      "Booking created:",
      data
    );

    router.replace(
      `/customer/booking/${data.id}`
    );
  } catch (error: any) {
    logger.error(
      "Booking submission failed:",
      error
    );

    setSubmitError(
      error?.message ||
        "Unable to submit booking."
    );
  } finally {
    setSubmitting(false);
  }
};

  function buildMalaysiaDateTime(
  date?: string,
  time?: string
) {
  if (!date) {
    return "";
  }

  const safeTime =
    time && time.length >= 5
      ? time
      : "10:00";

  return `${date}T${safeTime}:00+08:00`;
}

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Pressable
          style={styles.headerButton}
          onPress={() => router.back()}
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color="#17313C"
          />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            Review Booking
          </Text>

          <Text style={styles.headerSubtitle}>
            Check your details before submitting
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Rental */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons
              name="car-sport-outline"
              size={20}
              color="#07869B"
            />

            <Text style={styles.sectionTitle}>
              Rental Details
            </Text>
          </View>

          <DetailRow
            label="Location"
            value={
              params.city ||
              "Selected branch"
            }
          />

          <DetailRow
            label="Pick-up"
            value={`${params.from || "—"} · ${
              params.ft || "10:00"
            }`}
          />

          <DetailRow
            label="Return"
            value={`${params.to || "—"} · ${
              params.tt || "10:00"
            }`}
          />
        </View>

        {/* Contact */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons
              name="person-outline"
              size={20}
              color="#07869B"
            />

            <Text style={styles.sectionTitle}>
              Contact Information
            </Text>
          </View>

          <DetailRow
            label="Full Name"
            value={params.fullName || "—"}
          />

          <DetailRow
            label="Email"
            value={params.email || "—"}
          />

          <DetailRow
            label="Phone"
            value={params.phone || "—"}
          />
        </View>

        {/* Driver */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons
              name="card-outline"
              size={20}
              color="#07869B"
            />

            <Text style={styles.sectionTitle}>
              Driver Information
            </Text>
          </View>

          <DetailRow
            label="Driver"
            value={
              finalDriverName || "—"
            }
          />

          {params.dateOfBirth ? (
            <DetailRow
              label="Date of Birth"
              value={params.dateOfBirth}
            />
          ) : null}

          <DetailRow
            label="Licence Issued In"
            value={
              params.licenceIssuedIn ||
              "—"
            }
          />
        </View>

        <View style={styles.section}>
        <View style={styles.sectionHeader}>
            <Ionicons
            name="document-text-outline"
            size={20}
            color="#07869B"
            />

            <Text style={styles.sectionTitle}>
            Agreements
            </Text>
        </View>

        <AgreementReviewRow
            label="Terms of Service"
            accepted={termsAccepted}
        />

        <AgreementReviewRow
            label="Rental Terms"
            accepted={rentalTermsAccepted}
        />

        <AgreementReviewRow
            label="Deposit Forfeiture"
            accepted={forfeitureAccepted}
        />
        </View>

        {/* Flow Notice */}
        <View style={styles.noticeCard}>
          <Ionicons
            name="information-circle-outline"
            size={21}
            color="#07869B"
          />

          <View style={{ flex: 1 }}>
            <Text style={styles.noticeTitle}>
              Booking request
            </Text>

            <Text style={styles.noticeText}>
              Your request will be sent to the
              rental operator for approval.
              Payment is only required after the
              operator accepts your booking.
            </Text>
          </View>
        </View>
      </ScrollView>

      {submitError ? (
        <View style={styles.errorCard}>
            <Ionicons
            name="alert-circle-outline"
            size={18}
            color="#B94747"
            />

            <Text style={styles.errorText}>
            {submitError}
            </Text>
        </View>
        ) : null}

        
<View
  style={{
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    marginVertical: 18,
    borderWidth: 1,
    borderColor: "#E3EAED",
  }}
>
  <Text
    style={{
      color: "#17313C",
      fontSize: 18,
      fontWeight: "800",
      marginBottom: 15,
    }}
  >
    Rental Price Breakdown
  </Text>

  {quoteLoading ? (
    <Text style={{ color: "#81939C" }}>
      Calculating final price...
    </Text>
  ) : quoteError ? (
    <Text style={{ color: "#D14343" }}>
      {quoteError}
    </Text>
  ) : bookingQuote ? (
    <>
      <Text style={{ marginBottom: 10, color: "#17313C" }}>
        Pickup: {bookingQuote.pickupPoint?.label || "—"}
      </Text>

      <Text style={{ marginBottom: 10, color: "#17313C" }}>
        Drop-off: {bookingQuote.dropoffPoint?.label || "—"}
      </Text>

      <Text style={{ marginBottom: 10, color: "#17313C" }}>
        Rental:
        {" RM "}
        {(Number(bookingQuote.rentalSen || 0) / 100).toFixed(2)}
      </Text>

      <Text style={{ marginBottom: 10, color: "#17313C" }}>
        Pickup Fee:
        {" RM "}
        {(Number(bookingQuote.pickupFeeSen || 0) / 100).toFixed(2)}
      </Text>

      <Text style={{ marginBottom: 10, color: "#17313C" }}>
        Drop-off Fee:
        {" RM "}
        {(Number(bookingQuote.dropoffFeeSen || 0) / 100).toFixed(2)}
      </Text>

      
{Number(bookingQuote.overtimeSen || 0) > 0 && (
  <Text style={{ marginBottom: 10, color: "#17313C" }}>
    Night Handover Fee
    {bookingQuote.nightHandovers
      ? ` (${bookingQuote.nightHandovers} time(s))`
      : ""}
    : RM{" "}
    {(Number(bookingQuote.overtimeSen) / 100).toFixed(2)}
  </Text>
)}

{Number(bookingQuote.youngDriverSurchargeSen || 0) > 0 && (
  <Text style={{ marginBottom: 10, color: "#17313C" }}>
    Young Driver Surcharge: RM{" "}
    {(
      Number(bookingQuote.youngDriverSurchargeSen) / 100
    ).toFixed(2)}
  </Text>
)}

{(bookingQuote.addOnLines || []).map(
  (item: {
    id: string;
    label: string;
    amountSen: number;
  }) => (
    <Text
      key={item.id}
      style={{ marginBottom: 10, color: "#17313C" }}
    >
      {item.label}: RM{" "}
      {(Number(item.amountSen) / 100).toFixed(2)}
    </Text>
  )
)}


{(() => {
  const quote = bookingQuote;

  const displayedSum =
    Number(quote.rentalSen || 0) +
    Number(quote.pickupFeeSen || 0) +
    Number(quote.dropoffFeeSen || 0) +
    Number(quote.overtimeSen || 0) +
    Number(quote.youngDriverSurchargeSen || 0) +
    Number(quote.addOnsSen || 0);

  const difference =
    Number(quote.totalSen || 0) - displayedSum;

  return difference !== 0 ? (
    <Text style={{ color: "#D14343", marginBottom: 10 }}>
      Price breakdown mismatch: RM{" "}
      {(difference / 100).toFixed(2)}
    </Text>
  ) : null;
})()}

      <View
        style={{
          height: 1,
          backgroundColor: "#E3EAED",
          marginVertical: 13,
        }}
      />

      <Text
        style={{
          color: "#07869B",
          fontWeight: "900",
          fontSize: 20,
        }}
      >
        Total: RM {(Number(bookingQuote.totalSen) / 100).toFixed(2)}
      </Text>

      <Text style={{ color: "#81939C", marginTop: 7 }}>
        Final amount calculated by the BNPL backend.
      </Text>
    </>
  ) : null}
</View>


      <View style={styles.footer}>
        <Pressable
            disabled={submitting}
            style={[
                styles.submitButton,
                submitting &&
                styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            >
          <Text style={styles.submitText}>
          {submitting
            ? "Submitting..."
            : "Confirm & Submit"}
          </Text>
            
          {!submitting && (
            <Ionicons
            name="checkmark-circle-outline"
            size={19}
            color="#FFFFFF"
            />
        )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>
        {label}
      </Text>

      <Text style={styles.detailValue}>
        {value}
      </Text>
    </View>
  );
}

function AgreementReviewRow({
  label,
  accepted,
}: {
  label: string;
  accepted: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>
        {label}
      </Text>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
        }}
      >
        <Ionicons
          name={
            accepted
              ? "checkmark-circle"
              : "close-circle"
          }
          size={17}
          color={
            accepted
              ? "#07869B"
              : "#C45A5A"
          }
        />

        <Text style={styles.detailValue}>
          {accepted
            ? "Accepted"
            : "Not Accepted"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7FAFB",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5ECEF",
  },

  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#F3F7F8",
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#17313C",
  },

  headerSubtitle: {
    fontSize: 10,
    color: "#83969E",
    marginTop: 2,
  },

  content: {
    padding: 18,
    paddingBottom: 125,
  },

  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E3EAED",
    padding: 16,
    marginBottom: 16,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 13,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#17313C",
  },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F3",
  },

  detailLabel: {
    color: "#82949C",
    fontSize: 10,
  },

  detailValue: {
    flex: 1,
    textAlign: "right",
    color: "#17313C",
    fontSize: 11,
    fontWeight: "800",
  },

  noticeCard: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#EAF8FA",
    padding: 15,
    borderRadius: 17,
  },

  noticeTitle: {
    color: "#17313C",
    fontSize: 12,
    fontWeight: "900",
  },

  noticeText: {
    color: "#58757D",
    fontSize: 10,
    lineHeight: 16,
    marginTop: 3,
  },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E3EAED",
    paddingHorizontal: 18,
    paddingTop: 13,
    paddingBottom: 20,
  },

  submitButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: "#07869B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  submitText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },

  errorCard: {
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
  backgroundColor: "#FFF1F1",
  borderWidth: 1,
  borderColor: "#F3CCCC",
  padding: 12,
  borderRadius: 14,
  marginTop: 14,
},

errorText: {
  flex: 1,
  color: "#A33E3E",
  fontSize: 11,
  fontWeight: "700",
},

submitButtonDisabled: {
  opacity: 0.65,
},
});