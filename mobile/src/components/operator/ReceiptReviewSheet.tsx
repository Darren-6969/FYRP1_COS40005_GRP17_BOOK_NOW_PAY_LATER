import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ReceiptViewer, isViewableReceipt } from "@/components/booking/ReceiptViewer";
import { AppText, BottomSheet, Button, GlassCard, Money, TextField, useToast } from "@/components/ui";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { approveOperatorPayment, rejectOperatorPayment, type OperatorPayment } from "@/services/operatorApi";
import { formatMYT } from "@/utils/datetime";
import { describeError } from "@/utils/errors";
import { logger } from "@/utils/logger";
import { customerName, operatorBookingRef } from "@/utils/operator-booking";

/** Which part the receipt pays, from the receipt or the part waiting for review. */
export function receiptPart(payment: OperatorPayment): { label: string; amount: number | string | null | undefined } {
  const receipt = payment.booking?.receipt;
  const type =
    receipt?.paymentType ||
    (payment.downPaymentStatus === "PENDING_VERIFICATION"
      ? "DOWN_PAYMENT"
      : payment.finalPaymentStatus === "PENDING_VERIFICATION"
        ? "FINAL_PAYMENT"
        : null);
  const label = type === "DOWN_PAYMENT" ? "Down payment" : type === "FINAL_PAYMENT" ? "Balance" : "Payment in full";
  // The server's expected figure first; otherwise the server's part amount.
  const amount =
    receipt?.expectedAmount ??
    (type === "DOWN_PAYMENT" ? payment.downPaymentAmount : type === "FINAL_PAYMENT" ? payment.finalPaymentAmount : payment.amount);
  return { label, amount };
}

/**
 * Review a DuitNow or SPay receipt (plan 05b): the photo, what it should
 * pay, then Approve, or Reject with a reason the customer sees.
 */
export function ReceiptReviewSheet({
  payment,
  onClose,
  onDone,
}: {
  payment: OperatorPayment | null;
  onClose: () => void;
  onDone: () => unknown;
}) {
  const toast = useToast();
  const { tokens } = useTheme();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<unknown>(null);
  const [viewer, setViewer] = useState(false);

  useEffect(() => {
    setRejecting(false);
    setReason("");
    setReasonError(null);
    setSendError(null);
  }, [payment?.id]);

  if (!payment) return null;
  const booking = payment.booking;
  const receipt = booking?.receipt;
  const part = receiptPart(payment);
  const uri = isViewableReceipt(receipt?.imageUrl) ? receipt!.imageUrl : null;

  const approve = async () => {
    setSendError(null);
    try {
      await approveOperatorPayment(payment.id);
      toast.show(`${part.label} approved.`, { tone: "ok" });
      onClose();
      await onDone();
    } catch (err) {
      logger.debug("Approve payment failed:", err);
      setSendError(err);
    }
  };

  const reject = async () => {
    if (!reason.trim()) {
      setReasonError("Tell the customer what's wrong, so they can send a new receipt.");
      return;
    }
    setSendError(null);
    try {
      await rejectOperatorPayment(payment.id, reason.trim());
      toast.show("Receipt rejected. The customer has been told why.", { tone: "ok" });
      onClose();
      await onDone();
    } catch (err) {
      logger.debug("Reject payment failed:", err);
      setSendError(err);
    }
  };

  const sendInfo = sendError ? describeError(sendError) : null;

  return (
    <>
      <BottomSheet
        visible={!viewer}
        title="Check the receipt"
        subtitle={booking ? `${operatorBookingRef(booking)} · ${customerName(booking)}` : undefined}
        onClose={onClose}
        maxHeight={0.95}
        footer={
          rejecting ? (
            <View style={styles.footer}>
              <Button label="Back" variant="line" grow onPress={() => setRejecting(false)} />
              <Button label="Reject receipt" variant="danger" grow onPress={reject} />
            </View>
          ) : (
            <View style={styles.footer}>
              <Button label="Reject" variant="line" grow onPress={() => setRejecting(true)} />
              <Button label="Approve" variant="brand" grow onPress={approve} />
            </View>
          )
        }
      >
        <Pressable
          onPress={() => uri && setViewer(true)}
          disabled={!uri}
          accessibilityRole="imagebutton"
          accessibilityLabel="Receipt photo. Tap to view full screen"
          style={[styles.photo, { backgroundColor: tokens.glassStrong, borderColor: tokens.glassLine }]}
        >
          {uri ? (
            <>
              <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" />
              <View style={[styles.zoom, { backgroundColor: tokens.glassStrong }]}>
                <Ionicons name="expand-outline" size={16} color={tokens.ink} />
                <AppText variant="label" color="ink">
                  Full screen
                </AppText>
              </View>
            </>
          ) : (
            <AppText variant="caption">The receipt photo can&apos;t be shown.</AppText>
          )}
        </Pressable>

        <GlassCard style={styles.mt12}>
          <AppText variant="micro">{part.label} should be</AppText>
          <Money value={part.amount} variant="figureL" style={styles.mt4} />
          {receipt?.uploadedAt ? (
            <AppText variant="caption" style={styles.mt4}>
              Sent {formatMYT(receipt.uploadedAt, "dayDateTime")}
              {payment.method ? ` · ${payment.method}` : ""}
            </AppText>
          ) : null}
          {receipt?.remarks ? (
            <AppText variant="body" style={styles.mt8}>
              Customer&apos;s note: {receipt.remarks}
            </AppText>
          ) : null}
          {booking?.bookingCode ? (
            <AppText variant="caption" style={styles.mt8}>
              The payment reference should be {booking.bookingCode}.
            </AppText>
          ) : null}
        </GlassCard>

        {rejecting ? (
          <View style={styles.mt12}>
            <TextField
              label="Why are you rejecting it?"
              value={reason}
              onChangeText={(t) => {
                setReason(t);
                if (reasonError) setReasonError(null);
              }}
              error={reasonError}
              multiline
              maxLength={300}
              placeholder="e.g. The amount is RM 50 short, or the photo is too blurry to read."
            />
            <AppText variant="caption" style={styles.mt4}>
              The customer is asked to pay or send a new receipt.
            </AppText>
          </View>
        ) : (
          <AppText variant="caption" style={styles.mt12}>
            Approve only if the money has arrived in your account for the right amount.
          </AppText>
        )}

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

      <ReceiptViewer uri={uri} visible={viewer} onClose={() => setViewer(false)} />
    </>
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
  footer: {
    flexDirection: "row",
    gap: 10,
  },
  photo: {
    height: 280,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  zoom: {
    position: "absolute",
    right: 10,
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: Radius.pill,
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
