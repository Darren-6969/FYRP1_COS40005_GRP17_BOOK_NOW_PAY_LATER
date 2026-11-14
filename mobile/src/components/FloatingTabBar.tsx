import { BlurView } from 'expo-blur';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FontFamily, Radius, type ThemeTokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { TAB_BAR_HEIGHT, tabBarBottomOffset } from '@/hooks/use-tab-bar-inset';

const ITEM = 48;
const ITEM_PADDING = 13;
const ICON = 22;
const GAP = 7;
const SPRING = { damping: 15, stiffness: 190, mass: 0.8 };

/**
 * The floating nav pill from the mocks, for both portals' (tabs) layouts.
 *
 * Inactive tabs are 48pt icon circles; the active one springs wider and
 * fades its label in. With Reduce Motion on, it switches without animating.
 * Screen readers get a tab list with the selected tab announced. It hides
 * while the keyboard is open so it never covers a text field.
 *
 * Icons and titles come from each screen's options (tabBarIcon, title).
 */
export function FloatingTabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const { scheme, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (keyboardOpen) return null;

  // Dark mode is translucent on iOS (over a live blur). Android has no live
  // blur here, so it gets an opaque equivalent to stay readable.
  const surface = scheme === 'dark' && Platform.OS === 'android' ? '#16231F' : tokens.nav;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: tabBarBottomOffset(insets.bottom) }]}>
      <View
        accessibilityRole="tablist"
        style={[
          styles.bar,
          {
            borderColor: tokens.navLine,
            boxShadow: '0px 18px 36px -16px rgba(10,20,16,0.55), inset 0px 1px 0px rgba(255,255,255,0.08)',
          },
        ]}
      >
        {Platform.OS === 'ios' ? (
          <BlurView intensity={30} tint={scheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        ) : null}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: surface }]} />

        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          // Routes hidden with `href: null` don't get a tab.
          if ((options as { href?: unknown }).href === null) return null;

          const focused = state.index === index;
          const label = typeof options.title === 'string' ? options.title : route.name;

          // Same events as the stock tab bar, so screens' tabPress listeners work.
          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              navigateToTab(route.key);
            }
          };

          const onLongPress = () => {
            emitter.emit({ type: 'tabLongPress', target: route.key });
          };

          return (
            <TabItem
              key={route.key}
              label={label}
              focused={focused}
              reduceMotion={reduceMotion}
              tokens={tokens}
              badge={options.tabBarBadge}
              onPress={onPress}
              onLongPress={onLongPress}
              renderIcon={(color) => options.tabBarIcon?.({ focused, color, size: ICON }) ?? null}
            />
          );
        })}
      </View>
    </View>
  );
}

type TabItemProps = {
  label: string;
  focused: boolean;
  reduceMotion: boolean;
  tokens: ThemeTokens;
  badge?: string | number;
  onPress: () => void;
  onLongPress: () => void;
  renderIcon: (color: string) => ReactNode;
};

function TabItem({ label, focused, reduceMotion, tokens, badge, onPress, onLongPress, renderIcon }: TabItemProps) {
  // The label is measured once off-screen so the active width fits it exactly.
  const [labelWidth, setLabelWidth] = useState(0);
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    const target = focused ? 1 : 0;
    progress.value = reduceMotion ? target : focused ? withSpring(target, SPRING) : withTiming(target, { duration: 160 });
  }, [focused, progress, reduceMotion]);

  const activeWidth = ITEM_PADDING * 2 + ICON + GAP + labelWidth;

  const pillStyle = useAnimatedStyle(() => ({
    width: interpolate(progress.value, [0, 1], [ITEM, Math.max(ITEM, activeWidth)]),
    backgroundColor: interpolateColor(progress.value, [0, 1], ['rgba(0,0,0,0)', tokens.navOn]),
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.35, 1], [0, 1], 'clamp'),
    width: interpolate(progress.value, [0, 1], [0, labelWidth]),
    marginLeft: interpolate(progress.value, [0, 1], [0, GAP]),
  }));

  const color = focused ? tokens.navOnFg : tokens.navIcon;
  const badgeText = badge === undefined ? '' : `, ${badge} new`;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={`${label}${badgeText}`}
      hitSlop={{ top: 6, bottom: 6 }}
    >
      <Animated.View style={[styles.item, pillStyle]}>
        <View>{renderIcon(color)}</View>
        <Animated.View style={[styles.labelClip, labelStyle]}>
          <Text numberOfLines={1} style={[styles.label, { color: tokens.navOnFg }]}>
            {label}
          </Text>
        </Animated.View>
        {badge !== undefined ? <View style={[styles.badge, { backgroundColor: tokens.cta }]} /> : null}
      </Animated.View>

      {/* Off-screen copy used only to measure the label. */}
      <Text
        style={[styles.label, styles.measure]}
        onLayout={(e) => setLabelWidth(Math.ceil(e.nativeEvent.layout.width))}
        accessible={false}
        importantForAccessibility="no"
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    gap: 4,
    height: TAB_BAR_HEIGHT,
    padding: 6,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  item: {
    height: ITEM,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: ITEM_PADDING,
    overflow: 'hidden',
  },
  labelClip: {
    overflow: 'hidden',
  },
  label: {
    fontFamily: FontFamily.semibold,
    fontSize: 14,
  },
  measure: {
    position: 'absolute',
    opacity: 0,
    left: -9999,
  },
  badge: {
    position: 'absolute',
    top: 10,
    left: ITEM_PADDING + ICON - 4,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
