import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, GlassCard, StatusPill } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMYT } from '@/utils/datetime';
import { formatRM } from '@/utils/money';
import {
  bookingImage,
  bookingRef,
  bookingTitle,
  isActiveBooking,
  owedPart,
  paidInFull,
  partName,
  receiptInReview,
} from '@/utils/booking-view';

type BookingCardProps = {
  booking: any;
  onOpen: (booking: any) => void;
  onPay: (booking: any) => void;
  onReviewOffer: (booking: any) => void;
  onDecline: (booking: any) => void;
};

/** How the operator's suggestion reads in one line on the card. */
export function offerSummary(booking: any) {
  const operator = booking?.operator?.companyName || 'The operator';
  const kind = booking?.car?.alternative?.pricing?.quote?.kind;
  if (kind === 'NEW_DATES') return `${operator} suggested new dates for this car.`;
  if (kind === 'LOCATION_CHARGE') return `${operator} added a charge for the place you asked for.`;
  const offered = booking?.alternativeServiceName;
  return offered ? `${operator} offered a ${offered} instead.` : `${operator} suggested an alternative.`;
}

/**
 * One booking in the Bookings list (mock: "every card says what happens
 * next"). The status pill, the line under the car and the buttons all
 * depend on what the customer needs to do now.
 */
export const BookingCard = memo(function BookingCard({
  booking,
  onOpen,
  onPay,
  onReviewOffer,
  onDecline,
}: BookingCardProps) {
  const { tokens } = useTheme();
  const title = bookingTitle(booking);
  const image = bookingImage(booking);
  const owed = owedPart(booking);
  const status = booking?.status;
  const offer = status === 'ALTERNATIVE_SUGGESTED';

  const dates =
    booking?.pickupDate && booking?.returnDate
      ? `${formatMYT(booking.pickupDate, 'dayDate')} → ${formatMYT(booking.returnDate, 'dayDate')}`
      : null;

  // The pill names the next step where there is one, else the status.
  const pill = owed ? (
    <StatusPill label={`Pay ${partName(owed.part).toLowerCase()}`} tone="warn" />
  ) : receiptInReview(booking) && isActiveBooking(booking) ? (
    <StatusPill label="Receipt in review" tone="info" />
  ) : paidInFull(booking) && isActiveBooking(booking) && status !== 'IN_PROGRESS' ? (
    <StatusPill label="Paid in full" tone="ok" />
  ) : (
    <StatusPill status={status} />
  );

  let nextLine: string | null = null;
  if (owed) {
    nextLine = owed.dueAt ? `Due ${formatMYT(owed.dueAt, 'dayDateTime')}` : `${partName(owed.part)} due`;
  } else if (offer) {
    nextLine = offerSummary(booking);
  } else if (status === 'PENDING') {
    const operator = booking?.operator?.companyName || 'The operator';
    const replyBy = booking?.car?.responseDueAt;
    nextLine = replyBy
      ? `${operator} replies by ${formatMYT(replyBy, 'dayDateTime')}`
      : `Waiting for ${operator === 'The operator' ? 'the operator' : operator} to reply.`;
  } else if (status === 'IN_PROGRESS') {
    nextLine = booking?.returnDate ? `Return by ${formatMYT(booking.returnDate, 'dayDateTime')}` : null;
  } else if (status === 'OVERDUE') {
    nextLine = 'The balance deadline has passed.';
  } else if (isActiveBooking(booking) && booking?.pickupDate) {
    nextLine = `Pick up ${formatMYT(booking.pickupDate, 'dayDateTime')}`;
  }

  return (
    <Pressable
      onPress={() => onOpen(booking)}
      accessibilityRole="button"
      accessibilityLabel={[title, bookingRef(booking), dates, nextLine].filter(Boolean).join('. ')}
      accessibilityHint="Opens the booking"
      style={({ pressed }) => pressed && styles.pressed}
    >
      <GlassCard style={styles.card}>
        <View style={styles.top}>
          {pill}
          <AppText variant="mono" color="label">
            {bookingRef(booking)}
          </AppText>
        </View>

        <View style={styles.car}>
          <View style={[styles.thumb, { backgroundColor: tokens.glassStrong, borderColor: tokens.glassLine }]}>
            {image ? (
              <Image source={{ uri: image }} style={styles.thumbImage} contentFit="cover" transition={150} />
            ) : (
              <Ionicons name="car-sport-outline" size={24} color={tokens.label} />
            )}
          </View>
          <View style={styles.flex}>
            <AppText variant="headline" numberOfLines={1}>
              {title}
            </AppText>
            {dates ? <AppText variant="caption">{dates}</AppText> : null}
          </View>
        </View>

        {nextLine || owed ? (
          <View style={[styles.next, { borderTopColor: tokens.line }]}>
            {nextLine ? (
              <AppText variant="caption" color={owed ? 'warnFg' : 'text'} style={styles.flex}>
                {nextLine}
              </AppText>
            ) : (
              <View style={styles.flex} />
            )}
            {owed ? (
              <Button
                label={`Pay ${formatRM(owed.amount)}`}
                variant="cta"
                size="sm"
                onPress={() => onPay(booking)}
              />
            ) : null}
          </View>
        ) : null}

        {offer ? (
          <View style={styles.offerButtons}>
            <Button label="Review offer" variant="brand" size="sm" grow onPress={() => onReviewOffer(booking)} />
            <Button label="Decline" variant="line" size="sm" grow onPress={() => onDecline(booking)} />
          </View>
        ) : null}
      </GlassCard>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.85,
  },
  card: {
    gap: 12,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  car: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumb: {
    width: 62,
    height: 46,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  flex: {
    flex: 1,
  },
  next: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  offerButtons: {
    flexDirection: 'row',
    gap: 10,
  },
});
