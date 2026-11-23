import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState, type ReactNode } from "react";
import { Linking, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ReturnModal from "@/components/operator/ReturnModal";
import { ResponseSheets, type BookingResponse } from "@/components/operator/ResponseSheets";
import { AppText, Button, ErrorState, GlassCard, IconButton, Money, SkeletonText, StatusPill } from "@/components/ui";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { getOperatorBookingById, type OperatorBooking } from "@/services/operatorApi";
import { formatMYT } from "@/utils/datetime";
import { logger } from "@/utils/logger";
import {
  customerName,
  mayMarkNoShow,
  operatorBookingRef,
  operatorBookingTitle,
  pickupPlace,
  replyByText,
} from "@/utils/operator-booking";
import CounterVerificationCard from "@/components/operator/CounterVerificationCard";
import {
  DetailLine,
  DriverJobLines,
  OperatorDriverCard,
  TourTripLines,
  independentDriverText,
} from "@/components/booking/DriverSections";
import { hasAcceptedDriver } from "@/services/driverApi";

/**
 * One booking for the operator (plan phase 4): what to do next first, then
 * the trip, the customer and the payments. Accept, Suggest (F6), Decline,
 * handover and no-show (F6) open the shared response sheets.
 */
export default function OperatorBookingDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  const params = useLocalSearchParams<{ id?: string }>();
  const parsed = Number(params.id);
  // Only a whole positive number reaches the API.
  const bookingId = Number.isInteger(parsed) && parsed > 0 ? parsed : null;

  const [booking, setBooking] = useState<OperatorBooking | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [respond, setRespond] = useState<BookingResponse | null>(null);
  const [showReturn, setShowReturn] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(
    async (refresh = false) => {
      if (!bookingId) {
        setError(new Error("This booking link isn't valid."));
        return;
      }
      if (refresh) setRefreshing(true);
      setError(null);
      setNow(new Date());
      try {
        const response = await getOperatorBookingById(bookingId);
        setBooking(response.booking);
      } catch (err) {
        logger.debug("Failed to load operator booking:", err);
        setError(err);
      } finally {
        setRefreshing(false);
      }
    },
    [bookingId]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const header = (
    <View style={styles.topRow}>
      <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
      <View style={styles.flex}>
        <AppText variant="title" accessibilityRole="header" numberOfLines={1}>
          {booking ? operatorBookingRef(booking) : "Booking"}
        </AppText>
        {booking ? (
          <AppText variant="caption" numberOfLines={1}>
            Requested {formatMYT(booking.createdAt, "dayDateTime")}
          </AppText>
        ) : null}
      </View>
      {booking ? <StatusPill status={booking.status} /> : null}
    </View>
  );

  if (error && !booking) {
    return (
      <View style={[styles.screen, styles.pad, { paddingTop: insets.top + 8 }]}>
        {header}
        <ErrorState error={error} onRetry={() => load()} />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={[styles.screen, styles.pad, { paddingTop: insets.top + 8, gap: 16 }]}>
        {header}
        <GlassCard>
          <SkeletonText lines={5} />
        </GlassCard>
      </View>
    );
  }

  const status = booking.status;
  const car = booking.car;
  const listing = car?.listing;
  const place = pickupPlace(booking);
  const dropoff = car?.dropoffPoint?.label || car?.requestedDropoffLocation || null;
  const p = booking.payment;
  const noShow = mayMarkNoShow(booking, now);
  // Tours and independent drivers (operator types plan, Phases 3 and 4).
  const tour = booking.tour;
  const driverJob = booking.driverJob;
  const driverInfo = car?.independentDriver;
  const driverAccepted = hasAcceptedDriver(driverInfo);
  const tripImage = tour?.listing?.imageUrl ?? driverJob?.driver?.photoUrl ?? listing?.imageUrl ?? null;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={tokens.label} colors={[tokens.brand]} />
        }
      >
        {header}

        <NextStep booking={booking} now={now} onRespond={setRespond} onReturn={() => setShowReturn(true)} />

        <CounterVerificationCard
          booking={booking}
          onUpdated={() => load(true)}
        />

        <Section title={tour ? "Tour" : driverJob ? "Driving job" : "Trip"}>
          <GlassCard>
            <View style={styles.carRow}>
              <View style={[styles.photo, { backgroundColor: tokens.glassStrong }]}>
                {tripImage ? (
                  <Image source={{ uri: tripImage }} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
                ) : (
                  <Ionicons name={tour ? "map-outline" : driverJob ? "person-outline" : "car-sport-outline"} size={24} color={tokens.label} />
                )}
              </View>
              <View style={styles.flex}>
                <AppText variant="bodyStrong">{operatorBookingTitle(booking)}</AppText>
                {listing?.branch?.name ? <AppText variant="caption">{listing.branch.name}</AppText> : null}
                {driverJob ? <AppText variant="caption">You drive the customer&apos;s rented car</AppText> : null}
              </View>
            </View>
            {tour ? (
              <TourTripLines tour={tour} />
            ) : driverJob ? (
              <DriverJobLines job={driverJob} audience="operator" />
            ) : (
              <>
                <Line label="Pick-up" value={formatMYT(booking.pickupDate, "dayDateTime")} first />
                <Line label="Return" value={formatMYT(booking.returnDate, "dayDateTime")} />
                {place ? <Line label="Pick-up place" value={place} /> : null}
                {dropoff ? <Line label="Drop-off place" value={dropoff} /> : null}
                <DetailLine label="Independent driver" value={independentDriverText(driverInfo)} />
              </>
            )}
            {booking.pickedUpAt ? <Line label="Handed over" value={formatMYT(booking.pickedUpAt, "dayDateTime")} /> : null}
            {booking.returnedAt ? <Line label="Returned" value={formatMYT(booking.returnedAt, "dayDateTime")} /> : null}
          </GlassCard>
        </Section>

        {driverInfo && (driverInfo.current || driverInfo.requested) ? (
          <Section title="Independent driver">
            <OperatorDriverCard booking={booking} onChanged={() => load(true)} />
          </Section>
        ) : null}

        <Section title="Customer">
          <GlassCard>
            <AppText variant="bodyStrong">{customerName(booking)}</AppText>
            {booking.customer?.email ? (
              <AppText variant="caption" selectable>
                {booking.customer.email}
              </AppText>
            ) : null}
            {/* Only car rentals need the customer's licence, and not once an
                independent driver has accepted: their licence is checked instead. */}
            {car && !driverAccepted ? (
              <View style={[styles.lineRow, styles.firstLine, { borderTopColor: tokens.line }]}>
                <AppText variant="caption" style={styles.flex}>
                  Driving licence
                </AppText>
                <StatusPill kind="licence" status={booking.customer?.licenceStatus} />
              </View>
            ) : null}
            {(tour || driverJob)?.contact?.phone ? (
              <Line label="Phone" value={(tour || driverJob).contact.phone} first />
            ) : null}
            {car?.driver?.name ? <Line label="Driver" value={car.driver.name} /> : null}
            {car?.driver?.phone ? (
              <View style={[styles.lineRow, { borderTopColor: tokens.line }]}>
                <AppText variant="caption" style={styles.flex}>
                  Phone
                </AppText>
                <Button
                  label={car.driver.phone}
                  variant="text"
                  size="sm"
                  icon="call-outline"
                  onPress={() => Linking.openURL(`tel:${car.driver!.phone}`).catch(() => {})}
                />
              </View>
            ) : null}
          </GlassCard>
        </Section>

        <Section title="Payment">
          <GlassCard>
            <View style={styles.lineRow}>
              <AppText variant="caption" style={styles.flex}>
                Booking total
              </AppText>
              <Money value={booking.totalAmount} variant="headline" />
            </View>
            {p ? (
              <>
                <PartLine label="Down payment" amount={p.downPaymentAmount} status={p.downPaymentStatus} />
                <PartLine label="Balance" amount={p.finalPaymentAmount} status={p.finalPaymentStatus} />
                <View style={[styles.lineRow, { borderTopColor: tokens.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
                  <AppText variant="caption" style={styles.flex}>
                    Payment status
                  </AppText>
                  <StatusPill kind="payment" status={p.status} />
                </View>
              </>
            ) : (
              <AppText variant="caption" style={styles.mt8}>
                Payments are set up when you accept the request.
              </AppText>
            )}
            {Number(booking.lateReturnCharge || 0) > 0 ? (
              <View style={[styles.lineRow, { borderTopColor: tokens.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <AppText variant="caption" style={styles.flex}>
                  Late return charge{booking.lateReturnPaidAt ? " (paid at counter)" : " (not paid yet)"}
                </AppText>
                <Money value={booking.lateReturnCharge} />
              </View>
            ) : null}
          </GlassCard>
        </Section>

        {status === "ALTERNATIVE_SUGGESTED" ? (
          <Section title="Your offer">
            <GlassCard>
              <AppText variant="body">
                You suggested {booking.alternativeServiceName || "another car"}
                {booking.alternativeSuggestedAt ? ` on ${formatMYT(booking.alternativeSuggestedAt, "dayDateTime")}` : ""}.
                The customer is deciding.
              </AppText>
              {booking.alternativeReason ? (
                <AppText variant="caption" style={styles.mt8}>
                  Your message: {booking.alternativeReason}
                </AppText>
              ) : null}
            </GlassCard>
          </Section>
        ) : null}

        {noShow ? (
          <Button
            label="Mark as no-show"
            variant="text"
            icon="person-remove-outline"
            style={styles.alignStart}
            onPress={() => setRespond("noshow")}
          />
        ) : null}
      </ScrollView>

      <ResponseSheets booking={booking} action={respond} onClose={() => setRespond(null)} onDone={() => load(true)} />
      {showReturn ? (
        <ReturnModal booking={booking} onClose={() => setShowReturn(false)} onDone={async () => load(true)} />
      ) : null}
    </View>
  );
}

/** What the operator should do now, with its button. */
function NextStep({
  booking,
  now,
  onRespond,
  onReturn,
}: {
  booking: OperatorBooking;
  now: Date;
  onRespond: (action: BookingResponse) => void;
  onReturn: () => void;
}) {
  const { tokens } = useTheme();
  const status = booking.status;
  // Tours and driver jobs can only be accepted or declined (no alternative).
  const kind = booking.tour ? "tour" : booking.driverJob ? "driver" : "car";
  const driverInfo = booking.car?.independentDriver;

  let title: string | null = null;
  let body: string | null = null;
  let actions: ReactNode = null;

  if (status === "PENDING") {
    title = replyByText(booking.car?.responseDueAt, now) || "Answer this request";
    body =
      kind === "tour"
        ? `${customerName(booking)} asked for this tour. Accept it, or decline with a reason.`
        : kind === "driver"
          ? `${customerName(booking)} asked you to drive their rented car. Accept the job, or decline with a reason.`
          : `${customerName(booking)} asked for this car. Accept it, suggest another car, or decline with a reason.`;
    actions = (
      <View style={styles.actions}>
        <Button label="Accept" variant="brand" size="sm" grow onPress={() => onRespond("accept")} />
        {kind === "car" ? (
          <Button label="Suggest" variant="line" size="sm" grow onPress={() => onRespond("suggest")} />
        ) : null}
        <Button label="Decline" variant="line" size="sm" grow onPress={() => onRespond("reject")} />
      </View>
    );
  } else if (status === "READY_FOR_PICKUP") {
    title = "Ready for pick-up";
    body = "Paid in full and the licence is verified. Check the driver's identity and licence at handover.";
    actions = <Button label="Record handover" variant="brand" icon="key-outline" onPress={() => onRespond("handover")} />;
  } else if (status === "IN_PROGRESS") {
    title = "On trip";
    body = booking.returnDate ? `Due back ${formatMYT(booking.returnDate, "dayDateTime")}.` : "The car is with the customer.";
    actions = <Button label="Record return" variant="brand" icon="return-down-back-outline" onPress={onReturn} />;
  } else if (status === "PAID") {
    title = "Paid, waiting on the licence";
    body = hasAcceptedDriver(driverInfo)
      ? "The booking becomes ready for pick-up once you approve the independent driver's licence below."
      : "The booking becomes ready for pick-up once the customer's driving licence is verified.";
  } else if (["ACCEPTED", "PENDING_PAYMENT", "CONFIRMED"].includes(status)) {
    title = "Waiting for the customer to pay";
    body = "You'll be notified when a payment arrives. DuitNow receipts appear in Payments for you to check.";
  } else if (status === "OVERDUE") {
    title = "Payment overdue";
    body = "The customer missed a payment deadline. Contact them, or cancel the booking from the website.";
  }

  if (!title) return null;

  return (
    <GlassCard strong>
      <View style={styles.nextHead}>
        <Ionicons name="flag-outline" size={18} color={tokens.leafInk} />
        <AppText variant="headline" style={styles.flex}>
          {title}
        </AppText>
      </View>
      {body ? (
        <AppText variant="body" style={styles.mt8}>
          {body}
        </AppText>
      ) : null}
      {actions ? <View style={styles.mt12}>{actions}</View> : null}
    </GlassCard>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="headline" accessibilityRole="header">
        {title}
      </AppText>
      {children}
    </View>
  );
}

function Line({ label, value, first = false }: { label: string; value: string; first?: boolean }) {
  const { tokens } = useTheme();
  return (
    <View style={[styles.lineRow, first && styles.firstLine, { borderTopColor: tokens.line, borderTopWidth: first ? StyleSheet.hairlineWidth : 0 }]}>
      <AppText variant="caption" style={styles.label}>
        {label}
      </AppText>
      <AppText variant="body" color="ink" style={styles.value}>
        {value}
      </AppText>
    </View>
  );
}

function PartLine({ label, amount, status }: { label: string; amount?: number; status?: string }) {
  const { tokens } = useTheme();
  return (
    <View style={[styles.lineRow, { borderTopColor: tokens.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
      <View style={styles.flex}>
        <AppText variant="caption">{label}</AppText>
        <Money value={amount} variant="bodyStrong" />
      </View>
      {status ? <StatusPill kind="payment" status={status} /> : null}
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
  mt8: {
    marginTop: 8,
  },
  mt12: {
    marginTop: 12,
  },
  alignStart: {
    alignSelf: "flex-start",
  },
  section: {
    gap: 10,
  },
  nextHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  carRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  photo: {
    width: 72,
    height: 54,
    borderRadius: Radius.sm,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  lineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  firstLine: {
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  label: {
    width: 110,
  },
  value: {
    flex: 1,
    textAlign: "right",
  },
});
