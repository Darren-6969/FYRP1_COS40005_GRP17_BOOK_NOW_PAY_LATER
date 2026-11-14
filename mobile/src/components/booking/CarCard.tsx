import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, GlassCard, Money, StatusPill } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** The fields of a /public/cars item this card reads. */
export type CarSummary = {
  id: number | string;
  name?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleType?: string | null;
  seats?: number | null;
  transmission?: string | null;
  fuelType?: string | null;
  images?: { imageUrl?: string | null }[] | null;
  operator?: { companyName?: string | null } | null;
  branch?: { city?: string | null } | null;
  booking?: { dailyRateSen?: number | null } | null;
  /**
   * Cars still free for the searched dates, if the server sends it. The
   * "N left" pill only shows when this is present and low (mock: stock pill
   * only when stock is low). /public/cars does not send it yet.
   */
  availableCount?: number | null;
};

type CarCardProps = {
  car: CarSummary;
  onPress: (car: CarSummary) => void;
  saved?: boolean;
  /** Shows the heart button when given. */
  onToggleSaved?: (car: CarSummary) => void;
};

const LOW_STOCK = 3;

function title(car: CarSummary) {
  return car.name || [car.vehicleMake, car.vehicleModel].filter(Boolean).join(' ') || 'Car';
}

function transmissionLabel(value?: string | null) {
  if (!value) return null;
  return value === 'AUTOMATIC' ? 'Auto' : value === 'MANUAL' ? 'Manual' : value;
}

/**
 * A car in a list (Home, all cars, saved cars). Photo, name, operator and
 * city, specs, price per day and "RM 0 to request" (bookings are requests;
 * nothing is paid until the operator accepts). Memoised for FlatList.
 */
export const CarCard = memo(function CarCard({ car, onPress, saved = false, onToggleSaved }: CarCardProps) {
  const { tokens } = useTheme();
  const photo = car.images?.find((image) => image?.imageUrl)?.imageUrl;
  const name = title(car);
  const place = [car.operator?.companyName, car.branch?.city].filter(Boolean).join(' · ');
  const specs = [
    car.seats ? { icon: 'people-outline' as const, text: `${car.seats} seats` } : null,
    transmissionLabel(car.transmission) ? { icon: 'cog-outline' as const, text: transmissionLabel(car.transmission)! } : null,
    car.vehicleType ? { icon: null, text: car.vehicleType } : null,
    car.fuelType ? { icon: null, text: car.fuelType } : null,
  ].filter(Boolean) as { icon: 'people-outline' | 'cog-outline' | null; text: string }[];

  const lowStock =
    typeof car.availableCount === 'number' && car.availableCount > 0 && car.availableCount <= LOW_STOCK;

  return (
    <Pressable
      onPress={() => onPress(car)}
      accessibilityRole="button"
      accessibilityLabel={`${name}${place ? `, ${place}` : ''}`}
      style={({ pressed }) => pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }}
    >
      <GlassCard padding={8}>
        <View style={[styles.photo, { backgroundColor: tokens.glassStrong, borderColor: tokens.glassLine }]}>
          {photo ? (
            <Image
              source={{ uri: photo }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={150}
              recyclingKey={String(car.id)}
              accessible={false}
            />
          ) : (
            <Ionicons name="car-sport-outline" size={44} color={tokens.label} />
          )}
          {lowStock ? (
            <View style={styles.stock}>
              <StatusPill label={`${car.availableCount} left`} tone="ok" />
            </View>
          ) : null}
          {onToggleSaved ? (
            <Pressable
              onPress={() => onToggleSaved(car)}
              accessibilityRole="button"
              accessibilityLabel={saved ? `Remove ${name} from saved` : `Save ${name}`}
              accessibilityState={{ selected: saved }}
              hitSlop={6}
              style={[styles.heart, { backgroundColor: tokens.glassStrong, borderColor: tokens.glassLine }]}
            >
              <Ionicons name={saved ? 'heart' : 'heart-outline'} size={19} color={saved ? tokens.cta : tokens.ink} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.meta}>
          <AppText variant="headline" numberOfLines={1}>
            {name}
          </AppText>
          {place ? (
            <AppText variant="caption" numberOfLines={1}>
              {place}
            </AppText>
          ) : null}
          {specs.length ? (
            <View style={styles.specs}>
              {specs.map((spec) => (
                <View key={spec.text} style={styles.spec}>
                  {spec.icon ? <Ionicons name={spec.icon} size={15} color={tokens.label} /> : null}
                  <AppText variant="caption">{spec.text}</AppText>
                </View>
              ))}
            </View>
          ) : null}
          <View style={styles.priceRow}>
            <View style={styles.price}>
              <Money sen={car.booking?.dailyRateSen} variant="title" />
              <AppText variant="caption"> / day</AppText>
            </View>
            <AppText variant="caption">RM 0 to request</AppText>
          </View>
        </View>
      </GlassCard>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  photo: {
    height: 150,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stock: {
    position: 'absolute',
    left: 10,
    top: 10,
  },
  heart: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    paddingHorizontal: 6,
    paddingTop: 10,
    paddingBottom: 4,
    gap: 5,
  },
  specs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  spec: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  price: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
});
