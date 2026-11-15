import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import {
  AppText,
  BottomSheet,
  Button,
  ConfirmSheet,
  ErrorState,
  FieldError,
  GlassCard,
  Money,
  SkeletonText,
  StatusPill,
  TextField,
  useToast,
} from "@/components/ui";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  acceptOperatorBooking,
  getAlternativeOptions,
  handoverOperatorBooking,
  markOperatorBookingNoShow,
  previewAlternativeQuote,
  rejectOperatorBooking,
  suggestAlternativeCar,
  type AlternativeOption,
  type AlternativeQuote,
  type OperatorBooking,
} from "@/services/operatorApi";
import { describeError } from "@/utils/errors";
import { logger } from "@/utils/logger";
import { customerName, operatorBookingRef, operatorBookingTitle } from "@/utils/operator-booking";

export type BookingResponse = "accept" | "reject" | "suggest" | "handover" | "noshow";

type Props = {
  booking: OperatorBooking | null;
  action: BookingResponse | null;
  onClose: () => void;
  /** After a successful write: reload the list or the booking. */
  onDone: () => unknown;
};

/** Reasons operators give most; "Other" asks them to type one. */
const DECLINE_REASONS = [
  "The car isn't available for these dates",
  "We can't serve this pick-up or drop-off place",
  "The booking is too short or too far ahead",
  "Other",
];

/**
 * The operator's answers to a booking (plan 05b): accept, decline with a
 * reason, suggest another car (F6), record the handover, mark a no-show
 * (F6). One component so the dashboard, the bookings list and booking
 * detail all behave the same.
 */
export function ResponseSheets({ booking, action, onClose, onDone }: Props) {
  const toast = useToast();
  if (!booking) return null;
  const ref = operatorBookingRef(booking);

  const finish = async (message: string) => {
    toast.show(message, { tone: "ok" });
    onClose();
    await onDone();
  };

  return (
    <>
      <ConfirmSheet
        visible={action === "accept"}
        title={`Accept ${ref}?`}
        message={`${customerName(booking)} is asked to pay the down payment, then the balance before pick-up. The car stays held for them.`}
        confirmLabel="Accept request"
        onConfirm={async () => {
          await acceptOperatorBooking(booking.id);
          await finish("Request accepted. The customer has been asked to pay.");
        }}
        onCancel={onClose}
      />

      <ConfirmSheet
        visible={action === "handover"}
        title="Record the handover?"
        message={`Check ${customerName(booking)}'s identity and driving licence, then hand over the car. The booking moves to on trip.`}
        confirmLabel="Record handover"
        onConfirm={async () => {
          await handoverOperatorBooking(booking.id);
          await finish("Handover recorded.");
        }}
        onCancel={onClose}
      />

      <DeclineSheet visible={action === "reject"} booking={booking} onClose={onClose} onSent={() => finish("Request declined.")} />
      <NoShowSheet visible={action === "noshow"} booking={booking} onClose={onClose} onSent={() => finish("Marked as a no-show.")} />
      <SuggestSheet visible={action === "suggest"} booking={booking} onClose={onClose} onSent={() => finish("Offer sent to the customer.")} />
    </>
  );
}

function DeclineSheet({
  visible,
  booking,
  onClose,
  onSent,
}: {
  visible: boolean;
  booking: OperatorBooking;
  onClose: () => void;
  onSent: () => unknown;
}) {
  const [choice, setChoice] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setChoice(null);
      setNote("");
      setError(null);
    }
  }, [visible]);

  const other = choice === "Other";

  return (
    <ConfirmSheet
      visible={visible}
      title={`Decline ${operatorBookingRef(booking)}?`}
      message="The customer is told the request was declined, with your reason. Nothing was charged."
      confirmLabel="Decline request"
      confirmVariant="danger"
      onConfirm={async () => {
        const reason = other ? note.trim() : [choice, note.trim()].filter(Boolean).join(". ");
        if (!choice) return setError("Choose a reason.");
        if (other && !reason) return setError("Type the reason for the customer.");
        await rejectOperatorBooking(booking.id, reason);
        await onSent();
      }}
      onCancel={onClose}
    >
      <View style={styles.reasons} accessibilityRole="radiogroup">
        {DECLINE_REASONS.map((r) => (
          <Choice
            key={r}
            label={r}
            selected={choice === r}
            onPress={() => {
              setChoice(r);
              setError(null);
            }}
          />
        ))}
      </View>
      <View style={styles.mt8}>
        <TextField
          label={other ? "Reason" : "Note for the customer (optional)"}
          value={note}
          onChangeText={(t) => {
            setNote(t);
            if (error) setError(null);
          }}
          multiline
          maxLength={300}
          placeholder={other ? "Tell the customer why" : "e.g. try our Kuching branch instead"}
        />
      </View>
      <FieldError message={error} />
    </ConfirmSheet>
  );
}

function NoShowSheet({
  visible,
  booking,
  onClose,
  onSent,
}: {
  visible: boolean;
  booking: OperatorBooking;
  onClose: () => void;
  onSent: () => unknown;
}) {
  const [remark, setRemark] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setRemark("");
      setError(null);
    }
  }, [visible]);

  return (
    <ConfirmSheet
      visible={visible}
      title="Mark as a no-show?"
      message={`Use this only if ${customerName(booking)} didn't collect the car. The booking ends, the car is released and it's recorded against the customer. This can't be undone.`}
      confirmLabel="Mark no-show"
      confirmVariant="danger"
      onConfirm={async () => {
        if (!remark.trim()) return setError("Write what happened, for the record.");
        await markOperatorBookingNoShow(booking.id, remark.trim());
        await onSent();
      }}
      onCancel={onClose}
    >
      <TextField
        label="What happened"
        value={remark}
        onChangeText={(t) => {
          setRemark(t);
          if (error) setError(null);
        }}
        error={error}
        multiline
        maxLength={300}
        placeholder="e.g. waited until 11:00 and called twice, no answer"
      />
    </ConfirmSheet>
  );
}

/**
 * F6: pick another of the operator's cars, see the server's price for the
 * booked dates, then send it with a message. Location charges and new dates
 * stay on the website for now.
 */
function SuggestSheet({
  visible,
  booking,
  onClose,
  onSent,
}: {
  visible: boolean;
  booking: OperatorBooking;
  onClose: () => void;
  onSent: () => unknown;
}) {
  const { tokens } = useTheme();
  const [options, setOptions] = useState<AlternativeOption[] | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [selected, setSelected] = useState<AlternativeOption | null>(null);
  const [quote, setQuote] = useState<AlternativeQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<unknown>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<unknown>(null);

  const load = async () => {
    setLoadError(null);
    setOptions(null);
    try {
      const data = await getAlternativeOptions(booking.id);
      setOptions(data.options ?? []);
    } catch (err) {
      logger.debug("[suggest] options failed", err);
      setLoadError(err);
    }
  };

  useEffect(() => {
    if (!visible) return;
    setSelected(null);
    setQuote(null);
    setQuoteError(null);
    setReason("");
    setReasonError(null);
    setSendError(null);
    load();
    // Reload each time the sheet opens, for the booking it opens with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, booking.id]);

  const choose = async (option: AlternativeOption) => {
    setSelected(option);
    setQuote(null);
    setQuoteError(null);
    setSendError(null);
    setQuoting(true);
    try {
      const data = await previewAlternativeQuote(booking.id, option.id);
      setQuote(data.quote);
    } catch (err) {
      logger.debug("[suggest] quote failed", err);
      setQuoteError(err);
    } finally {
      setQuoting(false);
    }
  };

  const send = async () => {
    if (!selected || !quote) return;
    if (!reason.trim()) {
      setReasonError("Tell the customer why you're suggesting this car.");
      return;
    }
    setSendError(null);
    try {
      await suggestAlternativeCar(booking.id, { alternativeListingId: selected.id, reason: reason.trim() });
      await onSent();
    } catch (err) {
      logger.debug("[suggest] send failed", err);
      setSendError(err);
    }
  };

  const problems = quote?.problems ?? [];
  const ready = !!quote && !quoting && problems.length === 0;
  const sendInfo = sendError ? describeError(sendError) : null;

  return (
    <BottomSheet
      visible={visible}
      title="Suggest another car"
      subtitle={`Instead of ${operatorBookingTitle(booking)}, same dates`}
      onClose={onClose}
      footer={<Button label="Send offer" variant="brand" disabled={!ready} onPress={send} />}
    >
      {loadError ? (
        <ErrorState error={loadError} onRetry={load} compact />
      ) : !options ? (
        <GlassCard>
          <SkeletonText lines={4} />
        </GlassCard>
      ) : options.length === 0 ? (
        <AppText variant="body">You have no other published cars to suggest.</AppText>
      ) : (
        <View style={styles.options} accessibilityRole="radiogroup">
          {options.map((o) => {
            const on = selected?.id === o.id;
            const unavailable = o.available === false;
            return (
              <Pressable
                key={o.id}
                onPress={() => choose(o)}
                disabled={unavailable}
                accessibilityRole="radio"
                accessibilityState={{ checked: on, disabled: unavailable }}
                accessibilityLabel={`${o.name}${unavailable ? ", not free for these dates" : ""}`}
                style={[
                  styles.option,
                  {
                    backgroundColor: tokens.glass,
                    borderColor: on ? tokens.leafInk : tokens.glassLine,
                    borderWidth: on ? 2 : StyleSheet.hairlineWidth,
                    opacity: unavailable ? 0.5 : 1,
                  },
                ]}
              >
                <View style={[styles.photo, { backgroundColor: tokens.glassStrong }]}>
                  {o.imageUrl ? (
                    <Image source={{ uri: o.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
                  ) : (
                    <Ionicons name="car-sport-outline" size={22} color={tokens.label} />
                  )}
                </View>
                <View style={styles.flex}>
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {o.name}
                  </AppText>
                  <AppText variant="caption" numberOfLines={1}>
                    {[o.branchName, o.seats ? `${o.seats} seats` : null].filter(Boolean).join(" · ")}
                  </AppText>
                  <View style={styles.rateRow}>
                    <Money sen={o.dailyRateSen} variant="label" color="ink" />
                    <AppText variant="caption"> a day</AppText>
                  </View>
                </View>
                {unavailable ? <StatusPill label="Not free" tone="neutral" dot={false} /> : null}
              </Pressable>
            );
          })}
        </View>
      )}

      {selected ? (
        <GlassCard style={styles.mt12}>
          <AppText variant="micro">Price for the customer</AppText>
          {quoting ? (
            <SkeletonText lines={2} />
          ) : quoteError ? (
            <ErrorState error={quoteError} onRetry={() => choose(selected)} compact />
          ) : quote?.pricing ? (
            <>
              <Money sen={quote.pricing.totalSen} variant="figureL" style={styles.mt4} />
              <AppText variant="caption" style={styles.mt4}>
                Requested booking: <Money value={booking.totalAmount} variant="caption" />
              </AppText>
              {quote.pricing.depositSen !== undefined ? (
                <View style={[styles.split, { borderTopColor: tokens.line }]}>
                  <View style={styles.flex}>
                    <AppText variant="caption">Down payment</AppText>
                    <Money sen={quote.pricing.depositSen} variant="label" color="ink" />
                  </View>
                  <View style={styles.flex}>
                    <AppText variant="caption">Balance</AppText>
                    <Money sen={quote.pricing.balanceSen} variant="label" color="ink" />
                  </View>
                </View>
              ) : null}
              {quote.droppedAddons?.length ? (
                <AppText variant="caption" style={styles.mt8}>
                  Not available on this car, so left out: {quote.droppedAddons.join(", ")}.
                </AppText>
              ) : null}
              {quote.pointsChanged ? (
                <AppText variant="caption" style={styles.mt8}>
                  This car is at another branch, so the pick-up and drop-off points change.
                </AppText>
              ) : null}
            </>
          ) : null}
          {problems.map((p) => (
            <View key={p.code} style={[styles.note, { backgroundColor: tokens.errBg }]}>
              <Ionicons name="alert-circle-outline" size={18} color={tokens.errFg} />
              <AppText variant="caption" style={[styles.flex, { color: tokens.errFg }]}>
                {p.message}
              </AppText>
            </View>
          ))}
        </GlassCard>
      ) : null}

      {selected && ready ? (
        <View style={styles.mt12}>
          <TextField
            label="Message to the customer"
            value={reason}
            onChangeText={(t) => {
              setReason(t);
              if (reasonError) setReasonError(null);
            }}
            error={reasonError}
            multiline
            maxLength={500}
            placeholder="e.g. The Myvi is booked that weekend, but the Bezza is free at the same branch."
          />
        </View>
      ) : null}

      {sendInfo ? (
        <View style={[styles.note, { backgroundColor: tokens.errBg }]} accessibilityRole="alert">
          <Ionicons name="alert-circle-outline" size={18} color={tokens.errFg} />
          <View style={styles.flex}>
            <AppText variant="label" style={{ color: tokens.errFg }}>
              {sendInfo.title}
            </AppText>
            <AppText variant="caption" style={{ color: tokens.errFg }}>
              {sendInfo.message}
            </AppText>
          </View>
        </View>
      ) : null}
    </BottomSheet>
  );
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { tokens } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={[styles.choice, { borderTopColor: tokens.line }]}
    >
      <View style={[styles.radio, { borderColor: selected ? tokens.brand : tokens.label }]}>
        {selected ? <View style={[styles.radioDot, { backgroundColor: tokens.brand }]} /> : null}
      </View>
      <AppText variant="body" color="ink" style={styles.flex}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  mt4: {
    marginTop: 4,
  },
  mt8: {
    marginTop: 8,
  },
  mt12: {
    marginTop: 12,
  },
  reasons: {
    marginTop: 4,
  },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 48,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  options: {
    gap: 8,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: Radius.md,
  },
  photo: {
    width: 64,
    height: 48,
    borderRadius: Radius.sm,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  rateRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 2,
  },
  split: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  note: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    padding: 12,
    borderRadius: Radius.sm,
    marginTop: 12,
  },
});
