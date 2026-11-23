import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppText,
  Button,
  Chip,
  ErrorState,
  FieldError,
  FLOATING_BAR_CLEARANCE,
  FloatingActionBar,
  GlassCard,
  IconButton,
  Money,
  SkeletonText,
  TextField,
} from "@/components/ui";
import { useIdempotentAttempt } from "@/hooks/use-idempotent-attempt";
import { useTheme } from "@/hooks/use-theme";
import { getStoredUser } from "@/services/session";
import { createTourBooking, durationText, getTour, quoteTour, type Tour, type TourQuote } from "@/services/tourApi";
import { formatMYT, mytToIso } from "@/utils/datetime";
import { logger } from "@/utils/logger";
import { formatSen } from "@/utils/money";
import { normaliseMalaysianPhone } from "@/utils/phone";
import { startAsync } from "@/utils/start-async";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ARRANGED = "";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function plainDate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Tour booking request (operator types plan, Phase 3): date, pickup time,
 * passengers up to the tour's limit, pickup point, contact and the three
 * agreements, with the server's price for the selection. One screen: a tour
 * has no driver, licence, CDW or drop-off. Nothing is charged until the
 * operator accepts.
 */
export default function TourBookingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { scheme, tokens } = useTheme();
  const params = useLocalSearchParams<{ id?: string }>();

  const [tour, setTour] = useState<Tour | null>(null);
  const [tourError, setTourError] = useState<unknown>(null);

  const [date, setDate] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const [pickupTime, setPickupTime] = useState("");
  const [timeOpen, setTimeOpen] = useState(false);
  const [passengers, setPassengers] = useState(2);
  const [pointId, setPointId] = useState<string>(ARRANGED);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [tourTermsAccepted, setTourTermsAccepted] = useState(false);
  const [forfeitureAccepted, setForfeitureAccepted] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const [quote, setQuote] = useState<{ key: string; data: TourQuote | null; error: unknown }>({ key: "", data: null, error: null });
  const attempt = useIdempotentAttempt();
  const [submitError, setSubmitError] = useState<unknown>(null);

  const loadTour = useCallback(
    () =>
      startAsync(async () => {
        if (!params.id) return;
        try {
          const data = await getTour(params.id);
          setTour(data);
          setPickupTime((current) => current || data.pickupTimes[0] || "");
          setPassengers((current) => (data.maxPassengers ? Math.min(current, data.maxPassengers) : current));
        } catch (err) {
          setTourError(err);
        }
      }),
    [params.id]
  );

  useEffect(() => {
    loadTour();
    getStoredUser()
      .then((user) => {
        if (!user) return;
        setFullName((v) => v || user.name || "");
        setEmail((v) => v || user.email || "");
        setPhone((v) => v || user.phone || "");
      })
      .catch(() => {});
  }, [loadTour]);

  // The server prices every selection; the screen shows its answer as-is.
  const ready = Boolean(tour && date && pickupTime);
  const quoteKey = JSON.stringify([params.id, date, pickupTime, passengers, pointId]);
  const loadQuote = useCallback(
    () =>
      startAsync(async () => {
        if (!params.id || !date || !pickupTime) return;
        try {
          const data = await quoteTour(params.id, { date, pickupTime, passengers, pickupPointId: pointId || null });
          setQuote({ key: quoteKey, data, error: null });
        } catch (err) {
          logger.debug("Tour quote failed:", err);
          setQuote({ key: quoteKey, data: null, error: err });
        }
      }),
    [params.id, date, pickupTime, passengers, pointId, quoteKey]
  );

  useEffect(() => {
    loadQuote();
  }, [loadQuote]);

  const quoteLoading = ready && quote.key !== quoteKey;
  const priced = !quoteLoading && quote.key === quoteKey ? quote.data : null;
  const problem = priced?.problems?.[0]?.message ?? null;

  const shownTourError = tourError ?? (params.id ? null : new Error("This booking link is missing the tour."));
  if (shownTourError) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 8, paddingHorizontal: 18 }]}>
        <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
        <ErrorState
          error={shownTourError}
          onRetry={() => {
            setTourError(null);
            return loadTour();
          }}
        />
      </View>
    );
  }

  const maxPassengers = tour?.maxPassengers ?? 20;
  const unavailable = new Set(tour?.availability?.unavailableDates ?? []);
  const normalisedPhone = normaliseMalaysianPhone(phone);
  const errors = {
    date: !date ? "Choose a date." : unavailable.has(date) ? "This tour is fully booked on that date." : null,
    time: !pickupTime ? "Choose a pickup time." : null,
    fullName: fullName.trim().length < 2 ? "Enter your full name." : null,
    email: email.trim() && !EMAIL.test(email.trim()) ? "Enter a valid email, or leave it empty." : null,
    phone: !phone.trim()
      ? "Enter a phone number the operator can call."
      : !normalisedPhone
        ? "Enter a Malaysian number, e.g. 012-345 6789."
        : null,
    agreements: !termsAccepted || !tourTermsAccepted || !forfeitureAccepted ? "Accept all three to send a request." : null,
  };
  const valid = Object.values(errors).every((e) => !e) && Boolean(priced) && !problem;
  const shown = (message: string | null) => (showErrors ? message : null);

  const onDate = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") setDateOpen(false);
    if (event.type === "dismissed" || !selected) return;
    setDate(plainDate(selected));
  };

  const onTime = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") setTimeOpen(false);
    if (event.type === "dismissed" || !selected) return;
    setPickupTime(`${pad2(selected.getHours())}:${pad2(selected.getMinutes())}`);
  };

  const submit = async () => {
    setSubmitError(null);
    if (!valid || !tour) {
      setShowErrors(true);
      return;
    }
    try {
      const request = {
        listingId: tour.id,
        date,
        pickupTime,
        passengers,
        pickupPointId: pointId || null,
        bookingDetails: {
          contact: { fullName: fullName.trim(), email: email.trim() || null, phone: normalisedPhone || "" },
          note: note.trim() || null,
        },
      };
      const current = attempt.attemptFor(JSON.stringify(request));
      const acceptedAt = current.startedAt;
      const data = await createTourBooking(
        {
          ...request,
          bookingDetails: {
            ...request.bookingDetails,
            agreements: {
              termsOfServiceAcceptedAt: acceptedAt,
              tourTermsAcceptedAt: acceptedAt,
              forfeitureAcceptedAt: acceptedAt,
            },
          },
        },
        current.key
      );
      attempt.finish();
      router.replace(`/customer/booking/${data.id}` as unknown as Href);
    } catch (err) {
      logger.error("Tour booking failed:", err);
      setSubmitError(err);
    }
  };

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 8, paddingBottom: FLOATING_BAR_CLEARANCE + insets.bottom + 12 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topRow}>
            <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
            <View style={styles.flex}>
              <AppText variant="caption">Tour request</AppText>
              <AppText variant="largeTitle" accessibilityRole="header">
                Your tour
              </AppText>
            </View>
          </View>

          {!tour ? (
            <GlassCard>
              <SkeletonText lines={5} />
            </GlassCard>
          ) : (
            <>
              <View style={styles.gap4}>
                <AppText variant="headline">{tour.name}</AppText>
                <AppText variant="caption">
                  {tour.kindLabel} · {durationText(tour.durationDays)} · {tour.operator.name}
                </AppText>
              </View>

              <Section title="Date and time">
                <Pressable
                  onPress={() => setDateOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`Tour date, ${date ? formatMYT(mytToIso(date, "12:00"), "dayDate") : "not set"}`}
                >
                  <GlassCard padding={14}>
                    <View style={styles.between}>
                      <AppText variant={date ? "bodyStrong" : "body"} color={date ? "ink" : "label"}>
                        {date ? formatMYT(mytToIso(date, "12:00"), "dayDate") : "Choose a date"}
                      </AppText>
                      <Ionicons name="calendar-outline" size={18} color={tokens.leafInk} />
                    </View>
                  </GlassCard>
                </Pressable>
                {dateOpen ? (
                  <View>
                    <DateTimePicker
                      value={date ? new Date(`${date}T12:00:00`) : new Date()}
                      mode="date"
                      display={Platform.OS === "ios" ? "inline" : "default"}
                      themeVariant={scheme}
                      minimumDate={new Date()}
                      onChange={onDate}
                    />
                    {Platform.OS === "ios" ? <Button label="Done" variant="text" size="sm" onPress={() => setDateOpen(false)} /> : null}
                  </View>
                ) : null}
                <FieldError message={shown(errors.date)} />

                {tour.pickupTimes.length ? (
                  <View style={styles.chips}>
                    {tour.pickupTimes.map((time) => (
                      <Chip key={time} label={time} selected={pickupTime === time} onPress={() => setPickupTime(time)} />
                    ))}
                  </View>
                ) : (
                  <>
                    <Pressable onPress={() => setTimeOpen(true)} accessibilityRole="button" accessibilityLabel={`Pickup time, ${pickupTime || "not set"}`}>
                      <GlassCard padding={14}>
                        <View style={styles.between}>
                          <AppText variant={pickupTime ? "bodyStrong" : "body"} color={pickupTime ? "ink" : "label"}>
                            {pickupTime || "Choose a pickup time"}
                          </AppText>
                          <Ionicons name="time-outline" size={18} color={tokens.leafInk} />
                        </View>
                      </GlassCard>
                    </Pressable>
                    {timeOpen ? (
                      <View>
                        <DateTimePicker
                          value={new Date(`2000-01-01T${pickupTime || "09:00"}:00`)}
                          mode="time"
                          display={Platform.OS === "ios" ? "spinner" : "default"}
                          themeVariant={scheme}
                          onChange={onTime}
                        />
                        {Platform.OS === "ios" ? <Button label="Done" variant="text" size="sm" onPress={() => setTimeOpen(false)} /> : null}
                      </View>
                    ) : null}
                  </>
                )}
                <FieldError message={shown(errors.time)} />
              </Section>

              <Section title="Passengers">
                <GlassCard>
                  <View style={styles.between}>
                    <View style={styles.flex}>
                      <AppText variant="bodyStrong">{passengers} {passengers === 1 ? "passenger" : "passengers"}</AppText>
                      <AppText variant="caption">
                        {tour.maxPassengers ? `Up to ${tour.maxPassengers}. ` : ""}One price for the group.
                      </AppText>
                    </View>
                    <IconButton icon="remove" label="Fewer passengers" onPress={() => setPassengers((n) => Math.max(1, n - 1))} />
                    <IconButton icon="add" label="More passengers" onPress={() => setPassengers((n) => Math.min(maxPassengers, n + 1))} />
                  </View>
                </GlassCard>
              </Section>

              {tour.pickupPoints.length ? (
                <Section title="Pickup point">
                  <GlassCard padding={4}>
                    {[{ id: ARRANGED, label: tour.meetingPoint || "Arranged with the operator", address: null, feeSen: 0 }, ...tour.pickupPoints].map(
                      (point, i) => {
                        const on = point.id === pointId;
                        return (
                          <Pressable
                            key={point.id || "arranged"}
                            onPress={() => setPointId(point.id)}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: on }}
                            style={[styles.option, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.line }]}
                          >
                            <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={20} color={on ? tokens.brand : tokens.label} />
                            <View style={styles.flex}>
                              <AppText variant="bodyStrong">{point.label}</AppText>
                              {point.address ? <AppText variant="caption">{point.address}</AppText> : null}
                            </View>
                            <AppText variant="label" color={point.feeSen ? "ink" : "label"}>
                              {point.feeSen ? `+${formatSen(point.feeSen)}` : "Free"}
                            </AppText>
                          </Pressable>
                        );
                      }
                    )}
                  </GlassCard>
                </Section>
              ) : null}

              <GlassCard>
                <AppText variant="headline" style={styles.mb6}>
                  Price
                </AppText>
                {!ready ? (
                  <AppText variant="caption">Choose a date and pickup time to see the price.</AppText>
                ) : quoteLoading ? (
                  <SkeletonText lines={3} />
                ) : quote.error ? (
                  <ErrorState error={quote.error} onRetry={() => setQuote((q) => ({ ...q, key: "" }))} compact />
                ) : priced ? (
                  <>
                    <Line label={tour.priceUnit === "PER_PACKAGE" ? "Tour package" : "Charter tour (per car)"} sen={priced.quote.rentalSen} />
                    {priced.quote.pickupFeeSen ? <Line label="Pickup charge" sen={priced.quote.pickupFeeSen} /> : null}
                    <Line label={`Down payment (${priced.quote.depositPct}%)`} sen={priced.quote.depositSen} />
                    <Line label="Balance, before the tour" sen={priced.quote.balanceSen} />
                    <View style={[styles.total, { borderTopColor: tokens.line }]}>
                      <AppText variant="bodyStrong" style={styles.flex}>
                        Total
                      </AppText>
                      <Money sen={priced.quote.totalSen} variant="headline" />
                    </View>
                    {problem ? <FieldError message={problem} /> : null}
                  </>
                ) : null}
              </GlassCard>
            </>
          )}

          <Section title="Contact">
            <TextField label="Full name" value={fullName} onChangeText={setFullName} autoComplete="name" error={shown(errors.fullName)} />
            <TextField
              label="Email (optional)"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={shown(errors.email)}
            />
            <TextField
              label="Phone"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
              placeholder="012-345 6789"
              hint="The operator calls this number about your tour."
              error={shown(errors.phone)}
            />
            <TextField
              label="Note for the operator (optional)"
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={500}
              hint="Your hotel, children travelling, or anything they should know."
            />
          </Section>

          <Section title="Agreements">
            <GlassCard padding={4}>
              <Agreement checked={termsAccepted} onChange={setTermsAccepted} title="Terms of Service" body="I agree to the platform Terms of Service." />
              <Agreement checked={tourTermsAccepted} onChange={setTourTermsAccepted} title="Tour terms" body="I agree to the terms for this tour." />
              <Agreement
                checked={forfeitureAccepted}
                onChange={setForfeitureAccepted}
                title="Down payment forfeiture"
                body="I understand the down payment is kept if I cancel or miss the balance."
              />
            </GlassCard>
            <FieldError message={shown(errors.agreements)} />
          </Section>

          {submitError ? <ErrorState error={submitError} compact /> : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <FloatingActionBar action={<Button label="Send request" variant="cta" grow disabled={quoteLoading} onPress={() => attempt.run(submit)} />}>
        {priced ? (
          <>
            <Money sen={priced.quote.totalSen} variant="headline" />
            <AppText variant="caption">RM 0 today</AppText>
          </>
        ) : (
          <AppText variant="caption">Nothing is charged until the operator accepts</AppText>
        )}
      </FloatingActionBar>
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

function Line({ label, sen }: { label: string; sen: number }) {
  return (
    <View style={styles.line}>
      <AppText style={styles.flex}>{label}</AppText>
      <Money sen={sen} />
    </View>
  );
}

function Agreement({
  checked,
  onChange,
  title,
  body,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  body: string;
}) {
  const { tokens } = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={`${title}. ${body}`}
      style={styles.option}
    >
      <Ionicons name={checked ? "checkbox" : "square-outline"} size={22} color={checked ? tokens.brand : tokens.label} />
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText variant="caption">{body}</AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 18, gap: 18 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  flex: { flex: 1 },
  gap4: { gap: 4 },
  mb6: { marginBottom: 6 },
  section: { gap: 10 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, minHeight: 56 },
  line: { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
  total: { flexDirection: "row", alignItems: "center", marginTop: 8, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
});
