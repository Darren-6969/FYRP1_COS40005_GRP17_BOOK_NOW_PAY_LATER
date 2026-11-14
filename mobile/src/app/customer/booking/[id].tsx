import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CancelSheet } from "@/components/booking/CancelSheet";
import { offerSummary } from "@/components/booking/BookingCard";
import { OfferSheet } from "@/components/booking/OfferSheet";
import { ReceiptViewer, isViewableReceipt } from "@/components/booking/ReceiptViewer";
import {
  AppText,
  Button,
  ErrorState,
  FLOATING_BAR_CLEARANCE,
  FloatingActionBar,
  Figure,
  GlassCard,
  HeroCard,
  IconButton,
  Money,
  PaymentSchedule,
  SkeletonText,
  StatusPill,
  useToast,
  type ScheduleStep,
} from "@/components/ui";
import { bookingStatus } from "@/constants/status";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  acceptAlternative,
  cancelCustomerBooking,
  getCustomerBookingById,
  rejectAlternative,
  type CustomerCancellationReason,
} from "@/services/customerApi";
import {
  bookingRef,
  bookingTitle,
  isActiveBooking,
  owedPart,
  paidInFull,
  partName,
  receiptInReview,
  timeLeft,
} from "@/utils/booking-view";
import { formatMYT } from "@/utils/datetime";
import { logger } from "@/utils/logger";

type IconName = ComponentProps<typeof Ionicons>["name"];

/** Statuses a customer can still cancel from, before pick-up time. */
const CANCELLABLE = new Set([
  "PENDING",
  "ALTERNATIVE_SUGGESTED",
  "ACCEPTED",
  "PENDING_PAYMENT",
  "CONFIRMED",
  "PAID",
  "READY_FOR_PICKUP",
]);

function canCancel(booking: any) {
  if (!CANCELLABLE.has(booking?.status)) return false;
  if (booking?.pickupDate && new Date(booking.pickupDate).getTime() <= Date.now()) return false;
  return true;
}

function scheduleTitle(entry: any) {
  if (entry.type === "LICENCE") return "Driving licence";
  if (entry.paymentPart === "DOWN_PAYMENT") return "Down payment";
  if (entry.paymentPart === "FINAL_PAYMENT") return "Balance";
  if (entry.paymentPart === "FULL_PAYMENT") return "Payment in full";
  return "Payment";
}

/**
 * The steps after acceptance, from the server's schedule entries. Older
 * bookings without entries fall back to the two payment parts.
 */
function scheduleSteps(booking: any): ScheduleStep[] {
  const entries = (booking?.paymentSchedule ?? [])
    .filter((e: any) => e.status !== "VOID")
    .sort((a: any, b: any) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

  let nowSet = false;
  const stateOf = (paid: boolean, due: boolean) => {
    if (paid) return "done" as const;
    if (due && !nowSet) {
      nowSet = true;
      return "now" as const;
    }
    return "upcoming" as const;
  };

  if (entries.length > 0) {
    return entries.map((entry: any) => {
      const paid = entry.status === "PAID";
      const caption = paid
        ? entry.paidAt
          ? `Done ${formatMYT(entry.paidAt, "dayDate")}`
          : "Done"
        : entry.status === "EXPIRED"
          ? `Missed · was due ${formatMYT(entry.dueAt, "dayDateTime")}`
          : `Due ${formatMYT(entry.dueAt, "dayDateTime")}`;
      return {
        key: String(entry.id),
        title: scheduleTitle(entry),
        caption,
        amount: entry.type === "LICENCE" ? undefined : entry.amount,
        state: stateOf(paid, entry.status === "DUE"),
      };
    });
  }

  const p = booking?.payment;
  if (!p) return [];
  const steps: ScheduleStep[] = [];
  const part = (key: string, title: string, amount: any, status: string, dueAt: string | null) => {
    if (!amount && status !== "PAID") return;
    const paid = status === "PAID";
    steps.push({
      key,
      title,
      caption: paid ? "Paid" : dueAt ? `Due ${formatMYT(dueAt, "dayDateTime")}` : undefined,
      amount,
      state: stateOf(paid, true),
    });
  };
  part("down", "Down payment", p.downPaymentAmount, p.downPaymentStatus, p.downPaymentDueDate ?? null);
  part("final", "Balance", p.finalPaymentAmount, p.finalPaymentStatus, p.finalPaymentDueDate ?? null);
  return steps;
}

/** One line on what happens next, for bookings with nothing to pay. */
function nextStepText(booking: any) {
  const status = booking?.status;
  const pickup = booking?.pickupDate ? formatMYT(booking.pickupDate, "dayDateTime") : null;
  switch (status) {
    case "IN_PROGRESS":
      return booking?.returnDate ? `Return the car by ${formatMYT(booking.returnDate, "dayDateTime")}.` : "Enjoy your trip.";
    case "OVERDUE":
      return "The balance wasn't paid by its deadline. Contact the operator about this booking.";
    case "COMPLETED":
      return "This trip is complete. Thanks for renting with us.";
    case "CANCELLED":
      return booking?.cancelledAt ? `Cancelled ${formatMYT(booking.cancelledAt, "dayDateTime")}.` : "This booking was cancelled.";
    case "REJECTED":
      return "The operator couldn't take this booking. Nothing was charged.";
    case "EXPIRED":
      return "This request expired without a reply. Nothing was charged.";
    case "NO_SHOW":
    case "NO_SHOW_UNPAID":
      return "The car wasn't collected at pick-up time.";
    default:
      if (receiptInReview(booking)) return "Your receipt is with the operator for review.";
      if (paidInFull(booking)) return pickup ? `Paid in full. Pick up ${pickup}.` : "Paid in full.";
      return pickup ? `Pick up ${pickup}.` : "";
  }
}

/**
 * Customer booking detail (plan phase 3, booking and payment mock). When
 * something is owed, the time left to pay is the largest thing on screen.
 * Amounts are the server's per-part figures (F16); the app no longer works
 * out "total minus paid".
 */
export default function BookingDetailScreen() {
  const router = useRouter();
  const toast = useToast();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; payment?: string; offer?: string }>();
  const bookingId = params.id;

  const [booking, setBooking] = useState<any | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [refreshing, setRefreshing] = useState(false);
  // F2: Stripe's cancel link lands here with ?payment=cancelled.
  const [paymentCancelled, setPaymentCancelled] = useState(params.payment === "cancelled");
  const [offerOpen, setOfferOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const offerParamUsed = useRef(false);

  // Re-render each minute so the countdown stays current.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const load = useCallback(
    async (refresh = false) => {
      if (!bookingId) return;
      if (refresh) setRefreshing(true);
      setError(null);
      try {
        const data = await getCustomerBookingById(bookingId);
        setBooking(data);
        setNow(Date.now());
        // "Review offer" on the Bookings list opens the sheet straight away.
        if (params.offer === "1" && !offerParamUsed.current && data?.status === "ALTERNATIVE_SUGGESTED") {
          offerParamUsed.current = true;
          setOfferOpen(true);
        }
      } catch (err) {
        logger.debug("Failed to load booking:", err);
        setError(err);
      } finally {
        setRefreshing(false);
      }
    },
    [bookingId, params.offer]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // ---- Error and loading --------------------------------------------------
  if (error && !booking) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
        <View style={styles.pad}>
          <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
        </View>
        <ErrorState error={error} onRetry={() => load()} />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={[styles.screen, styles.pad, { paddingTop: insets.top + 8, gap: 16 }]}>
        <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
        <GlassCard>
          <SkeletonText lines={3} />
        </GlassCard>
        <GlassCard>
          <SkeletonText lines={5} />
        </GlassCard>
      </View>
    );
  }

  // ---- What the booking means now -----------------------------------------
  const owed = owedPart(booking);
  const left = owed ? timeLeft(owed.dueAt, now) : null;
  const operatorName = booking.operator?.companyName || "The operator";
  const offer = booking.status === "ALTERNATIVE_SUGGESTED";
  const steps = scheduleSteps(booking);
  const car = booking.car;
  const listing = car?.listing;
  const place = car?.pickupPoint?.label || car?.requestedLocation || booking.location || listing?.branch?.name || null;
  const specs = [listing?.transmission, listing?.seats ? `${listing.seats} seats` : null].filter(Boolean).join(" · ");
  // https links and older base64 data URLs both open in the in-app viewer.
  const receiptUrl: string | null = isViewableReceipt(booking.receipt?.imageUrl) ? booking.receipt.imageUrl : null;

  const pay = () =>
    router.push({
      pathname: "/customer/checkout",
      params: { bookingId: String(booking.id), ...(owed ? { type: owed.part } : {}) },
    } as unknown as Href);

  const acceptOffer = async () => {
    await acceptAlternative(booking.id);
    setOfferOpen(false);
    toast.show("Offer accepted. Your payment schedule is ready.", { tone: "ok" });
    await load();
  };

  const declineOffer = async () => {
    await rejectAlternative(booking.id);
    setOfferOpen(false);
    toast.show("Offer declined. The booking is closed.", { tone: "info" });
    await load();
  };

  const cancel = async (reason: CustomerCancellationReason | null) => {
    await cancelCustomerBooking(booking.id, reason ?? undefined);
    setCancelOpen(false);
    toast.show("Booking cancelled.", { tone: "info" });
    await load();
  };

  const openUrl = (url: string) => Linking.openURL(url).catch((err) => logger.debug("Failed to open link:", err));

  // ---- Hero ---------------------------------------------------------------
  let hero;
  if (owed) {
    const due = owed.dueAt ? formatMYT(owed.dueAt, "dayDateTime") : null;
    hero = (
      <HeroCard tag={left ? "Time left to pay" : "Payment due"}>
        <Figure size="xl" style={{ color: tokens.onHero }} accessibilityLabel={left ? `${left} left` : "Due now"}>
          {left ?? "Due now"}
        </Figure>
        <AppText variant="caption" style={{ color: tokens.onHeroSoft }}>
          {partName(owed.part)}
          {due ? ` due ${due}` : " due"}. {operatorName} accepted your request.
        </AppText>
      </HeroCard>
    );
  } else if (booking.status === "PENDING") {
    const replyBy = car?.responseDueAt ? formatMYT(car.responseDueAt, "dayDateTime") : null;
    hero = (
      <HeroCard tag="Waiting for operator">
        <AppText variant="title" style={{ color: tokens.onHero }}>
          Request sent
        </AppText>
        <AppText variant="caption" style={{ color: tokens.onHeroSoft }}>
          {replyBy ? `${operatorName} replies by ${replyBy}.` : `${operatorName} will reply soon.`}
          {replyBy && car?.autoRejectOnTimeout ? " If there's no reply by then, the request closes and nothing is charged." : ""}
          {" "}You don't pay anything until it's accepted.
        </AppText>
      </HeroCard>
    );
  } else if (offer) {
    hero = (
      <HeroCard tag="Your answer needed">
        <AppText variant="title" style={{ color: tokens.onHero }}>
          {offerSummary(booking)}
        </AppText>
        <AppText variant="caption" style={{ color: tokens.onHeroSoft }}>
          Review the offer to see what changes before you decide.
        </AppText>
      </HeroCard>
    );
  } else {
    hero = (
      <HeroCard tag={bookingStatus(booking.status).label}>
        <AppText variant="title" style={{ color: tokens.onHero }}>
          {bookingTitle(booking)}
        </AppText>
        {nextStepText(booking) ? (
          <AppText variant="caption" style={{ color: tokens.onHeroSoft }}>
            {nextStepText(booking)}
          </AppText>
        ) : null}
      </HeroCard>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 8, paddingBottom: (owed ? FLOATING_BAR_CLEARANCE : 24) + insets.bottom + 12 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={tokens.label} colors={[tokens.brand]} />
        }
      >
        <View style={styles.topRow}>
          <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
          <View style={styles.flex}>
            <AppText variant="mono" color="label">
              {bookingRef(booking)}
            </AppText>
          </View>
          <StatusPill status={booking.status} />
        </View>

        {paymentCancelled ? (
          <View style={[styles.banner, { backgroundColor: tokens.noticeBg }]} accessibilityRole="alert">
            <Ionicons name="information-circle-outline" size={20} color={tokens.noticeFg} />
            <AppText variant="caption" style={[styles.flex, { color: tokens.noticeFg }]}>
              Payment cancelled. You haven't been charged, and you can pay again from this booking.
            </AppText>
            <Pressable onPress={() => setPaymentCancelled(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Dismiss">
              <Ionicons name="close" size={18} color={tokens.noticeFg} />
            </Pressable>
          </View>
        ) : null}

        {hero}

        {offer ? (
          <View style={styles.buttonRow}>
            <Button label="Review offer" variant="brand" grow onPress={() => setOfferOpen(true)} />
          </View>
        ) : null}

        {steps.length > 0 ? (
          <Section title="Payment schedule">
            <GlassCard>
              <PaymentSchedule steps={steps} />
              {receiptInReview(booking) ? (
                <AppText variant="caption" style={styles.mt8}>
                  Your receipt is with the operator for review.
                </AppText>
              ) : null}
            </GlassCard>
          </Section>
        ) : null}

        <Section title="Your trip">
          <GlassCard>
            <View style={styles.carRow}>
              <View style={[styles.thumb, { backgroundColor: tokens.glassStrong, borderColor: tokens.glassLine }]}>
                {listing?.imageUrl ? (
                  <Image source={{ uri: listing.imageUrl }} style={styles.fill} contentFit="cover" transition={150} />
                ) : (
                  <Ionicons name="car-sport-outline" size={26} color={tokens.label} />
                )}
              </View>
              <View style={styles.flex}>
                <AppText variant="headline">{bookingTitle(booking)}</AppText>
                {specs ? <AppText variant="caption">{specs}</AppText> : null}
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: tokens.line }]} />
            <InfoRow icon="calendar-outline" label="Pick-up" value={formatMYT(booking.pickupDate, "dayDateTime")} />
            <InfoRow icon="flag-outline" label="Return" value={formatMYT(booking.returnDate, "dayDateTime")} />
            {place ? <InfoRow icon="location-outline" label="Place" value={place} /> : null}
          </GlassCard>
        </Section>

        <Section title="Cost">
          <GlassCard>
            <View style={styles.costRow}>
              <AppText style={styles.flex}>Total</AppText>
              <Money value={booking.totalAmount} variant="headline" />
            </View>
            {booking.payment ? (
              <View style={[styles.costRow, styles.costDivider, { borderTopColor: tokens.line }]}>
                <AppText style={styles.flex}>Paid so far</AppText>
                <Money value={booking.payment.paidAmount} />
              </View>
            ) : null}
            {!booking.payment && isActiveBooking(booking) ? (
              <AppText variant="caption" style={styles.mt8}>
                Nothing to pay yet. The payment schedule appears once the operator accepts.
              </AppText>
            ) : null}
          </GlassCard>
        </Section>

        {booking.invoice || booking.receipt ? (
          <Section title="Documents">
            <GlassCard padding={4}>
              {booking.invoice ? (
                <LinkRow
                  icon="document-text-outline"
                  title="Invoice"
                  subtitle={booking.invoice.invoiceNo || "Ready to view"}
                  onPress={() =>
                    router.push({ pathname: "/customer/invoice/[id]", params: { id: String(booking.id) } } as unknown as Href)
                  }
                />
              ) : null}
              {booking.receipt ? (
                <LinkRow
                  icon="receipt-outline"
                  title="Payment receipt"
                  subtitle="Uploaded"
                  onPress={receiptUrl ? () => setReceiptOpen(true) : undefined}
                  divider={Boolean(booking.invoice)}
                />
              ) : null}
            </GlassCard>
          </Section>
        ) : null}

        {booking.operator ? (
          <Section title="Operator">
            <GlassCard padding={4}>
              <View style={styles.operatorName}>
                <AppText variant="headline">{operatorName}</AppText>
              </View>
              {booking.operator.phone ? (
                <LinkRow
                  icon="call-outline"
                  title="Call"
                  subtitle={booking.operator.phone}
                  onPress={() => openUrl(`tel:${String(booking.operator.phone).replace(/\s+/g, "")}`)}
                  divider
                />
              ) : null}
              {booking.operator.email ? (
                <LinkRow
                  icon="mail-outline"
                  title="Email"
                  subtitle={booking.operator.email}
                  onPress={() => openUrl(`mailto:${booking.operator.email}`)}
                  divider
                />
              ) : null}
            </GlassCard>
          </Section>
        ) : null}

        {canCancel(booking) ? (
          <Button label="Cancel booking" variant="text" icon="close-circle-outline" onPress={() => setCancelOpen(true)} />
        ) : null}
      </ScrollView>

      {owed ? (
        <FloatingActionBar action={<Button label={`Pay ${partName(owed.part).toLowerCase()}`} variant="cta" onPress={pay} />}>
          <Money value={owed.amount} variant="headline" />
          <AppText variant="caption">{owed.dueAt ? `Due ${formatMYT(owed.dueAt, "dayDateTime")}` : partName(owed.part)}</AppText>
        </FloatingActionBar>
      ) : null}

      <OfferSheet
        booking={booking}
        visible={offerOpen}
        onClose={() => setOfferOpen(false)}
        onAccept={acceptOffer}
        onDecline={declineOffer}
        onReload={() => load()}
      />

      <ReceiptViewer uri={receiptUrl} visible={receiptOpen} onClose={() => setReceiptOpen(false)} />

      <CancelSheet
        bookingId={booking.id}
        bookingRef={bookingRef(booking)}
        visible={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={cancel}
      />
    </View>
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

function InfoRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const { tokens } = useTheme();
  return (
    <View style={styles.infoRow} accessible accessibilityLabel={`${label}: ${value}`}>
      <Ionicons name={icon} size={18} color={tokens.label} />
      <AppText variant="caption" style={styles.infoLabel}>
        {label}
      </AppText>
      <AppText variant="label" color="ink" style={styles.flex} align="right">
        {value}
      </AppText>
    </View>
  );
}

function LinkRow({
  icon,
  title,
  subtitle,
  onPress,
  divider = false,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  divider?: boolean;
}) {
  const { tokens } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={[title, subtitle].filter(Boolean).join(", ")}
      style={({ pressed }) => [
        styles.linkRow,
        divider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.line },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.linkIcon, { backgroundColor: tokens.infoBg }]}>
        <Ionicons name={icon} size={18} color={tokens.infoFg} />
      </View>
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{title}</AppText>
        {subtitle ? <AppText variant="caption">{subtitle}</AppText> : null}
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={18} color={tokens.label} /> : null}
    </Pressable>
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
  flex: {
    flex: 1,
  },
  fill: {
    width: "100%",
    height: "100%",
  },
  mt8: {
    marginTop: 8,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: Radius.sm,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
  section: {
    gap: 10,
  },
  carRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  thumb: {
    width: 76,
    height: 56,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 5,
  },
  infoLabel: {
    width: 64,
  },
  costRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  costDivider: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  operatorName: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  linkIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.7,
  },
});
