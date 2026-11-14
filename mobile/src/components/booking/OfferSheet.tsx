import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, BottomSheet, Button, GlassCard, Money } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isApiError } from '@/services/api';
import { formatMYT } from '@/utils/datetime';
import { describeError } from '@/utils/errors';
import { bookingTitle } from '@/utils/booking-view';

type OfferSheetProps = {
  booking: any;
  visible: boolean;
  onClose: () => void;
  /** Calls accept-alternative. Throw to show the error in the sheet. */
  onAccept: () => Promise<unknown>;
  /** Calls reject-alternative. Throw to show the error in the sheet. */
  onDecline: () => Promise<unknown>;
  /** Reloads the booking, e.g. after the server re-priced the offer. */
  onReload: () => Promise<unknown>;
};

type Side = { title: string; imageUrl?: string | null };

function listingTitle(listing: any) {
  if (!listing) return null;
  return listing.name || [listing.make, listing.model].filter(Boolean).join(' ') || null;
}

function specs(listing: any) {
  return [listing?.transmission, listing?.seats ? `${listing.seats} seats` : null].filter(Boolean).join(' · ');
}

/** Where the car is collected, from a pricing snapshot and its listing. */
function placeOf(pricing: any, listing: any, requestedLocation?: string | null) {
  const requested = pricing?.requestedLocation || requestedLocation;
  if (requested) return `Requested: ${requested}`;
  return pricing?.pickupPoint?.label || listing?.branch?.name || null;
}

function sameInstant(a: any, b: any) {
  if (!a || !b) return true;
  return new Date(a).getTime() === new Date(b).getTime();
}

function range(from: any, to: any) {
  return `${formatMYT(from, 'dayDateTime')} → ${formatMYT(to, 'dayDateTime')}`;
}

/**
 * The operator's suggested alternative, side by side with the original
 * (F5, plan 05b). Every figure is the server's: the original booking's
 * pricing snapshot and the quote saved with the offer. The app compares
 * values to decide what to show but never calculates a difference.
 *
 * Handles the three car offer kinds (another car, new dates, a charge for a
 * requested location) and older free-text offers from host bookings.
 */
export function OfferSheet({ booking, visible, onClose, onAccept, onDecline, onReload }: OfferSheetProps) {
  const { tokens } = useTheme();
  const [confirmingDecline, setConfirmingDecline] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setConfirmingDecline(false);
      setError(null);
      setNotice(null);
    }
  }, [visible]);

  if (!booking) return null;

  const car = booking.car;
  const alt = car?.alternative;
  const operator = booking.operator?.companyName || 'The operator';

  // ---- What changes -------------------------------------------------------
  const kind: string | undefined = alt?.pricing?.quote?.kind;
  const sameCar = kind === 'NEW_DATES' || kind === 'LOCATION_CHARGE';

  const before: Side = { title: bookingTitle(booking), imageUrl: car?.listing?.imageUrl };
  const now: Side = alt
    ? { title: listingTitle(alt.listing) || booking.alternativeServiceName || before.title, imageUrl: alt.listing?.imageUrl }
    : { title: booking.alternativeServiceName || before.title };

  const nowPickup = alt?.pickupAt ?? booking.alternativePickupDate ?? booking.pickupDate;
  const nowReturn = alt?.returnAt ?? booking.alternativeReturnDate ?? booking.returnDate;
  const datesChanged = !sameInstant(nowPickup, booking.pickupDate) || !sameInstant(nowReturn, booking.returnDate);

  const beforePlace = alt ? placeOf(car?.pricing, car?.listing, car?.requestedLocation) : null;
  const nowPlace = alt ? placeOf(alt.pricing, alt.listing ?? car?.listing) : null;
  const placeChanged = Boolean(beforePlace && nowPlace && beforePlace !== nowPlace);

  // Totals: car offers carry integer sen snapshots, older offers ringgit.
  const beforeTotalSen: number | undefined = alt ? car?.pricing?.totalSen : undefined;
  const nowTotalSen: number | undefined = alt ? alt.pricing?.totalSen : undefined;
  const priceChanged = alt
    ? beforeTotalSen !== nowTotalSen
    : Boolean(booking.alternativePrice) && String(booking.alternativePrice) !== String(booking.totalAmount);

  const carChanged = !sameCar && now.title !== before.title;
  const dropped: string[] = alt?.pricing?.quote?.droppedAddons ?? [];
  const reason: string | null = alt?.reason ?? booking.alternativeReason ?? null;

  const heading =
    kind === 'NEW_DATES'
      ? `${operator} suggested new dates for your ${before.title}.`
      : kind === 'LOCATION_CHARGE'
        ? `${operator} can bring the car to the place you asked for, for an extra charge.`
        : `${operator} offered another car for your trip.`;

  // ---- Actions ------------------------------------------------------------
  const accept = async () => {
    setError(null);
    setNotice(null);
    try {
      await onAccept();
    } catch (err) {
      if (isApiError(err) && err.code === 'ALTERNATIVE_PRICE_CHANGED') {
        // The server saved the new price on the booking; show it.
        await onReload().catch(() => {});
        setNotice('The price of this offer changed since it was made. Check the new price below, then accept again.');
        return;
      }
      setError(err);
    }
  };

  const decline = async () => {
    setError(null);
    try {
      await onDecline();
    } catch (err) {
      setError(err);
    }
  };

  const errorInfo = error ? describeError(error) : null;

  const footer = confirmingDecline ? (
    <View style={styles.footer}>
      <AppText variant="caption">Declining closes this booking. Nothing is charged, and you can request another car.</AppText>
      <Button label="Decline offer" variant="danger" onPress={decline} />
      <Button label="Go back" variant="line" onPress={() => setConfirmingDecline(false)} />
    </View>
  ) : (
    <View style={styles.footer}>
      <Button label="Accept offer" variant="brand" onPress={accept} />
      <Button label="Decline" variant="line" onPress={() => setConfirmingDecline(true)} />
    </View>
  );

  return (
    <BottomSheet
      visible={visible}
      title={kind === 'NEW_DATES' ? 'New dates offer' : kind === 'LOCATION_CHARGE' ? 'Location charge' : 'Alternative offer'}
      subtitle={booking.bookingCode || `#${booking.id}`}
      onClose={onClose}
      footer={footer}
    >
      <AppText variant="bodyStrong">{heading}</AppText>

      {reason ? (
        <GlassCard>
          <AppText variant="micro">{operator} says</AppText>
          <AppText style={styles.mt4}>“{reason}”</AppText>
        </GlassCard>
      ) : null}

      {notice ? (
        <View style={[styles.banner, { backgroundColor: tokens.noticeBg }]} accessibilityRole="alert">
          <Ionicons name="pricetag-outline" size={18} color={tokens.noticeFg} />
          <AppText variant="caption" style={[styles.flex, { color: tokens.noticeFg }]}>
            {notice}
          </AppText>
        </View>
      ) : null}

      {errorInfo ? (
        <View style={[styles.banner, { backgroundColor: tokens.errBg }]} accessibilityRole="alert">
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

      <AppText variant="headline" accessibilityRole="header">
        What changes if you accept
      </AppText>

      {carChanged ? (
        <GlassCard>
          <AppText variant="micro">Car</AppText>
          <View style={styles.cars}>
            <CarSide side={before} caption="You asked for" />
            <Ionicons name="arrow-forward" size={18} color={tokens.label} style={styles.arrow} />
            <CarSide side={now} caption="Offered" strong />
          </View>
          {alt?.listing && specs(alt.listing) ? (
            <AppText variant="caption" style={styles.mt8}>
              {specs(alt.listing)}
              {specs(alt.listing) === specs(car?.listing) ? ', same as before' : ''}
            </AppText>
          ) : null}
        </GlassCard>
      ) : null}

      {datesChanged ? (
        <ChangeRow label="Dates" before={range(booking.pickupDate, booking.returnDate)} now={range(nowPickup, nowReturn)} />
      ) : null}

      {placeChanged ? <ChangeRow label="Pick-up place" before={beforePlace!} now={nowPlace!} /> : null}

      {priceChanged ? (
        <GlassCard>
          <AppText variant="micro">Total</AppText>
          <View style={styles.priceRow}>
            <View style={styles.flex}>
              <AppText variant="caption">Before</AppText>
              {alt ? <Money sen={beforeTotalSen} color="label" /> : <Money value={booking.totalAmount} color="label" />}
            </View>
            <Ionicons name="arrow-forward" size={18} color={tokens.label} />
            <View style={[styles.flex, styles.alignEnd]}>
              <AppText variant="caption">With this offer</AppText>
              {alt ? <Money sen={nowTotalSen} variant="headline" /> : <Money value={booking.alternativePrice} variant="headline" />}
            </View>
          </View>
        </GlassCard>
      ) : null}

      {!carChanged && !datesChanged && !placeChanged && !priceChanged ? (
        <AppText variant="caption">The car, dates and price stay the same.</AppText>
      ) : null}

      {dropped.length > 0 ? (
        <AppText variant="caption">Not offered with this car, so not included: {dropped.join(', ')}.</AppText>
      ) : null}

      {alt?.pricing ? (
        <GlassCard>
          <AppText variant="micro">How you'll pay if you accept</AppText>
          {Number(alt.pricing.depositPct) >= 100 || !alt.pricing.balanceSen ? (
            <View style={styles.payRow}>
              <AppText style={styles.flex}>Pay in full after accepting</AppText>
              <Money sen={alt.pricing.totalSen} />
            </View>
          ) : (
            <>
              <View style={styles.payRow}>
                <AppText style={styles.flex}>
                  Down payment{alt.pricing.depositPct ? ` · ${alt.pricing.depositPct}%` : ''}
                </AppText>
                <Money sen={alt.pricing.depositSen} />
              </View>
              <View style={[styles.payRow, { borderTopColor: tokens.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <AppText style={styles.flex}>Balance, before pick-up</AppText>
                <Money sen={alt.pricing.balanceSen} />
              </View>
            </>
          )}
          <AppText variant="caption" style={styles.mt8}>
            Accepting doesn't charge you. You'll get a payment deadline, the same as any accepted booking.
          </AppText>
        </GlassCard>
      ) : null}
    </BottomSheet>
  );
}

function CarSide({ side, caption, strong = false }: { side: Side; caption: string; strong?: boolean }) {
  const { tokens } = useTheme();
  return (
    <View style={styles.carSide}>
      <View style={[styles.photo, { backgroundColor: tokens.glassStrong, borderColor: tokens.glassLine }]}>
        {side.imageUrl ? (
          <Image source={{ uri: side.imageUrl }} style={styles.photoImage} contentFit="cover" transition={150} />
        ) : (
          <Ionicons name="car-sport-outline" size={26} color={tokens.label} />
        )}
      </View>
      <AppText variant="micro">{caption}</AppText>
      <AppText variant={strong ? 'bodyStrong' : 'body'} color={strong ? 'ink' : 'label'} numberOfLines={2}>
        {side.title}
      </AppText>
    </View>
  );
}

function ChangeRow({ label, before, now }: { label: string; before: string; now: string }) {
  return (
    <GlassCard>
      <AppText variant="micro">{label}</AppText>
      <AppText variant="caption" style={[styles.mt4, styles.strike]}>
        {before}
      </AppText>
      <AppText variant="bodyStrong">{now}</AppText>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  alignEnd: {
    alignItems: 'flex-end',
  },
  mt4: {
    marginTop: 4,
  },
  mt8: {
    marginTop: 8,
  },
  strike: {
    textDecorationLine: 'line-through',
  },
  banner: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: Radius.sm,
  },
  cars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  arrow: {
    marginTop: -24,
  },
  carSide: {
    flex: 1,
    gap: 4,
  },
  photo: {
    height: 72,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  footer: {
    gap: 10,
  },
});
