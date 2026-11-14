import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { paymentStepsFromQuote, QuoteBreakdown } from "@/components/booking/QuoteBreakdown";
import { TripCard } from "@/components/booking/TripCard";
import {
  AppText,
  Button,
  ErrorState,
  FLOATING_BAR_CLEARANCE,
  FloatingActionBar,
  GlassCard,
  IconButton,
  Money,
  PaymentSchedule,
  SkeletonText,
} from "@/components/ui";
import { useIdempotentAttempt } from "@/hooks/use-idempotent-attempt";
import { useTheme } from "@/hooks/use-theme";
import { getPublicCarById, quotePublicCar } from "@/services/carApi";
import { createCarBooking } from "@/services/customerApi";
import { formatMYT, mytToIso } from "@/utils/datetime";
import { logger } from "@/utils/logger";

type Params = {
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
};

/**
 * Step 2 of 2: everything the customer entered plus the server's final
 * quote, then "Send request". The amounts are the server's quote as-is;
 * the old "Price breakdown mismatch" check that re-added them is gone (F16).
 */
export default function ReviewBooking() {
  const router = useRouter();
  const params = useLocalSearchParams<Params>();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();

  const cdwSelected = params.cdw === "true";
  const driverIsBooker = params.driverIsBooker === "true";
  const finalDriverName = driverIsBooker ? params.fullName : params.driverName;

  const bookingAttempt = useIdempotentAttempt();
  const [submitError, setSubmitError] = useState<unknown>(null);

  const [car, setCar] = useState<any | null>(null);
  const [quote, setQuote] = useState<any | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [quoteError, setQuoteError] = useState<unknown>(null);

  const loadQuote = useCallback(async () => {
    if (!params.listingId || !params.from || !params.to || !params.pickupPointId || !params.dropoffPointId) {
      setQuoteLoading(false);
      setQuoteError(new Error("The pick-up, drop-off or dates are missing. Go back and check them."));
      return;
    }
    setQuoteLoading(true);
    setQuoteError(null);
    try {
      const response = await quotePublicCar(params.listingId, {
        from: params.from,
        ft: params.ft || "10:00",
        to: params.to,
        tt: params.tt || "10:00",
        pickupPointId: params.pickupPointId,
        dropoffPointId: params.dropoffPointId,
        driverDateOfBirth: params.dateOfBirth || undefined,
        cdw: cdwSelected,
        addOns: {},
      });
      if (response.problems?.length || !response.quote || response.availability?.available === false) {
        throw new Error(response.problems?.[0]?.message || "This car isn't available for these dates any more.");
      }
      setQuote(response.quote);
    } catch (err) {
      setQuote(null);
      setQuoteError(err);
    } finally {
      setQuoteLoading(false);
    }
  }, [
    params.listingId,
    params.from,
    params.ft,
    params.to,
    params.tt,
    params.pickupPointId,
    params.dropoffPointId,
    params.dateOfBirth,
    cdwSelected,
  ]);

  useEffect(() => {
    loadQuote();
    if (params.listingId) {
      getPublicCarById(params.listingId)
        .then(setCar)
        .catch((err) => logger.debug("Failed to load car for review:", err));
    }
  }, [loadQuote, params.listingId]);

  const submitBooking = async () => {
    setSubmitError(null);
    try {
      if (!params.listingId) throw new Error("Missing vehicle information.");
      // Only the server's verified quote can be submitted.
      if (quoteLoading || quoteError || !quote) {
        throw new Error("Please wait until the price is confirmed.");
      }
      if (!params.from || !params.to) throw new Error("Pick-up or return date is missing.");

      // Everything the request sends except the acceptance timestamps.
      // Same details -> same attempt and key; changed details -> new key (F1).
      const request = {
        listingId: Number(params.listingId),
        pickupAt: mytToIso(params.from, params.ft || "10:00"),
        returnAt: mytToIso(params.to, params.tt || "10:00"),
        pickupPointId: params.pickupPointId || null,
        dropoffPointId: params.dropoffPointId || null,
        requestedLocation: null,
        requestedDropoffLocation: null,
        returnToRequested: false,
        cdw: cdwSelected,
        addOns: [],
        bookingDetails: {
          contact: {
            fullName: params.fullName || "",
            email: params.email || null,
            phone: params.phone || "",
          },
          driver: {
            isBooker: driverIsBooker,
            fullName: finalDriverName || "",
            // Sent only when the operator's age rules asked for it; an
            // empty string would fail the server's date check.
            ...(params.dateOfBirth ? { dateOfBirth: params.dateOfBirth } : {}),
            licenceIssuedIn: params.licenceIssuedIn || "Malaysia",
          },
          chauffeur: { requested: false, note: null },
        },
      };

      const attempt = bookingAttempt.attemptFor(JSON.stringify(request));
      // Fixed per attempt, so a retry sends the identical body.
      const acceptedAt = attempt.startedAt;

      const data = await createCarBooking(
        {
          ...request,
          bookingDetails: {
            ...request.bookingDetails,
            agreements: {
              termsOfServiceAcceptedAt: acceptedAt,
              rentalTermsAcceptedAt: acceptedAt,
              forfeitureAcceptedAt: acceptedAt,
            },
          },
        },
        attempt.key
      );

      bookingAttempt.finish();
      router.replace(`/customer/booking/${data.id}` as unknown as Href);
    } catch (err) {
      logger.error("Booking submission failed:", err);
      setSubmitError(err);
    }
  };

  const handleSubmit = () => bookingAttempt.run(submitBooking);

  const carName = car?.name || [car?.vehicleMake, car?.vehicleModel].filter(Boolean).join(" ");

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 8, paddingBottom: FLOATING_BAR_CLEARANCE + insets.bottom + 12 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
          <View style={styles.flex}>
            <AppText variant="caption">Step 2 of 2</AppText>
            <AppText variant="largeTitle" accessibilityRole="header">
              Review
            </AppText>
          </View>
        </View>

        {carName ? <AppText variant="headline">{carName}</AppText> : null}
        <TripCard fromDate={params.from} fromTime={params.ft} toDate={params.to} toTime={params.tt} />

        <GlassCard>
          {quoteLoading ? (
            <SkeletonText lines={4} />
          ) : quoteError ? (
            <ErrorState error={quoteError} onRetry={loadQuote} compact />
          ) : quote ? (
            <View style={styles.gap10}>
              <Row icon="navigate-outline" label="Pick-up" value={quote.pickupPoint?.label} sub={quote.pickupPoint?.address} />
              <Row icon="flag-outline" label="Drop-off" value={quote.dropoffPoint?.label} sub={quote.dropoffPoint?.address} />
            </View>
          ) : null}
        </GlassCard>

        {quote ? (
          <GlassCard>
            <QuoteBreakdown quote={quote} />
          </GlassCard>
        ) : null}

        {quote ? (
          <GlassCard>
            <AppText variant="headline" style={styles.cardTitle}>
              How you'll pay
            </AppText>
            <PaymentSchedule steps={paymentStepsFromQuote(quote, car)} />
          </GlassCard>
        ) : null}

        <Card title="Contact">
          <Row icon="person-outline" label="Name" value={params.fullName} />
          <Row icon="call-outline" label="Phone" value={params.phone} />
          {params.email ? <Row icon="mail-outline" label="Email" value={params.email} /> : null}
        </Card>

        <Card title="Driver">
          <Row icon="id-card-outline" label="Driver" value={driverIsBooker ? `${finalDriverName} (you)` : finalDriverName} />
          {params.dateOfBirth ? (
            <Row icon="calendar-outline" label="Date of birth" value={formatMYT(mytToIso(params.dateOfBirth, "12:00"), "date")} />
          ) : null}
          <Row icon="globe-outline" label="Licence issued in" value={params.licenceIssuedIn || "Malaysia"} />
          {cdwSelected ? <Row icon="shield-checkmark-outline" label="Collision damage waiver" value="Included" /> : null}
        </Card>

        <View style={[styles.notice, { backgroundColor: tokens.infoBg }]}>
          <Ionicons name="information-circle-outline" size={20} color={tokens.infoFg} />
          <AppText variant="caption" style={[styles.flex, { color: tokens.infoFg }]}>
            This sends a request to the operator. You pay nothing until they accept.
          </AppText>
        </View>

        {submitError ? <ErrorState error={submitError} compact /> : null}
      </ScrollView>

      <FloatingActionBar
        action={
          <Button
            label="Send request"
            variant="cta"
            grow
            disabled={!quote || quoteLoading}
            onPress={handleSubmit}
          />
        }
      >
        {quote ? (
          <>
            <Money sen={quote.totalSen} variant="headline" />
            <AppText variant="caption">RM 0 today</AppText>
          </>
        ) : (
          <AppText variant="caption">Confirming the price…</AppText>
        )}
      </FloatingActionBar>
    </View>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <GlassCard>
      <AppText variant="headline" style={styles.cardTitle}>
        {title}
      </AppText>
      <View style={styles.gap10}>{children}</View>
    </GlassCard>
  );
}

function Row({ icon, label, value, sub }: { icon: any; label: string; value?: string | null; sub?: string | null }) {
  const { tokens } = useTheme();
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={tokens.leafInk} style={styles.rowIcon} />
      <View style={styles.flex}>
        <AppText variant="caption">{label}</AppText>
        <AppText variant="bodyStrong">{value || "—"}</AppText>
        {sub ? <AppText variant="caption">{sub}</AppText> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    gap: 16,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  gap10: {
    gap: 10,
  },
  cardTitle: {
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  rowIcon: {
    marginTop: 2,
  },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 16,
  },
});
