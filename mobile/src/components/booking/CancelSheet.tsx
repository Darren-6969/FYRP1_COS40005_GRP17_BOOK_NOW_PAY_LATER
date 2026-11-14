import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, BottomSheet, Button, Chip, ErrorState, GlassCard, Money, SkeletonText } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  getCustomerCancellationQuote,
  type CustomerCancellationQuote,
  type CustomerCancellationReason,
} from '@/services/customerApi';
import { formatMYT } from '@/utils/datetime';
import { describeError } from '@/utils/errors';

type CancelSheetProps = {
  bookingId: number | string;
  bookingRef: string;
  visible: boolean;
  onClose: () => void;
  /** Calls the cancel endpoint. Throw to show the error in the sheet. */
  onConfirm: (reason: CustomerCancellationReason | null) => Promise<unknown>;
};

const REASONS: { value: CustomerCancellationReason; label: string }[] = [
  { value: 'PLANS_CHANGED', label: 'Plans changed' },
  { value: 'FOUND_ANOTHER_CAR', label: 'Found another car' },
  { value: 'PRICE', label: 'Price' },
  { value: 'OTHER', label: 'Other' },
];

/**
 * Cancel booking (plan 05b): loads the server's cancellation quote first,
 * so the customer sees exactly what is refunded before confirming. The
 * refund figures are the server's; nothing is worked out on the phone.
 */
export function CancelSheet({ bookingId, bookingRef, visible, onClose, onConfirm }: CancelSheetProps) {
  const { tokens } = useTheme();
  const [quote, setQuote] = useState<CustomerCancellationQuote | null>(null);
  const [quoteError, setQuoteError] = useState<unknown>(null);
  const [reason, setReason] = useState<CustomerCancellationReason | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const loadQuote = useCallback(async () => {
    setQuote(null);
    setQuoteError(null);
    try {
      setQuote(await getCustomerCancellationQuote(bookingId));
    } catch (err) {
      setQuoteError(err);
    }
  }, [bookingId]);

  useEffect(() => {
    if (visible) {
      setReason(null);
      setError(null);
      loadQuote();
    }
  }, [visible, loadQuote]);

  const close = () => {
    if (!busy) onClose();
  };

  const confirm = async () => {
    setError(null);
    setBusy(true);
    try {
      await onConfirm(reason);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const errorInfo = error ? describeError(error) : null;
  const nothingPaid = quote ? Number(quote.totalPaid) === 0 : false;

  return (
    <BottomSheet
      visible={visible}
      title="Cancel this booking?"
      subtitle={bookingRef}
      onClose={close}
      footer={
        <View style={styles.footer}>
          <Button label="Cancel booking" variant="danger" loading={busy} disabled={!quote} onPress={confirm} />
          <Button label="Keep booking" variant="line" disabled={busy} onPress={close} />
        </View>
      }
    >
      {quoteError ? (
        <ErrorState error={quoteError} onRetry={loadQuote} compact />
      ) : !quote ? (
        <GlassCard>
          <SkeletonText lines={4} />
        </GlassCard>
      ) : nothingPaid ? (
        <GlassCard>
          <AppText variant="bodyStrong">Nothing to refund</AppText>
          <AppText variant="caption" style={styles.mt4}>
            You haven't paid anything for this booking, so cancelling costs nothing.
          </AppText>
        </GlassCard>
      ) : (
        <GlassCard>
          <Row label="Paid so far" amount={quote.totalPaid} />
          {Number(quote.depositKept) > 0 ? (
            <Row label="Down payment kept by the operator" amount={quote.depositKept} />
          ) : null}
          {Number(quote.depositRefund) > 0 ? (
            <Row
              label={`Down payment refunded${quote.depositRefundPercent ? ` · ${quote.depositRefundPercent}%` : ''}`}
              amount={quote.depositRefund}
            />
          ) : null}
          {Number(quote.balanceRefund) > 0 ? <Row label="Balance refunded" amount={quote.balanceRefund} /> : null}
          <View style={[styles.total, { borderTopColor: tokens.line }]}>
            <AppText variant="bodyStrong" style={styles.flex}>
              You get back
            </AppText>
            <Money value={quote.totalRefund} variant="headline" />
          </View>
        </GlassCard>
      )}

      {quote?.explanation ? <AppText variant="caption">{quote.explanation}</AppText> : null}

      {quote && Number(quote.totalRefund) > 0 && quote.refundVia ? (
        <View style={[styles.note, { backgroundColor: tokens.infoBg }]}>
          <Ionicons name="information-circle-outline" size={18} color={tokens.infoFg} />
          <AppText variant="caption" style={[styles.flex, { color: tokens.infoFg }]}>
            {quote.refundVia === 'CARD'
              ? 'The refund goes back to the card you paid with.'
              : `The operator transfers the refund to you${
                  quote.refundDeadline ? ` by ${formatMYT(quote.refundDeadline, 'dayDateTime')}` : ''
                }.`}
          </AppText>
        </View>
      ) : null}

      {quote ? (
        <View style={styles.reasons}>
          <AppText variant="label">Why are you cancelling? (optional)</AppText>
          <View style={styles.chips}>
            {REASONS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={reason === option.value}
                onPress={() => setReason(reason === option.value ? null : option.value)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {errorInfo ? (
        <View style={[styles.note, { backgroundColor: tokens.errBg }]} accessibilityRole="alert">
          <Ionicons name="alert-circle-outline" size={18} color={tokens.errFg} />
          <View style={styles.flex}>
            <AppText variant="label" style={{ color: tokens.errFg }}>
              {errorInfo.title}
            </AppText>
            <AppText variant="caption" style={{ color: tokens.errFg }}>
              {errorInfo.message}
            </AppText>
          </View>
        </View>
      ) : null}
    </BottomSheet>
  );
}

function Row({ label, amount }: { label: string; amount: number | string | null | undefined }) {
  return (
    <View style={styles.row}>
      <AppText style={styles.flex}>{label}</AppText>
      <Money value={amount} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  mt4: {
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  total: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  note: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: Radius.sm,
  },
  reasons: {
    gap: 10,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  footer: {
    gap: 10,
  },
});
