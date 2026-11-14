import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { paymentStepsFromQuote, QuoteBreakdown } from "@/components/booking/QuoteBreakdown";
import { TripCard } from "@/components/booking/TripCard";
import TripSearchModal, { type TripSearch } from "@/components/TripSearchModal";
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
  Skeleton,
  SkeletonText,
  StatusPill,
} from "@/components/ui";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { getPublicCarById, quotePublicCar } from "@/services/carApi";
import { getSavedListingIds, removeSavedListing, saveListing } from "@/services/customerApi";
import { logger } from "@/utils/logger";
import { formatSen } from "@/utils/money";

type Params = { id?: string; city?: string; from?: string; ft?: string; to?: string; tt?: string };

/** Problems that belong to later steps (the driver's age is asked on the next screen). */
const LATER_PROBLEMS = new Set(["DRIVER_DOB_REQUIRED", "DRIVER_DOB_INVALID"]);

function carTitle(car: any) {
  return car?.name || [car?.vehicleMake, car?.vehicleModel].filter(Boolean).join(" ") || "Car";
}

/**
 * One car: photo, specs, the trip, the server's exact quote, CDW and how
 * the customer will pay. The Request bar floats at the bottom (mock 2).
 * Every amount is the server's quote, shown as-is.
 */
export default function CarDetails() {
  const router = useRouter();
  const params = useLocalSearchParams<Params>();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  const listingId = params.id;

  const [car, setCar] = useState<any | null>(null);
  const [carError, setCarError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);

  const [trip, setTrip] = useState<TripSearch>({
    city: params.city || "",
    from: params.from || "",
    fromTime: params.ft || "10:00",
    to: params.to || "",
    toTime: params.tt || "10:00",
  });
  const [tripOpen, setTripOpen] = useState(false);
  const [cdw, setCdw] = useState(false);

  const [quote, setQuote] = useState<any | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<unknown>(null);
  // Only the newest quote request may update the screen; an older one
  // (e.g. before CDW was switched on) can finish later on a slow network.
  const quoteSeq = useRef(0);

  const loadCar = useCallback(async () => {
    if (!listingId) return setCarError(new Error("This car link is missing its ID."));
    setCarError(null);
    try {
      setCar(await getPublicCarById(listingId));
    } catch (err) {
      setCarError(err);
    }
  }, [listingId]);

  useEffect(() => {
    loadCar();
    getSavedListingIds()
      .then((data) => {
        const ids = Array.isArray(data?.ids) ? data.ids.map(Number) : [];
        setSaved(ids.includes(Number(listingId)));
      })
      .catch((err) => logger.debug("Failed to load saved listings:", err));
  }, [loadCar, listingId]);

  const hasDates = Boolean(trip.from && trip.to);

  const loadQuote = useCallback(async () => {
    const seq = ++quoteSeq.current;
    if (!listingId || !trip.from || !trip.to) {
      setQuote(null);
      setQuoteLoading(false);
      return;
    }
    setQuoteLoading(true);
    setQuoteError(null);
    try {
      const response = await quotePublicCar(listingId, {
        from: trip.from,
        ft: trip.fromTime || "10:00",
        to: trip.to,
        tt: trip.toTime || "10:00",
        cdw,
        addOns: {},
      });
      if (seq === quoteSeq.current) setQuote(response);
    } catch (err) {
      if (seq !== quoteSeq.current) return;
      logger.debug("Failed to load car quote:", err);
      setQuote(null);
      setQuoteError(err);
    } finally {
      if (seq === quoteSeq.current) setQuoteLoading(false);
    }
  }, [listingId, trip.from, trip.fromTime, trip.to, trip.toTime, cdw]);

  useEffect(() => {
    loadQuote();
  }, [loadQuote]);

  const toggleSaved = async () => {
    const next = !saved;
    setSaved(next);
    try {
      if (next) await saveListing(Number(listingId));
      else await removeSavedListing(Number(listingId));
    } catch (err) {
      logger.debug("Failed to update saved listing:", err);
      setSaved(!next);
    }
  };

  const q = quote?.quote;
  const availability = quote?.availability;
  const problems: { code?: string; message?: string }[] = (quote?.problems || []).filter(
    (p: any) => !LATER_PROBLEMS.has(p?.code)
  );
  const unavailable = availability && availability.available === false;
  const canRequest = hasDates && Boolean(q) && !unavailable && problems.length === 0 && !quoteLoading;

  const requestBooking = () =>
    router.push({
      pathname: "/customer/booking-request",
      params: {
        listingId: String(listingId),
        city: trip.city || "",
        from: trip.from,
        ft: trip.fromTime || "10:00",
        to: trip.to,
        tt: trip.toTime || "10:00",
        cdw: String(cdw),
      },
    } as unknown as Href);

  if (carError) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
        <View style={styles.pad}>
          <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
        </View>
        <ErrorState error={carError} onRetry={loadCar} />
      </View>
    );
  }

  const photo = car?.images?.find((i: any) => i?.isPrimary)?.imageUrl || car?.images?.[0]?.imageUrl || null;
  const name = carTitle(car);
  const place = [car?.operator?.companyName, car?.branch?.name || car?.branch?.city].filter(Boolean).join(" · ");
  const specs = [
    car?.seats ? `${car.seats} seats` : null,
    car?.transmission === "AUTOMATIC" ? "Auto" : car?.transmission === "MANUAL" ? "Manual" : null,
    car?.vehicleType,
    car?.fuelType,
  ].filter(Boolean) as string[];
  const cdwOffer = car?.booking?.cdw;
  const remaining = availability?.remaining;

  const schedule = q ? paymentStepsFromQuote(q, car) : [];

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: FLOATING_BAR_CLEARANCE + insets.bottom + 12 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.photo, { backgroundColor: tokens.glassStrong }]}>
          {photo ? (
            <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} accessible={false} />
          ) : car ? (
            <Ionicons name="car-sport-outline" size={64} color={tokens.label} />
          ) : null}
        </View>

        <View style={styles.body}>
          {car ? (
            <View style={styles.titleBlock}>
              <AppText variant="title" accessibilityRole="header">
                {name}
              </AppText>
              {place ? (
                <View style={styles.inline}>
                  <Ionicons name="location-outline" size={15} color={tokens.label} />
                  <AppText variant="caption" style={styles.flex}>
                    {place}
                  </AppText>
                </View>
              ) : null}
              {specs.length ? (
                <AppText variant="caption" color="text">
                  {specs.join("  ·  ")}
                </AppText>
              ) : null}
            </View>
          ) : (
            <SkeletonText lines={3} />
          )}

          <TripCard
            fromDate={trip.from}
            fromTime={trip.fromTime}
            toDate={trip.to}
            toTime={trip.toTime}
            onPress={() => setTripOpen(true)}
          />

          {unavailable ? (
            <StatusPill label="Not available for these dates" tone="err" />
          ) : typeof remaining === "number" && remaining > 0 && remaining <= 3 ? (
            <StatusPill label={`${remaining} left for these dates`} tone="ok" />
          ) : null}

          <GlassCard>
            {!hasDates ? (
              <View style={styles.gap8}>
                <AppText variant="headline">Price</AppText>
                <View style={styles.between}>
                  <AppText>From</AppText>
                  <View style={styles.inline}>
                    <Money sen={car?.booking?.dailyRateSen} />
                    <AppText variant="caption"> / day</AppText>
                  </View>
                </View>
                <AppText variant="caption">Add your dates to see the exact price.</AppText>
              </View>
            ) : quoteLoading && !q ? (
              <SkeletonText lines={4} />
            ) : quoteError ? (
              <ErrorState error={quoteError} onRetry={loadQuote} compact />
            ) : q ? (
              <View style={styles.gap10}>
                <QuoteBreakdown quote={q} />
                {q.pickupFeeSen > 0 || q.dropoffFeeSen > 0 ? (
                  <AppText variant="caption">You can change the pick-up and drop-off points on the next step.</AppText>
                ) : null}
              </View>
            ) : null}

            {problems.length ? (
              <View style={[styles.notice, { backgroundColor: tokens.warnBg }]} accessibilityRole="alert">
                {problems.map((p, i) => (
                  <AppText key={i} variant="caption" style={{ color: tokens.warnFg }}>
                    {p.message || "This trip can't be booked as chosen."}
                  </AppText>
                ))}
              </View>
            ) : null}
          </GlassCard>

          {cdwOffer ? (
            <GlassCard>
              <View style={styles.between}>
                <View style={[styles.inline, styles.flex, styles.alignStart]}>
                  <Ionicons name="shield-checkmark-outline" size={21} color={tokens.leafInk} />
                  <View style={styles.flex}>
                    <AppText variant="bodyStrong">{cdwOffer.label || "Collision damage waiver"}</AppText>
                    <AppText variant="caption">
                      {formatSen(cdwOffer.priceSen)}
                      {cdwOffer.unit === "per_day" ? "/day" : ""}, paid with the balance
                    </AppText>
                  </View>
                </View>
                <Switch
                  value={cdw}
                  onValueChange={setCdw}
                  trackColor={{ true: tokens.brand, false: tokens.neutralBg }}
                  thumbColor="#FFFFFF"
                  accessibilityLabel={`${cdwOffer.label || "Collision damage waiver"}, ${formatSen(cdwOffer.priceSen)} per day`}
                />
              </View>
            </GlassCard>
          ) : null}

          {schedule.length ? (
            <GlassCard>
              <AppText variant="headline" style={styles.cardTitle}>
                How you'll pay
              </AppText>
              <PaymentSchedule steps={schedule} />
            </GlassCard>
          ) : null}

          {car?.policy ? <GoodToKnow policy={car.policy} refund={q?.refundRule ?? car?.booking?.refundRule} /> : null}

          {car?.description ? (
            <GlassCard>
              <AppText variant="headline" style={styles.cardTitle}>
                About this car
              </AppText>
              <AppText>{car.description}</AppText>
            </GlassCard>
          ) : null}
        </View>
      </ScrollView>

      {/* Floating back and save over the photo (mock 2). Swipe-back still works. */}
      <View style={[styles.floatButtons, { top: insets.top + 8 }]} pointerEvents="box-none">
        <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
        <IconButton
          icon={saved ? "heart" : "heart-outline"}
          label={saved ? `Remove ${name} from saved` : `Save ${name}`}
          onPress={toggleSaved}
        />
      </View>

      <FloatingActionBar
        action={
          hasDates ? (
            <Button
              label="Request booking"
              variant="cta"
              grow
              disabled={!canRequest}
              onPress={requestBooking}
            />
          ) : (
            <Button label="Choose dates" variant="cta" grow onPress={() => setTripOpen(true)} />
          )
        }
      >
        {q ? (
          <>
            <Money sen={q.totalSen} variant="headline" />
            <AppText variant="caption">RM 0 today</AppText>
          </>
        ) : (
          <>
            <View style={styles.inline}>
              <Money sen={car?.booking?.dailyRateSen} variant="headline" />
              <AppText variant="caption"> /day</AppText>
            </View>
            <AppText variant="caption">RM 0 to request</AppText>
          </>
        )}
      </FloatingActionBar>

      {!car ? (
        <View style={[StyleSheet.absoluteFill, styles.loadingCover]} pointerEvents="none">
          <Skeleton height={300} radius={0} />
        </View>
      ) : null}

      <TripSearchModal visible={tripOpen} value={trip} onClose={() => setTripOpen(false)} onApply={setTrip} />
    </View>
  );
}

function GoodToKnow({ policy, refund }: { policy: any; refund?: { type?: string; refundPct?: number } | null }) {
  const rows = [
    policy?.mileage?.value ? { icon: "speedometer-outline" as const, label: "Mileage", value: policy.mileage.value } : null,
    policy?.fuel?.value ? { icon: "water-outline" as const, label: "Fuel", value: policy.fuel.value } : null,
    policy?.insurance?.value ? { icon: "shield-outline" as const, label: "Insurance", value: policy.insurance.value } : null,
    refund?.type
      ? {
          icon: "return-down-back-outline" as const,
          label: "If you cancel",
          value:
            refund.type === "PARTIAL" && refund.refundPct
              ? `${refund.refundPct}% of the down payment back`
              : "Down payment not refunded",
        }
      : null,
  ].filter(Boolean) as { icon: any; label: string; value: string }[];

  if (!rows.length) return null;

  return (
    <GlassCard>
      <AppText variant="headline" style={styles.cardTitle}>
        Good to know
      </AppText>
      <View style={styles.gap10}>
        {rows.map((row) => (
          <PolicyRow key={row.label} {...row} />
        ))}
      </View>
    </GlassCard>
  );
}

function PolicyRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  const { tokens } = useTheme();
  return (
    <View style={[styles.inline, styles.alignStart]}>
      <Ionicons name={icon} size={18} color={tokens.leafInk} />
      <View style={styles.flex}>
        <AppText variant="caption">{label}</AppText>
        <AppText variant="bodyStrong">{value}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  pad: {
    paddingHorizontal: 18,
  },
  photo: {
    height: 300,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  body: {
    paddingHorizontal: 18,
    paddingTop: 18,
    gap: 16,
  },
  titleBlock: {
    gap: 6,
  },
  inline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  alignStart: {
    alignItems: "flex-start",
  },
  flex: {
    flex: 1,
  },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  gap8: {
    gap: 8,
  },
  gap10: {
    gap: 10,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 2,
  },
  notice: {
    marginTop: 12,
    padding: 12,
    borderRadius: Radius.sm,
    gap: 4,
  },
  cardTitle: {
    marginBottom: 4,
  },
  floatButtons: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  loadingCover: {
    top: 0,
    bottom: undefined,
  },
});
