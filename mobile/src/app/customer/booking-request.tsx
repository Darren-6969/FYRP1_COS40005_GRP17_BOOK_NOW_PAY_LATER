import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TripCard } from "@/components/booking/TripCard";
import {
  AppText,
  Button,
  ErrorState,
  FieldError,
  FLOATING_BAR_CLEARANCE,
  FloatingActionBar,
  GlassCard,
  IconButton,
  SkeletonText,
  TextField,
} from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import { getPublicCarById } from "@/services/carApi";
import { getStoredUser } from "@/services/session";
import { formatMYT, mytToIso } from "@/utils/datetime";
import { formatSen } from "@/utils/money";
import { normaliseMalaysianPhone } from "@/utils/phone";

type Point = {
  id: string;
  label: string;
  address?: string;
  note?: string;
  pickupFeeSen?: number;
  dropoffFeeSen?: number;
};

type Params = {
  listingId?: string;
  city?: string;
  from?: string;
  ft?: string;
  to?: string;
  tt?: string;
  /** "true" when CDW was switched on in car details. */
  cdw?: string;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * Step 1 of 2: where to collect and return the car, who is booking and
 * driving, and the three agreements. Nothing is sent to the server here;
 * the review screen submits the request.
 */
export default function BookingRequest() {
  const router = useRouter();
  const params = useLocalSearchParams<Params>();
  const insets = useSafeAreaInsets();
  const { scheme, tokens } = useTheme();
  const switchColors = { trackColor: { true: tokens.brand, false: tokens.neutralBg }, thumbColor: "#FFFFFF" };

  const [car, setCar] = useState<any | null>(null);
  const [carError, setCarError] = useState<unknown>(null);

  const [pickupPointId, setPickupPointId] = useState("");
  const [dropoffPointId, setDropoffPointId] = useState("");
  const [cdwSelected, setCdwSelected] = useState(params.cdw === "true");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [driverIsBooker, setDriverIsBooker] = useState(true);
  const [driverName, setDriverName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [dobOpen, setDobOpen] = useState(false);
  const [licenceIssuedIn, setLicenceIssuedIn] = useState("Malaysia");

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [rentalTermsAccepted, setRentalTermsAccepted] = useState(false);
  const [forfeitureAccepted, setForfeitureAccepted] = useState(false);

  // Errors only show after Continue is tried, not while typing.
  const [showErrors, setShowErrors] = useState(false);

  const loadCar = useCallback(async () => {
    if (!params.listingId) return setCarError(new Error("This booking link is missing the car."));
    setCarError(null);
    try {
      const data = await getPublicCarById(params.listingId);
      setCar(data);
      setPickupPointId((current) => current || data?.booking?.pickupPoints?.[0]?.id || "");
      setDropoffPointId((current) => current || data?.booking?.dropoffPoints?.[0]?.id || "");
    } catch (err) {
      setCarError(err);
    }
  }, [params.listingId]);

  useEffect(() => {
    loadCar();
    // Start from the signed-in profile; the customer can change anything.
    getStoredUser()
      .then((user) => {
        if (!user) return;
        setFullName((v) => v || user.name || "");
        setEmail((v) => v || user.email || "");
        setPhone((v) => v || user.phone || "");
      })
      .catch(() => {});
  }, [loadCar]);

  const ageRulesOn = Boolean(car?.booking?.driverRules?.enabled);
  const cdw = car?.booking?.cdw ?? null;
  const pickupPoints: Point[] = car?.booking?.pickupPoints || [];
  const dropoffPoints: Point[] = car?.booking?.dropoffPoints || [];

  const normalisedPhone = normaliseMalaysianPhone(phone);
  const errors = {
    fullName: fullName.trim().length < 2 ? "Enter your full name." : null,
    email: email.trim() && !EMAIL.test(email.trim()) ? "Enter a valid email, or leave it empty." : null,
    phone: !phone.trim()
      ? "Enter a phone number the operator can call."
      : !normalisedPhone
        ? "Enter a Malaysian number, e.g. 012-345 6789."
        : null,
    driverName: !driverIsBooker && driverName.trim().length < 2 ? "Enter the driver's full name." : null,
    dateOfBirth: ageRulesOn && !dateOfBirth ? "This operator asks for the driver's date of birth." : null,
    licence: !licenceIssuedIn.trim() ? "Enter the country that issued the licence." : null,
    points: !pickupPointId || !dropoffPointId ? "Choose a pick-up and a drop-off point." : null,
    agreements:
      !termsAccepted || !rentalTermsAccepted || !forfeitureAccepted ? "Accept all three to send a request." : null,
  };
  const valid = Object.values(errors).every((e) => !e) && Boolean(car);
  const shown = (message: string | null) => (showErrors ? message : null);

  const handleContinue = () => {
    if (!valid) {
      setShowErrors(true);
      return;
    }
    router.push({
      pathname: "/customer/review-booking",
      params: {
        listingId: params.listingId || "",
        city: params.city || "",
        from: params.from || "",
        ft: params.ft || "10:00",
        to: params.to || "",
        tt: params.tt || "10:00",
        pickupPointId,
        dropoffPointId,
        cdw: String(Boolean(cdw && cdwSelected)),
        fullName: fullName.trim(),
        email: email.trim(),
        phone: normalisedPhone || "",
        driverIsBooker: String(driverIsBooker),
        driverName: (driverIsBooker ? fullName : driverName).trim(),
        dateOfBirth: ageRulesOn ? dateOfBirth : "",
        licenceIssuedIn: licenceIssuedIn.trim(),
        termsAccepted: String(termsAccepted),
        rentalTermsAccepted: String(rentalTermsAccepted),
        forfeitureAccepted: String(forfeitureAccepted),
      },
    } as unknown as Href);
  };

  const onDob = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") setDobOpen(false);
    if (event.type === "dismissed" || !selected) return;
    setDateOfBirth(`${selected.getFullYear()}-${pad2(selected.getMonth() + 1)}-${pad2(selected.getDate())}`);
  };

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

  const carName = car?.name || [car?.vehicleMake, car?.vehicleModel].filter(Boolean).join(" ");

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
              <AppText variant="caption">Step 1 of 2</AppText>
              <AppText variant="largeTitle" accessibilityRole="header">
                Your details
              </AppText>
            </View>
          </View>

          {carName ? <AppText variant="headline">{carName}</AppText> : null}
          <TripCard fromDate={params.from} fromTime={params.ft} toDate={params.to} toTime={params.tt} />

          {!car ? (
            <GlassCard>
              <SkeletonText lines={4} />
            </GlassCard>
          ) : (
            <>
              <Section title="Pick-up point">
                <PointList points={pickupPoints} selected={pickupPointId} onSelect={setPickupPointId} kind="pickup" />
              </Section>
              <Section title="Drop-off point">
                <PointList points={dropoffPoints} selected={dropoffPointId} onSelect={setDropoffPointId} kind="dropoff" />
                <FieldError message={shown(errors.points)} />
              </Section>

              {cdw ? (
                <GlassCard>
                  <View style={styles.between}>
                    <View style={[styles.row, styles.flex, styles.alignStart]}>
                      <Ionicons name="shield-checkmark-outline" size={21} color={tokens.leafInk} />
                      <View style={styles.flex}>
                        <AppText variant="bodyStrong">{cdw.label || "Collision damage waiver"}</AppText>
                        <AppText variant="caption">
                          {formatSen(cdw.priceSen)}
                          {cdw.unit === "per_day" ? "/day" : ""}, paid with the balance. Optional.
                        </AppText>
                      </View>
                    </View>
                    <Switch
                      value={cdwSelected}
                      onValueChange={setCdwSelected}
                      {...switchColors}
                      accessibilityLabel={cdw.label || "Collision damage waiver"}
                    />
                  </View>
                </GlassCard>
              ) : null}
            </>
          )}

          <Section title="Contact">
            <TextField
              label="Full name"
              value={fullName}
              onChangeText={setFullName}
              autoComplete="name"
              textContentType="name"
              error={shown(errors.fullName)}
            />
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
              hint="The operator calls this number about your booking."
              error={shown(errors.phone)}
            />
          </Section>

          <Section title="Driver">
            <GlassCard>
              <View style={styles.between}>
                <AppText variant="bodyStrong" style={styles.flex}>
                  I'm the driver
                </AppText>
                <Switch value={driverIsBooker} onValueChange={setDriverIsBooker} {...switchColors} accessibilityLabel="I'm the driver" />
              </View>
            </GlassCard>
            {!driverIsBooker ? (
              <TextField
                label="Driver's full name"
                value={driverName}
                onChangeText={setDriverName}
                error={shown(errors.driverName)}
              />
            ) : null}
            {ageRulesOn ? (
              <View style={styles.gap6}>
                <AppText variant="label" color="ink">
                  Driver's date of birth
                </AppText>
                <Pressable
                  onPress={() => setDobOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`Driver's date of birth, ${dateOfBirth ? formatMYT(mytToIso(dateOfBirth, "12:00"), "date") : "not set"}`}
                >
                  <GlassCard padding={14}>
                    <View style={styles.between}>
                      <AppText variant={dateOfBirth ? "bodyStrong" : "body"} color={dateOfBirth ? "ink" : "label"}>
                        {dateOfBirth ? formatMYT(mytToIso(dateOfBirth, "12:00"), "date") : "Choose date"}
                      </AppText>
                      <Ionicons name="calendar-outline" size={18} color={tokens.leafInk} />
                    </View>
                  </GlassCard>
                </Pressable>
                <FieldError message={shown(errors.dateOfBirth)} />
                {dobOpen ? (
                  <View>
                    <DateTimePicker
                      value={dateOfBirth ? new Date(`${dateOfBirth}T12:00:00`) : new Date(2000, 0, 1)}
                      mode="date"
                      display={Platform.OS === "ios" ? "spinner" : "default"}
                      themeVariant={scheme}
                      maximumDate={new Date()}
                      onChange={onDob}
                    />
                    {Platform.OS === "ios" ? (
                      <Button label="Done" variant="text" size="sm" onPress={() => setDobOpen(false)} />
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : null}
            <TextField
              label="Licence issued in"
              value={licenceIssuedIn}
              onChangeText={setLicenceIssuedIn}
              error={shown(errors.licence)}
            />
          </Section>

          <Section title="Agreements">
            <GlassCard padding={4}>
              <Agreement
                checked={termsAccepted}
                onChange={setTermsAccepted}
                title="Terms of Service"
                body="I agree to the platform Terms of Service."
              />
              <Agreement
                checked={rentalTermsAccepted}
                onChange={setRentalTermsAccepted}
                title="Rental terms"
                body="I agree to the rental terms for this booking."
              />
              <Agreement
                checked={forfeitureAccepted}
                onChange={setForfeitureAccepted}
                title="Down payment forfeiture"
                body="I understand the down payment may be kept if I cancel or miss the balance."
              />
            </GlassCard>
            <FieldError message={shown(errors.agreements)} />
          </Section>

          <AppText variant="caption">
            This sends a request. Nothing is charged until the operator accepts.
          </AppText>
        </ScrollView>
      </KeyboardAvoidingView>

      <FloatingActionBar action={<Button label="Review" variant="brand" grow icon="arrow-forward" iconPosition="end" onPress={handleContinue} />}>
        <AppText variant="bodyStrong">Step 1 of 2</AppText>
        <AppText variant="caption">Check everything next</AppText>
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

function PointList({
  points,
  selected,
  onSelect,
  kind,
}: {
  points: Point[];
  selected: string;
  onSelect: (id: string) => void;
  kind: "pickup" | "dropoff";
}) {
  const { tokens } = useTheme();

  if (!points.length) {
    return (
      <GlassCard>
        <AppText variant="caption">This car has no {kind === "pickup" ? "pick-up" : "drop-off"} points. Contact the operator.</AppText>
      </GlassCard>
    );
  }

  return (
    <GlassCard padding={4}>
      <View accessibilityRole="radiogroup">
        {points.map((point, i) => {
          const isOn = point.id === selected;
          const fee = kind === "pickup" ? point.pickupFeeSen : point.dropoffFeeSen;
          return (
            <Pressable
              key={point.id}
              onPress={() => onSelect(point.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: isOn }}
              style={[styles.option, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.line }]}
            >
              <View style={[styles.radio, { borderColor: isOn ? tokens.brand : tokens.label }]}>
                {isOn ? <View style={[styles.radioDot, { backgroundColor: tokens.brand }]} /> : null}
              </View>
              <View style={styles.flex}>
                <AppText variant="bodyStrong">{point.label}</AppText>
                {point.address ? <AppText variant="caption">{point.address}</AppText> : null}
                {point.note ? <AppText variant="caption">{point.note}</AppText> : null}
              </View>
              <AppText variant="label" color={fee ? "ink" : "label"}>
                {fee ? `+${formatSen(fee)}` : "Free"}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </GlassCard>
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
  screen: {
    flex: 1,
  },
  pad: {
    paddingHorizontal: 18,
  },
  content: {
    paddingHorizontal: 18,
    gap: 18,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  section: {
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  alignStart: {
    alignItems: "flex-start",
  },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  flex: {
    flex: 1,
  },
  gap6: {
    gap: 6,
  },
  option: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    minHeight: 52,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
