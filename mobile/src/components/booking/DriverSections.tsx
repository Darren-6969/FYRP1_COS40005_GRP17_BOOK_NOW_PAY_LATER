import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";

import { AppText, BottomSheet, Button, ErrorState, GlassCard, Money, SkeletonText, TextField, useToast } from "@/components/ui";
import { bookingStatus } from "@/constants/status";
import { Radius } from "@/constants/theme";
import { useIdempotentAttempt } from "@/hooks/use-idempotent-attempt";
import { useTheme } from "@/hooks/use-theme";
import {
  addBookingDriver,
  downloadDriverDocument,
  getBookingDriverOptions,
  hasAcceptedDriver,
  reviewDriverLicence,
  type CarDriverInfo,
  type DriverDocumentKind,
  type DriverOption,
  type DriverOptions,
} from "@/services/driverApi";
import { File } from "expo-file-system";
import { formatMYT } from "@/utils/datetime";
import { describeError } from "@/utils/errors";
import { formatSen } from "@/utils/money";
import { logger } from "@/utils/logger";
import { startAsync } from "@/utils/start-async";
import { useResetOnChange } from "@/hooks/use-reset-on-change";

// Tours and independent drivers on the booking detail screens (operator
// types plan, Phases 3 and 4). Everything shown comes from the booking views
// the website uses (car_booking_view.js): booking.tour, booking.driverJob and
// booking.car.independentDriver.

// ---- Small rows -----------------------------------------------------------

export function DetailLine({ label, value, first = false }: { label: string; value: string; first?: boolean }) {
  const { tokens } = useTheme();
  return (
    <View
      style={[styles.line, { borderTopColor: tokens.line, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth }]}
      accessible
      accessibilityLabel={`${label}: ${value}`}
    >
      <AppText variant="caption" style={styles.lineLabel}>
        {label}
      </AppText>
      <AppText variant="body" color="ink" style={styles.lineValue}>
        {value}
      </AppText>
    </View>
  );
}

function statusText(status: string) {
  return bookingStatus(status).label;
}

// ---- Tour and driver job: the "trip" card ---------------------------------

/** The tour part of a tour booking: date, time, passengers, pickup point. */
export function TourTripLines({ tour }: { tour: any }) {
  const point = tour?.pickupPoint;
  return (
    <>
      <DetailLine label="Starts" value={formatMYT(tour.startAt, "dayDateTime")} first />
      <DetailLine label="Pickup time" value={tour.pickupTime || "-"} />
      <DetailLine label="Duration" value={tour.durationDays === 1 ? "1 day" : `${tour.durationDays} days`} />
      <DetailLine label="Passengers" value={tour.passengers != null ? String(tour.passengers) : "-"} />
      <DetailLine
        label="Pickup point"
        value={point ? [point.label, point.address].filter(Boolean).join(", ") : "Arranged with the operator"}
      />
    </>
  );
}

/** A driver's job: when, where, and the car booking it serves. */
export function DriverJobLines({
  job,
  audience,
}: {
  job: any;
  audience: "customer" | "operator";
}) {
  const router = useRouter();
  const car = job?.car;
  return (
    <>
      {audience === "customer" && job?.driver?.languages?.length ? (
        <DetailLine label="Languages" value={job.driver.languages.join(", ")} first />
      ) : null}
      <DetailLine
        label="Starts"
        value={formatMYT(job.startAt, "dayDateTime")}
        first={!(audience === "customer" && job?.driver?.languages?.length)}
      />
      <DetailLine label="Ends" value={formatMYT(job.endAt, "dayDateTime")} />
      {job.location ? <DetailLine label="Pickup place" value={job.location} /> : null}
      {car ? <DetailLine label="Car" value={car.name} /> : null}
      {car && audience === "operator" ? (
        <DetailLine
          label="Car rented from"
          value={[car.operator?.name, car.operator?.phone].filter(Boolean).join(" · ") || "-"}
        />
      ) : null}
      {car ? (
        <DetailLine label="Car booking" value={`${car.bookingCode} · ${statusText(car.status)}`} />
      ) : null}
      {job?.pricing?.lines?.length ? (
        <DetailLine
          label="Charged as"
          value={job.pricing.lines
            .map((l: any) => `${l.count} ${l.period}${l.count === 1 ? "" : "s"} × ${formatSen(l.rateSen)}`)
            .join(" + ")}
        />
      ) : null}
      {car && audience === "customer" ? (
        <Button
          label="Open the car booking"
          variant="line"
          size="sm"
          icon="car-outline"
          style={styles.mt8}
          onPress={() => router.push({ pathname: "/customer/booking/[id]", params: { id: String(car.id) } } as unknown as Href)}
        />
      ) : null}
    </>
  );
}

// ---- Customer: the driver on a car booking --------------------------------

/**
 * The independent driver on a customer's car booking: who is booked or
 * chosen, and "Add a driver" before pickup. Shown only on cars whose
 * operator allows drivers, or where a driver is already involved.
 */
export function CustomerDriverCard({
  booking,
  now,
  onChanged,
}: {
  booking: any;
  /** The screen's clock (re-rendered each minute), for the pickup cut-off. */
  now: number;
  onChanged: () => Promise<unknown> | void;
}) {
  const router = useRouter();
  const { tokens } = useTheme();
  const info: CarDriverInfo | undefined = booking?.car?.independentDriver;
  const [open, setOpen] = useState(false);

  if (!info || (!info.allowed && !info.current && !info.requested)) return null;
  const current = info.current;
  const requested = info.requested;
  const waitingForCar = Boolean(requested && !requested.outcome && !current);
  const pickupPassed = booking?.pickupDate ? new Date(booking.pickupDate).getTime() <= now : false;
  const canAdd = info.allowed && !current && !pickupPassed && !["CANCELLED", "REJECTED", "EXPIRED", "COMPLETED"].includes(booking?.status);

  return (
    <GlassCard>
      {current ? (
        <>
          <DriverHead name={current.name} photoUrl={current.photoUrl} subtitle={`${current.bookingCode} · ${statusText(current.status)}`} />
          {current.operator?.phone ? (
            <Button
              label={`Call ${current.operator.phone}`}
              variant="text"
              size="sm"
              icon="call-outline"
              onPress={() => Linking.openURL(`tel:${String(current.operator!.phone).replace(/\s+/g, "")}`).catch(() => {})}
            />
          ) : null}
          <AppText variant="caption" style={styles.mt8}>
            {current.status === "PENDING"
              ? "Waiting for the driver to accept. Once they do, pay the driver from their booking."
              : hasAcceptedDriver(info)
                ? "Your driver drives this car. The operator checks the driver's licence, so you don't need to upload yours."
                : "This is your driver's booking for this trip."}
          </AppText>
          <Button
            label="Open the driver's booking"
            variant="line"
            size="sm"
            icon="person-outline"
            style={styles.mt8}
            onPress={() => router.push({ pathname: "/customer/booking/[id]", params: { id: String(current.id) } } as unknown as Href)}
          />
        </>
      ) : waitingForCar ? (
        <AppText variant="body">
          You chose <AppText variant="bodyStrong">{requested!.name}</AppText>. The request goes to them when the
          operator accepts your car.
        </AppText>
      ) : requested?.outcome === "UNAVAILABLE" ? (
        <View style={[styles.note, { backgroundColor: tokens.noticeBg }]}>
          <Ionicons name="information-circle-outline" size={18} color={tokens.noticeFg} />
          <AppText variant="caption" style={[styles.flex, { color: tokens.noticeFg }]}>
            {requested.name} can&apos;t take this booking{requested.reason ? `: ${requested.reason}` : "."} Choose
            another driver, or drive yourself.
          </AppText>
        </View>
      ) : (
        <AppText variant="caption">
          This car allows a licensed driver to drive it for you. The driver is paid separately, through the app,
          once they accept.
        </AppText>
      )}

      {canAdd ? (
        <Button
          label={waitingForCar ? "Choose a different driver" : "Add a driver"}
          variant="line"
          size="sm"
          icon="person-add-outline"
          style={styles.mt8}
          onPress={() => setOpen(true)}
        />
      ) : null}

      <DriverPickerSheet
        bookingId={booking.id}
        visible={open}
        onClose={() => setOpen(false)}
        onDone={async () => {
          setOpen(false);
          await onChanged();
        }}
      />
    </GlassCard>
  );
}

function DriverHead({ name, photoUrl, subtitle }: { name: string; photoUrl: string | null; subtitle?: string }) {
  const { tokens } = useTheme();
  return (
    <View style={styles.head}>
      <View style={[styles.avatar, { backgroundColor: tokens.glassStrong }]}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
        ) : (
          <Ionicons name="person-outline" size={22} color={tokens.label} />
        )}
      </View>
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{name}</AppText>
        {subtitle ? <AppText variant="caption">{subtitle}</AppText> : null}
      </View>
    </View>
  );
}

/** Lists the drivers the server offers for this car booking and books one. */
function DriverPickerSheet({
  bookingId,
  visible,
  onClose,
  onDone,
}: {
  bookingId: number;
  visible: boolean;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const toast = useToast();
  const { tokens } = useTheme();
  const [options, setOptions] = useState<DriverOptions | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [choice, setChoice] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const idem = useIdempotentAttempt();

  const load = useCallback(
    () =>
      startAsync(async () => {
        try {
          setOptions(await getBookingDriverOptions(bookingId));
        } catch (err) {
          logger.debug("Driver options failed:", err);
          setLoadError(err);
        }
      }),
    [bookingId]
  );

  // Fresh each time it opens: cleared during render, then the list is fetched.
  useResetOnChange(visible, () => {
    if (!visible) return;
    setOptions(null);
    setLoadError(null);
    setChoice(null);
    setError(null);
  });

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const retry = () => {
    setOptions(null);
    setLoadError(null);
    return load();
  };

  const confirm = async () => {
    if (choice == null) return;
    setBusy(true);
    setError(null);
    try {
      await idem.run(async () => {
        const attempt = idem.attemptFor(`${bookingId}:${choice}`);
        const result = await addBookingDriver(bookingId, choice, attempt.key);
        idem.finish();
        toast.show(result.message || "Driver added.", { tone: "ok" });
        await onDone();
      });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const errorInfo = error ? describeError(error) : null;

  return (
    <BottomSheet
      visible={visible}
      title="Add a driver"
      subtitle="Licensed drivers for this car and these dates"
      onClose={() => !busy && onClose()}
      footer={
        options?.canAdd && options.drivers.length ? (
          <Button label="Book this driver" variant="brand" loading={busy} disabled={choice == null} onPress={confirm} />
        ) : undefined
      }
    >
      {loadError ? (
        <ErrorState error={loadError} onRetry={retry} compact />
      ) : !options ? (
        <GlassCard>
          <SkeletonText lines={4} />
        </GlassCard>
      ) : !options.canAdd ? (
        <AppText variant="body">{options.reason}</AppText>
      ) : !options.drivers.length ? (
        <AppText variant="body">No drivers cover this pickup place for these dates yet.</AppText>
      ) : (
        <>
          {options.drivers.map((driver) => (
            <DriverOptionRow key={driver.id} driver={driver} selected={choice === driver.id} onPress={() => setChoice(choice === driver.id ? null : driver.id)} />
          ))}
          <AppText variant="caption">
            {options.sendsOnAcceptance
              ? "Your choice is saved and sent to the driver when the operator accepts your car."
              : "The driver gets your request now. You pay them once they accept."}
          </AppText>
        </>
      )}

      {errorInfo ? (
        <View style={[styles.note, { backgroundColor: tokens.errBg }]} accessibilityRole="alert">
          <Ionicons name="alert-circle-outline" size={18} color={tokens.errFg} />
          <AppText variant="caption" style={[styles.flex, { color: tokens.errFg }]}>
            {errorInfo.message}
          </AppText>
        </View>
      ) : null}
    </BottomSheet>
  );
}

export function DriverOptionRow({
  driver,
  selected,
  onPress,
}: {
  driver: DriverOption;
  selected: boolean;
  onPress: () => void;
}) {
  const { tokens } = useTheme();
  const quote = driver.quote;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${driver.name}, ${quote ? formatSen(quote.totalSen) : formatSen(driver.hourlySen) + " per hour"}`}
      style={({ pressed }) => [
        styles.option,
        {
          borderColor: selected ? tokens.brand : tokens.glassLine,
          backgroundColor: selected ? tokens.okBg : tokens.glassStrong,
        },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={20} color={selected ? tokens.brand : tokens.label} />
      <View style={[styles.avatar, { backgroundColor: tokens.glassStrong }]}>
        {driver.photoUrl ? (
          <Image source={{ uri: driver.photoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
        ) : (
          <Ionicons name="person-outline" size={20} color={tokens.label} />
        )}
      </View>
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{driver.name}</AppText>
        <AppText variant="caption" numberOfLines={1}>
          {driver.languages.join(", ") || "Languages not listed"}
        </AppText>
        <AppText variant="caption" numberOfLines={1}>
          {driver.serviceAreas.join(", ")}
          {driver.yearsDriving != null ? ` · ${driver.yearsDriving} years` : ""}
        </AppText>
      </View>
      <View style={styles.price}>
        {quote ? (
          <>
            <Money sen={quote.totalSen} variant="bodyStrong" />
            <AppText variant="caption">{formatSen(quote.depositSen)} deposit</AppText>
          </>
        ) : (
          <>
            <AppText variant="bodyStrong">{formatSen(driver.hourlySen)}/h</AppText>
            <AppText variant="caption">{formatSen(driver.dailySen)}/day</AppText>
          </>
        )}
      </View>
    </Pressable>
  );
}

// ---- Car operator: the driver on a car booking ----------------------------

/**
 * The car operator's view of an independent driver on one of their car
 * bookings: who it is, and once the driver has accepted, their licence and
 * PSV permit to check, with approve or not approved.
 */
export function OperatorDriverCard({ booking, onChanged }: { booking: any; onChanged: () => Promise<unknown> | void }) {
  const toast = useToast();
  const { tokens } = useTheme();
  const info: CarDriverInfo | undefined = booking?.car?.independentDriver;
  const [opening, setOpening] = useState<DriverDocumentKind | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!info || (!info.current && !info.requested)) return null;
  const current = info.current;
  const accepted = hasAcceptedDriver(info);
  const approved = info.licenceCheck?.status === "APPROVED";

  const view = async (kind: DriverDocumentKind) => {
    if (opening) return;
    setOpening(kind);
    setError(null);
    let file: File | null = null;
    try {
      const result = await downloadDriverDocument(booking.id, kind);
      file = result.file;
      const canPreview = await File.canPreview(file, { mimeType: result.mimeType });
      if (!canPreview) throw new Error("This phone can't open this kind of document.");
      await File.preview(file, { title: kind === "psv" ? "PSV permit" : "Driving licence", mimeType: result.mimeType });
    } catch (err) {
      logger.debug("Driver document failed:", err);
      setError(describeError(err).message);
    } finally {
      setOpening(null);
    }
  };

  const decide = async (decision: "APPROVED" | "REJECTED") => {
    setBusy(true);
    setError(null);
    try {
      const result = await reviewDriverLicence(booking.id, decision, note.trim());
      toast.show(result.message, { tone: decision === "APPROVED" ? "ok" : "info" });
      setRejecting(false);
      setNote("");
      await onChanged();
    } catch (err) {
      setError(describeError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <GlassCard>
      {current ? (
        <>
          <DriverHead name={current.name} photoUrl={current.photoUrl} subtitle={`${current.bookingCode} · ${statusText(current.status)}`} />
          {current.operator?.phone ? (
            <Button
              label={`Call ${current.operator.phone}`}
              variant="text"
              size="sm"
              icon="call-outline"
              onPress={() => Linking.openURL(`tel:${String(current.operator!.phone).replace(/\s+/g, "")}`).catch(() => {})}
            />
          ) : null}
          <DetailLine
            label="Licence check"
            value={approved ? "Approved" : accepted ? "Waiting for your check" : "After the driver accepts"}
          />
        </>
      ) : (
        <AppText variant="body">
          The customer chose {info.requested!.name} as their driver. The request goes to the driver when you accept
          this booking.
        </AppText>
      )}

      {accepted ? (
        <>
          <AppText variant="caption" style={styles.mt8}>
            This driver drives the car instead of the customer, so check their driving licence and PSV permit
            instead of the customer&apos;s. The driver is paid separately; your charges don&apos;t change.
          </AppText>
          <View style={styles.row}>
            <Button label="Licence" variant="line" size="sm" grow icon="card-outline" loading={opening === "licence"} onPress={() => view("licence")} />
            <Button label="PSV permit" variant="line" size="sm" grow icon="document-text-outline" loading={opening === "psv"} onPress={() => view("psv")} />
          </View>
          {!approved && !rejecting ? (
            <View style={styles.row}>
              <Button label="Approve driver" variant="brand" size="sm" grow loading={busy} onPress={() => decide("APPROVED")} />
              <Button label="Not approved" variant="line" size="sm" grow disabled={busy} onPress={() => setRejecting(true)} />
            </View>
          ) : null}
          {rejecting ? (
            <View style={styles.mt8}>
              <TextField
                label="Why can't this driver drive the car?"
                value={note}
                onChangeText={setNote}
                multiline
                maxLength={500}
                hint="The driver booking is cancelled and the customer gets back what they paid the driver."
              />
              <View style={styles.row}>
                <Button label="Back" variant="line" size="sm" grow disabled={busy} onPress={() => setRejecting(false)} />
                <Button
                  label="Confirm"
                  variant="danger"
                  size="sm"
                  grow
                  loading={busy}
                  disabled={note.trim().length < 5}
                  onPress={() => decide("REJECTED")}
                />
              </View>
            </View>
          ) : null}
        </>
      ) : null}

      {error ? (
        <View style={[styles.note, { backgroundColor: tokens.errBg }]} accessibilityRole="alert">
          <Ionicons name="alert-circle-outline" size={18} color={tokens.errFg} />
          <AppText variant="caption" style={[styles.flex, { color: tokens.errFg }]}>
            {error}
          </AppText>
        </View>
      ) : null}
    </GlassCard>
  );
}

/** One line for the operator: whether the customer asked for a driver. */
export function independentDriverText(info: CarDriverInfo | null | undefined) {
  if (info?.current) return `${info.current.name} (${statusText(info.current.status)})`;
  if (info?.requested) {
    return info.requested.outcome === "UNAVAILABLE"
      ? `${info.requested.name}: not available`
      : `${info.requested.name}: sent when you accept`;
  }
  return "Not requested";
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mt8: { marginTop: 8 },
  line: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  lineLabel: { width: 110 },
  lineValue: { flex: 1, textAlign: "right" },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: Radius.sm,
    marginTop: 8,
  },
  row: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    minHeight: 64,
  },
  price: {
    alignItems: "flex-end",
    gap: 2,
  },
  pressed: { opacity: 0.75 },
});
