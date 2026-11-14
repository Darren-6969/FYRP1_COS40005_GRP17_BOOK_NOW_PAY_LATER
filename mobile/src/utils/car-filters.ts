/**
 * Filtering and sorting for car lists (Home and the all-cars screen).
 * Moved out of both screens unchanged, so they can't drift apart.
 * Works on the /public/cars items; prices are compared in sen.
 */

import type { CarFilters } from '@/components/CarFilterModal';

const TYPE_ORDER = ['Compact', 'Hatchback', 'Sedan', 'SUV', 'MPV', 'Pickup', 'Van'];

function norm(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

/** "All" plus the vehicle types on offer, in a sensible order. */
export function vehicleTypesOf(cars: any[]): string[] {
  const available = Array.from(new Set(cars.map((car) => String(car.vehicleType || '').trim()).filter(Boolean)));
  const ordered = TYPE_ORDER.filter((type) => available.some((a) => norm(a) === norm(type)));
  const extra = available.filter((a) => !TYPE_ORDER.some((type) => norm(type) === norm(a)));
  return ['All', ...ordered, ...extra];
}

function ringgitToSen(value: string) {
  // Filter input like "120" or "120.5" -> 12050. Digits only, no float maths.
  const match = /^(\d+)(?:\.(\d{0,2}))?/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
}

export function applyCarFilters(
  cars: any[],
  { search = '', city = '', filters }: { search?: string; city?: string; filters: CarFilters }
): any[] {
  const query = search.trim().toLowerCase();
  const minSen = filters.priceMin ? ringgitToSen(filters.priceMin) : null;
  const maxSen = filters.priceMax ? ringgitToSen(filters.priceMax) : null;
  const types = filters.vehicleTypes.map(norm);
  const minSeats = filters.seats.length ? Math.min(...filters.seats.map(Number)) : 0;

  const result = cars.filter((car) => {
    const name = car.name || `${car.vehicleMake || ''} ${car.vehicleModel || ''}`;
    if (
      query &&
      !name.toLowerCase().includes(query) &&
      !norm(car.vehicleMake).includes(query) &&
      !norm(car.vehicleModel).includes(query)
    ) {
      return false;
    }
    if (city && car.branch?.city !== city) return false;
    if (types.length && !types.includes(norm(car.vehicleType))) return false;
    if (minSeats && Number(car.seats || 0) < minSeats) return false;
    if (filters.transmissions.length && !filters.transmissions.includes(car.transmission)) return false;
    if (filters.fuels.length && !filters.fuels.includes(car.fuelType)) return false;
    if (filters.drives.length && !filters.drives.includes(car.driveType)) return false;
    if (filters.brands.length && !filters.brands.includes(car.vehicleMake)) return false;
    if (filters.operators.length && !filters.operators.includes(String(car.operator?.id))) return false;
    if (filters.refunds.length) {
      const refund = car.booking?.refundRule?.type === 'PARTIAL' ? 'partial' : 'none';
      if (!filters.refunds.includes(refund)) return false;
    }
    const daily = Number(car.booking?.dailyRateSen || 0);
    if (minSen !== null && daily < minSen) return false;
    if (maxSen !== null && daily > maxSen) return false;
    return true;
  });

  const sen = (car: any) => Number(car.booking?.dailyRateSen || 0);
  switch (filters.sort) {
    case 'daily':
      return result.sort((a, b) => sen(a) - sen(b));
    case 'payable':
      // Ordering only: daily rate x down-payment % ranks what's due first.
      return result.sort(
        (a, b) => sen(a) * Number(a.booking?.downPaymentPct || 0) - sen(b) * Number(b.booking?.downPaymentPct || 0)
      );
    case 'seats':
      return result.sort((a, b) => Number(a.seats || 0) - Number(b.seats || 0));
    case 'recent':
      return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    default:
      return result;
  }
}

/** True when anything differs from the defaults. */
export function hasActiveFilters(filters: CarFilters, search = '', city = '') {
  return (
    Boolean(search.trim()) ||
    Boolean(city) ||
    filters.vehicleTypes.length > 0 ||
    filters.seats.length > 0 ||
    filters.transmissions.length > 0 ||
    filters.fuels.length > 0 ||
    filters.drives.length > 0 ||
    filters.brands.length > 0 ||
    filters.refunds.length > 0 ||
    filters.operators.length > 0 ||
    Boolean(filters.priceMin) ||
    Boolean(filters.priceMax) ||
    filters.sort !== 'recommended'
  );
}
