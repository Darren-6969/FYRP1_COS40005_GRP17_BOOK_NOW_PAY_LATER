import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Height of the floating nav pill: 48pt items plus 6pt padding top and bottom. */
export const TAB_BAR_HEIGHT = 60;

/** Gap between the pill and the bottom of the screen (or the home indicator). */
export const TAB_BAR_GAP = 10;

/** Where the pill sits above the bottom edge, given the safe-area inset. */
export function tabBarBottomOffset(safeBottom: number) {
  return Math.max(safeBottom, 12) + TAB_BAR_GAP;
}

/**
 * Bottom padding a tab screen's ScrollView or FlatList needs so its last
 * item can scroll clear of the floating nav bar. Replaces the hard-coded
 * 110-130 spacers as each tab screen is restyled.
 *
 *   const inset = useTabBarInset();
 *   <ScrollView contentContainerStyle={{ paddingBottom: inset }} />
 */
export function useTabBarInset(extra = 16) {
  const insets = useSafeAreaInsets();
  return tabBarBottomOffset(insets.bottom) + TAB_BAR_HEIGHT + extra;
}
