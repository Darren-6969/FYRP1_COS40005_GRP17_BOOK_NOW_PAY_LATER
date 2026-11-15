import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState, type ComponentRef, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText, GlassCard } from "@/components/ui";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

/** Each slide shows for 4.5 s, then moves on, once (plan phase 5). */
const SLIDE_MS = 4500;
const FADE_MS = 600;
/** Slow zoom on the showing photo. */
const ZOOM = 1.06;

type Slide = {
  key: string;
  photo: number;
  /**
   * Where the 3:4 window sits on the 9:16 photo, so the car is just above
   * the fade (plan: rainforest y 450-1950, waterfront 400-1900, coastal
   * 300-1800 of 2000).
   */
  top: `${number}%`;
  label: string;
  title: string;
  body: string;
  tile: ReactNode;
};

/** The photo fills the top of the screen at 3:4, up to 60% of the height. */
function photoHeight(width: number, height: number) {
  return Math.min(width * (4 / 3), height * 0.6);
}

/**
 * Welcome carousel (plan phase 5): three photos that crossfade with a slow
 * zoom, one headline each, and one small frosted tile showing the feature.
 * Auto-advances once; stops on touch, with Reduce Motion, or when a screen
 * reader is on. Swiping works at any time.
 */
export function OnboardingCarousel() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const [index, setIndex] = useState(0);
  const [auto, setAuto] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);

  const photoH = photoHeight(width, height);

  const slides: Slide[] = [
    {
      key: "find",
      photo: require("../../assets/onboarding/slide-1-rainforest.webp"),
      top: "90%",
      label: "Kuching · Miri · Sibu",
      title: "Find a car anywhere in Sarawak",
      body: "Local operators in Kuching, Miri, Sibu and beyond, all in one app.",
      tile: <TownsTile />,
    },
    {
      key: "request",
      photo: require("../../assets/onboarding/slide-2-waterfront.webp"),
      top: "80%",
      label: "Request first",
      title: "Request now. Pay nothing yet.",
      body: "Send a booking request for free. You only pay once the operator says yes.",
      tile: <RequestTile />,
    },
    {
      key: "pay",
      photo: require("../../assets/onboarding/slide-3-coastal.webp"),
      top: "60%",
      label: "Book now, pay later",
      title: "Pay in two parts",
      body: "A down payment after the operator accepts, then the balance before pick-up. Card or DuitNow.",
      tile: <PaymentTile />,
    },
  ];

  // Stop the motion for people who asked for less of it, or use a screen reader.
  useEffect(() => {
    let active = true;
    Promise.all([AccessibilityInfo.isReduceMotionEnabled(), AccessibilityInfo.isScreenReaderEnabled()])
      .then(([reduce, reader]) => {
        if (!active) return;
        setReduceMotion(reduce);
        if (reduce || reader) setAuto(false);
      })
      .catch(() => {});
    const a = AccessibilityInfo.addEventListener("reduceMotionChanged", (on) => {
      setReduceMotion(on);
      if (on) setAuto(false);
    });
    const b = AccessibilityInfo.addEventListener("screenReaderChanged", (on) => {
      if (on) setAuto(false);
    });
    return () => {
      active = false;
      a.remove();
      b.remove();
    };
  }, []);

  const goTo = useCallback(
    (next: number, animated = true) => {
      scrollRef.current?.scrollTo({ x: next * width, animated });
      setIndex(next);
    },
    [width]
  );

  // One pass only: stops on the last slide. Cleared when Welcome loses focus.
  useFocusEffect(
    useCallback(() => {
      if (!auto || index >= slides.length - 1) return;
      const timer = setTimeout(() => goTo(index + 1), SLIDE_MS);
      return () => clearTimeout(timer);
    }, [auto, index, goTo, slides.length])
  );

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(Math.max(0, Math.min(slides.length - 1, next)));
  };

  return (
    <View style={styles.root}>
      {/* Photos, crossfading behind the swipeable pages. */}
      <View style={[styles.photos, { height: photoH }]} pointerEvents="none">
        {slides.map((s, i) => (
          <SlidePhoto key={s.key} photo={s.photo} top={s.top} active={i === index} reduceMotion={reduceMotion} />
        ))}
        <Image
          source={require("../../assets/onboarding/shade-top.png")}
          tintColor="#000000"
          contentFit="fill"
          style={[styles.shade, { height: insets.top + 90 }]}
          accessible={false}
        />
        <Image
          source={require("../../assets/onboarding/fade-bottom.png")}
          tintColor={tokens.background}
          contentFit="fill"
          style={[styles.fade, { height: photoH / 3 }]}
          accessible={false}
        />
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onTouchStart={() => setAuto(false)}
        onMomentumScrollEnd={onScrollEnd}
        scrollEventThrottle={16}
        style={styles.pages}
      >
        {slides.map((s, i) => (
          <View key={s.key} style={[styles.page, { width }]}>
            {/* Read as one item; the dots below stay separate so they can be tapped. */}
            <View accessible accessibilityLabel={`Slide ${i + 1} of ${slides.length}. ${s.title}. ${s.body}`}>
              <View style={[styles.tileArea, { height: photoH }]}>
                <View style={styles.tile}>{s.tile}</View>
              </View>
              <Headline label={s.label} title={s.title} body={s.body} active={i === index} reduceMotion={reduceMotion} />
            </View>
            {/*
              Pushed to the bottom of the slide. Every slide stretches to the
              tallest one's height, so the dots sit at the same height on all
              three, just under the longest text.
            */}
            <Dots
              count={slides.length}
              index={i}
              onSelect={(n) => {
                setAuto(false);
                goTo(n);
              }}
            />
          </View>
        ))}
      </ScrollView>

    </View>
  );
}

/** 44 pt dots; the current slide's dot stretches into a pill. */
function Dots({ count, index, onSelect }: { count: number; index: number; onSelect: (n: number) => void }) {
  const { tokens } = useTheme();
  return (
    <View style={styles.dots} accessibilityRole="tablist">
      {Array.from({ length: count }, (_, n) => {
        const on = n === index;
        return (
          <Pressable
            key={n}
            onPress={() => onSelect(n)}
            accessibilityRole="tab"
            accessibilityLabel={`Slide ${n + 1} of ${count}`}
            accessibilityState={{ selected: on }}
            style={styles.dotHit}
          >
            <View style={[styles.dot, { width: on ? 22 : 8, backgroundColor: on ? tokens.brand : tokens.line }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

function SlidePhoto({ photo, top, active, reduceMotion }: { photo: number; top: `${number}%`; active: boolean; reduceMotion: boolean }) {
  const opacity = useSharedValue(active ? 1 : 0);
  const scale = useSharedValue(1);

  useEffect(() => {
    opacity.value = withTiming(active ? 1 : 0, { duration: reduceMotion ? 0 : FADE_MS });
    if (active && !reduceMotion) {
      scale.value = 1;
      scale.value = withTiming(ZOOM, { duration: SLIDE_MS + FADE_MS, easing: Easing.linear });
    } else if (!active) {
      scale.value = withTiming(1, { duration: FADE_MS });
    }
  }, [active, reduceMotion, opacity, scale]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={{ top }} accessible={false} />
    </Animated.View>
  );
}

function Headline({
  label,
  title,
  body,
  active,
  reduceMotion,
}: {
  label: string;
  title: string;
  body: string;
  active: boolean;
  reduceMotion: boolean;
}) {
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    if (active) {
      progress.value = reduceMotion ? 1 : 0;
      progress.value = withTiming(1, { duration: reduceMotion ? 0 : 500, easing: Easing.out(Easing.cubic) });
    }
  }, [active, reduceMotion, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 12 }],
  }));

  return (
    <Animated.View style={[styles.headline, style]}>
      <AppText variant="micro" color="leafInk">
        {label.toUpperCase()}
      </AppText>
      <AppText variant="largeTitle" style={styles.title}>
        {title}
      </AppText>
      <AppText variant="body">{body}</AppText>
    </Animated.View>
  );
}

function TownsTile() {
  const { tokens } = useTheme();
  return (
    <GlassCard strong padding={10}>
      <View style={styles.towns}>
        {["Kuching", "Miri", "Sibu"].map((t) => (
          <View key={t} style={[styles.town, { backgroundColor: tokens.glass, borderColor: tokens.glassLine }]}>
            <Ionicons name="location" size={14} color={tokens.cta} />
            <AppText variant="label" color="ink">
              {t}
            </AppText>
          </View>
        ))}
      </View>
    </GlassCard>
  );
}

function RequestTile() {
  const { tokens } = useTheme();
  return (
    <GlassCard strong padding={12}>
      <View style={styles.tileRow}>
        <View style={[styles.tileIcon, { backgroundColor: tokens.okBg }]}>
          <Ionicons name="checkmark" size={18} color={tokens.okFg} />
        </View>
        <View style={styles.flex}>
          <AppText variant="bodyStrong">Request sent</AppText>
          <AppText variant="caption">The operator replies next</AppText>
        </View>
        <AppText variant="headline">RM 0</AppText>
      </View>
    </GlassCard>
  );
}

function PaymentTile() {
  const { tokens } = useTheme();
  return (
    <GlassCard strong padding={12}>
      <AppText variant="micro">Example</AppText>
      <View style={[styles.tileRow, styles.mt4]}>
        <View style={styles.flex}>
          <AppText variant="caption">Down payment</AppText>
          <AppText variant="headline">RM 112.20</AppText>
        </View>
        <View style={[styles.divider, { backgroundColor: tokens.line }]} />
        <View style={styles.flex}>
          <AppText variant="caption">Before pick-up</AppText>
          <AppText variant="headline">RM 306.80</AppText>
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  // Only as tall as its content, so the buttons on Welcome follow right after it.
  root: {},
  flex: {
    flex: 1,
  },
  mt4: {
    marginTop: 4,
  },
  photos: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
  },
  shade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  fade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  pages: {
    flexGrow: 0,
  },
  tileArea: {
    justifyContent: "flex-end",
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  // A real width, not shrink-to-fit: the tiles' flex: 1 columns need room
  // to share, or they collapse and wrap one letter per line.
  tile: {
    width: "100%",
    maxWidth: 340,
  },
  headline: {
    paddingHorizontal: 22,
    gap: 8,
  },
  title: {
    marginTop: 2,
  },
  page: {
    flexDirection: "column",
  },
  dots: {
    flexDirection: "row",
    alignSelf: "center",
    marginTop: "auto",
    paddingTop: 8,
  },
  dotHit: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  towns: {
    flexDirection: "row",
    gap: 6,
  },
  town: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  tileIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
  },
});
