import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, GlassCard, Money, StatusPill } from '@/components/ui';
import { paymentStatus } from '@/constants/status';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMYT } from '@/utils/datetime';
import { formatRM } from '@/utils/money';
import { bookingRef, bookingTitle, owedPart, partName, receiptInReview } from '@/utils/booking-view';

/** A /customer/payments row: the Payment with its booking attached. */
export type CustomerPayment = {
  id: number;
  bookingId: number;
  status?: string;
  downPaymentAmount?: number | string | null;
  finalPaymentAmount?: number | string | null;
  downPaymentStatus?: string | null;
  finalPaymentStatus?: string | null;
  downPaymentDueDate?: string | null;
  finalPaymentDueDate?: string | null;
  booking?: any;
};

export type PaymentGroup = 'due' | 'review' | 'paid' | 'closed';

/** The booking with this payment on it, the shape booking-view expects. */
export function bookingOf(payment: CustomerPayment) {
  return { ...(payment.booking ?? { id: payment.bookingId }), payment };
}

/** Which tab a payment belongs to, from server statuses only. */
export function paymentGroup(payment: CustomerPayment): PaymentGroup {
  const booking = bookingOf(payment);
  if (payment.status === 'PAID') return 'paid';
  if (receiptInReview(booking)) return 'review';
  if (owedPart(booking)) return 'due';
  // Anything else can't be paid from the app right now (cancelled, overdue,
  // declined): it's listed under All with the booking's status.
  return 'closed';
}

type PaymentCardProps = {
  payment: CustomerPayment;
  onPay: (payment: CustomerPayment) => void;
  onInvoice: (payment: CustomerPayment) => void;
  onOpenBooking: (payment: CustomerPayment) => void;
};

/**
 * One payment on the Payments tab. Both parts are listed with the server's
 * amounts and statuses; the app adds nothing up (F16).
 */
export const PaymentCard = memo(function PaymentCard({ payment, onPay, onInvoice, onOpenBooking }: PaymentCardProps) {
  const { tokens } = useTheme();
  const booking = bookingOf(payment);
  const owed = owedPart(booking);
  const group = paymentGroup(payment);
  const receipt = booking.receipt;

  const pill =
    group === 'due' && owed ? (
      <StatusPill label={`Pay ${partName(owed.part).toLowerCase()}`} tone="warn" />
    ) : group === 'review' && receiptInReview(booking) ? (
      <StatusPill label="Receipt in review" tone="info" />
    ) : group === 'closed' ? (
      <StatusPill status={booking.status} />
    ) : (
      <StatusPill status={payment.status} kind="payment" />
    );

  const parts = [
    {
      key: 'down',
      title: 'Down payment',
      amount: payment.downPaymentAmount,
      status: payment.downPaymentStatus,
      due: payment.downPaymentDueDate,
    },
    {
      key: 'final',
      title: 'Balance',
      amount: payment.finalPaymentAmount,
      status: payment.finalPaymentStatus,
      due: payment.finalPaymentDueDate,
    },
  ].filter((p) => p.amount !== null && p.amount !== undefined && String(p.amount) !== '0');

  return (
    <GlassCard style={styles.card}>
      <Pressable
        onPress={() => onOpenBooking(payment)}
        accessibilityRole="button"
        accessibilityHint="Opens the booking"
        style={({ pressed }) => [styles.head, pressed && styles.pressed]}
      >
        <View style={styles.top}>
          {pill}
          <AppText variant="mono" color="label">
            {bookingRef(booking)}
          </AppText>
        </View>
        <AppText variant="headline" numberOfLines={1}>
          {bookingTitle(booking)}
        </AppText>
        {booking.pickupDate ? (
          <AppText variant="caption">
            {formatMYT(booking.pickupDate, 'dayDate')} → {formatMYT(booking.returnDate, 'dayDate')}
            {booking.operator?.companyName ? ` · ${booking.operator.companyName}` : ''}
          </AppText>
        ) : null}
      </Pressable>

      {parts.length > 0 ? (
        <View style={[styles.parts, { borderTopColor: tokens.line }]}>
          {parts.map((p) => {
            const info = paymentStatus(p.status);
            const owedNow = owed && ((owed.part === 'DOWN_PAYMENT' && p.key === 'down') || (owed.part === 'FINAL_PAYMENT' && p.key === 'final'));
            const caption =
              p.status === 'PAID'
                ? 'Paid'
                : owedNow && p.due && group !== 'closed'
                  ? `Due ${formatMYT(p.due, 'dayDateTime')}`
                  : p.key === 'final' && group === 'due' && payment.downPaymentStatus !== 'PAID'
                    ? 'After the down payment'
                    : info.label;
            return (
              <View key={p.key} style={styles.partRow} accessible accessibilityLabel={`${p.title}, ${formatRM(p.amount)}, ${caption}`}>
                <Ionicons
                  name={p.status === 'PAID' ? 'checkmark-circle' : owedNow ? 'ellipse-outline' : 'remove-circle-outline'}
                  size={18}
                  color={p.status === 'PAID' ? tokens.okFg : owedNow ? tokens.warnFg : tokens.label}
                />
                <View style={styles.flex}>
                  <AppText variant="bodyStrong">{p.title}</AppText>
                  <AppText variant="caption" color={owedNow ? 'warnFg' : 'label'}>
                    {caption}
                  </AppText>
                </View>
                <Money value={p.amount} color={p.status === 'PAID' ? 'label' : 'ink'} />
              </View>
            );
          })}
        </View>
      ) : null}

      {receipt?.status === 'REJECTED' && group === 'due' ? (
        <View style={[styles.note, { backgroundColor: tokens.errBg }]}>
          <Ionicons name="alert-circle-outline" size={18} color={tokens.errFg} />
          <AppText variant="caption" style={[styles.flex, { color: tokens.errFg }]}>
            Your last receipt wasn&apos;t accepted{receipt.remarks ? `: ${receipt.remarks}` : '.'} Please pay again or upload a new receipt.
          </AppText>
        </View>
      ) : null}

      {/* A payment exists only after acceptance, which is when the invoice
          is issued; /customer/payments doesn't send the invoice itself. */}
      {group !== 'closed' ? (
        <View style={styles.actions}>
          <Button label="Invoice" variant="line" size="sm" icon="document-text-outline" grow onPress={() => onInvoice(payment)} />
          {group === 'due' && owed ? (
            <Button label={`Pay ${formatRM(owed.amount)}`} variant="cta" size="sm" grow onPress={() => onPay(payment)} />
          ) : null}
        </View>
      ) : null}
    </GlassCard>
  );
});

const styles = StyleSheet.create({
  card: {
    gap: 12,
  },
  head: {
    gap: 6,
  },
  pressed: {
    opacity: 0.7,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 4,
  },
  parts: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  partRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  flex: {
    flex: 1,
  },
  note: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: Radius.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
});
