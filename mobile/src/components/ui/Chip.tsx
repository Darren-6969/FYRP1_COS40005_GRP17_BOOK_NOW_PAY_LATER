import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { AppText } from './AppText';

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Show a tick when selected (multi-select filters). */
  check?: boolean;
};

/**
 * A selectable pill: car type chips on Home, options in the filter panel.
 * Announced as a checkbox with its checked state.
 */
export function Chip({ label, selected, onPress, check = false }: ChipProps) {
  const { tokens } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      hitSlop={{ top: 3, bottom: 3 }}
      style={({ pressed }) => [
        styles.chip,
        selected
          ? { backgroundColor: tokens.brand, borderColor: 'transparent' }
          : { backgroundColor: tokens.glass, borderColor: tokens.glassLine },
        pressed && { opacity: 0.8 },
      ]}
    >
      {check && selected ? <Ionicons name="checkmark" size={15} color={tokens.onBrand} /> : null}
      <AppText variant="label" numberOfLines={1} style={{ color: selected ? tokens.onBrand : tokens.ink }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 15,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
