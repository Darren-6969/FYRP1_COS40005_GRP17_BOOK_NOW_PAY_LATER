import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AppText, Button, GlassCard, Money, StatusPill } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import type { OperatorBooking } from "@/services/operatorApi";
import {
  customerName,
  initials,
  operatorBookingRef,
  operatorBookingTitle,
  replyByText,
  tripLine,
} from "@/utils/operator-booking";

import type { BookingResponse } from "./ResponseSheets";

type Props = {
  booking: OperatorBooking;
  onOpen: (booking: OperatorBooking) => void;
  /** Shown on pending requests: Accept, Suggest, Decline. */
  onRespond?: (booking: OperatorBooking, action: BookingResponse) => void;
  now?: Date;
};

/**
 * One booking for the operator (plan mock: request card). A pending request
 * carries its reply deadline and the three answers; any other booking shows
 * its status.
 */
export const OperatorBookingCard = memo(function OperatorBookingCard({ booking, onOpen, onRespond, now = new Date() }: Props) {
  const { tokens } = useTheme();
  const name = customerName(booking);
  const pending = booking.status === "PENDING";
  const replyBy = pending ? replyByText(booking.car?.responseDueAt, now) : null;
  const late = !!booking.car?.responseDueAt && new Date(booking.car.responseDueAt).getTime() < now.getTime();

  return (
    <GlassCard>
      <Pressable
        onPress={() => onOpen(booking)}
        accessibilityRole="button"
        accessibilityLabel={`${operatorBookingRef(booking)}, ${name}, ${operatorBookingTitle(booking)}`}
        style={({ pressed }) => [pressed && { opacity: 0.75 }]}
      >
        <View style={styles.top}>
          <View style={[styles.avatar, { backgroundColor: tokens.infoBg }]}>
            <AppText variant="label" style={{ color: tokens.infoFg }}>
              {initials(name)}
            </AppText>
          </View>
          <View style={styles.flex}>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {name}
            </AppText>
            <AppText variant="mono" color="label">
              {operatorBookingRef(booking)}
            </AppText>
          </View>
          <Money value={booking.totalAmount} variant="bodyStrong" />
        </View>

        <AppText variant="body" style={styles.mt8} numberOfLines={1}>
          {operatorBookingTitle(booking)}
        </AppText>
        <AppText variant="caption" numberOfLines={2}>
          {tripLine(booking)}
        </AppText>

        <View style={styles.pills}>
          {pending ? null : <StatusPill status={booking.status} />}
          {replyBy ? <StatusPill label={replyBy} tone={late ? "err" : "warn"} /> : null}
          {booking.serviceType === "CAR_RENTAL" || booking.car ? (
            <StatusPill kind="licence" status={booking.customer?.licenceStatus} dot={false} />
          ) : null}
        </View>
      </Pressable>

      {pending && onRespond ? (
        <View style={styles.actions}>
          <Button label="Accept" variant="brand" size="sm" grow onPress={() => onRespond(booking, "accept")} />
          <Button label="Suggest" variant="line" size="sm" grow onPress={() => onRespond(booking, "suggest")} />
          <Button label="Decline" variant="line" size="sm" grow onPress={() => onRespond(booking, "reject")} />
        </View>
      ) : null}
    </GlassCard>
  );
});

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  mt8: {
    marginTop: 10,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  pills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
});
