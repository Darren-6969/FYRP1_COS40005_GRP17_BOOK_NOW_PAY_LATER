/**
 * Design tokens for the mobile redesign (Phase 0).
 *
 * Every colour a screen uses comes from `Tokens[scheme]`, read through
 * `useTheme()`. Screens never hard-code hex values; the old screens still do
 * and are moved over phase by phase.
 *
 * Values match the approved mocks in the "BNPL Mobile Redesign" plan.
 */

import '@/global.css';

import { Platform } from 'react-native';

export type ColorScheme = 'light' | 'dark';

export type ThemeTokens = {
  /** Fallback screen colour behind the ambient background image. */
  background: string;
  /** Headings, prices, anything the eye should land on first. */
  ink: string;
  /** Body copy. */
  text: string;
  /** Secondary labels and captions. */
  label: string;
  /** Hairline dividers inside cards. */
  line: string;

  /** Frosted surfaces (GlassCard, fields, chips). */
  glass: string;
  glassStrong: string;
  glassLine: string;
  /** Top inner highlight on glass, drawn as a 1px border-top. */
  glassHighlight: string;
  shadow: string;

  /** Dark green hero card. */
  heroFrom: string;
  heroTo: string;
  onHero: string;
  onHeroSoft: string;
  leaf: string;
  leafInk: string;

  /** Request and Pay only (decision 3: the website's orange). */
  cta: string;
  onCta: string;
  /** Everything else that is a primary action. */
  brand: string;
  onBrand: string;

  /** Floating nav bar. */
  nav: string;
  navLine: string;
  navIcon: string;
  navOn: string;
  navOnFg: string;

  /** Segmented control. */
  seg: string;
  segOn: string;

  /** Status tones (pills, banners). */
  okBg: string;
  okFg: string;
  warnBg: string;
  warnFg: string;
  infoBg: string;
  infoFg: string;
  errBg: string;
  errFg: string;
  noticeBg: string;
  noticeFg: string;
  neutralBg: string;
  neutralFg: string;

  /** Scrim behind sheets and dialogs. */
  scrim: string;
  /** Status bar icon colour that reads on this scheme. */
  statusBar: 'dark' | 'light';
};

export const Tokens: Record<ColorScheme, ThemeTokens> = {
  light: {
    background: '#EDF1E9',
    ink: '#14231F',
    text: '#4B5751',
    label: '#5B6660',
    line: 'rgba(20,35,31,0.08)',

    glass: 'rgba(255,255,255,0.58)',
    glassStrong: 'rgba(255,255,255,0.82)',
    glassLine: 'rgba(255,255,255,0.9)',
    glassHighlight: 'rgba(255,255,255,0.7)',
    shadow: 'rgba(30,60,40,0.45)',

    heroFrom: '#24584B',
    heroTo: '#14231F',
    onHero: '#FFFFFF',
    onHeroSoft: '#C8DCD2',
    leaf: '#7CC98F',
    leafInk: '#2A6B5C',

    cta: '#E8863F',
    onCta: '#14231F',
    brand: '#1E4F44',
    onBrand: '#FFFFFF',

    nav: '#14231F',
    navLine: 'rgba(255,255,255,0.06)',
    navIcon: '#A9BFB5',
    navOn: 'rgba(255,255,255,0.16)',
    navOnFg: '#FFFFFF',

    seg: 'rgba(255,255,255,0.5)',
    segOn: '#FFFFFF',

    okBg: 'rgba(42,107,92,0.12)',
    okFg: '#1E4F44',
    warnBg: 'rgba(232,134,63,0.16)',
    warnFg: '#8A3A12',
    infoBg: 'rgba(63,111,143,0.13)',
    infoFg: '#2F5670',
    errBg: 'rgba(156,42,20,0.1)',
    errFg: '#9C2A14',
    noticeBg: 'rgba(232,184,90,0.2)',
    noticeFg: '#6B4A15',
    neutralBg: 'rgba(20,35,31,0.07)',
    neutralFg: '#4B5751',

    scrim: 'rgba(10,20,16,0.45)',
    statusBar: 'dark',
  },
  dark: {
    background: '#09120F',
    ink: '#EEF1EC',
    text: '#B9C4BE',
    label: '#93A69D',
    line: 'rgba(255,255,255,0.07)',

    glass: 'rgba(255,255,255,0.055)',
    glassStrong: 'rgba(255,255,255,0.09)',
    glassLine: 'rgba(255,255,255,0.09)',
    glassHighlight: 'rgba(255,255,255,0.06)',
    shadow: 'rgba(0,0,0,0.9)',

    heroFrom: '#2F7564',
    heroTo: '#153A31',
    onHero: '#FFFFFF',
    onHeroSoft: '#C8DCD2',
    leaf: '#A6E3B8',
    leafInk: '#8FCAB7',

    cta: '#F0A063',
    onCta: '#14231F',
    brand: '#2A6B5C',
    onBrand: '#FFFFFF',

    nav: 'rgba(255,255,255,0.07)',
    navLine: 'rgba(255,255,255,0.1)',
    navIcon: '#93A69D',
    navOn: '#8FCAB7',
    navOnFg: '#08110E',

    seg: 'rgba(255,255,255,0.05)',
    segOn: 'rgba(255,255,255,0.13)',

    okBg: 'rgba(143,202,183,0.14)',
    okFg: '#A9D6C6',
    warnBg: 'rgba(240,160,99,0.16)',
    warnFg: '#F3B38A',
    infoBg: 'rgba(169,203,224,0.13)',
    infoFg: '#A9CBE0',
    errBg: 'rgba(245,176,160,0.13)',
    errFg: '#F5B0A0',
    noticeBg: 'rgba(241,217,168,0.13)',
    noticeFg: '#F1D9A8',
    neutralBg: 'rgba(255,255,255,0.07)',
    neutralFg: '#B9C4BE',

    scrim: 'rgba(0,0,0,0.6)',
    statusBar: 'light',
  },
};

/**
 * Geist and Geist Mono, loaded in unit 2 (app/_layout.tsx). Each weight is
 * its own family on Android, so components pick the family, not fontWeight.
 */
export const FontFamily = {
  light: 'Geist_300Light',
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  bold: 'Geist_700Bold',
  mono: 'GeistMono_400Regular',
  monoMedium: 'GeistMono_500Medium',
} as const;

/**
 * Type scale: the 20 sizes in today's screens collapse to these.
 * `figure*` are the light, large numbers (countdowns, amounts).
 */
export const Type = {
  largeTitle: { fontFamily: FontFamily.medium, fontSize: 30, lineHeight: 33, letterSpacing: -0.75 },
  title: { fontFamily: FontFamily.semibold, fontSize: 20, lineHeight: 24, letterSpacing: -0.3 },
  headline: { fontFamily: FontFamily.semibold, fontSize: 16, lineHeight: 21, letterSpacing: -0.08 },
  body: { fontFamily: FontFamily.regular, fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: FontFamily.medium, fontSize: 15, lineHeight: 21 },
  label: { fontFamily: FontFamily.medium, fontSize: 14, lineHeight: 19 },
  caption: { fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 18 },
  micro: { fontFamily: FontFamily.medium, fontSize: 12, lineHeight: 16 },
  figureXL: { fontFamily: FontFamily.light, fontSize: 52, lineHeight: 52, letterSpacing: -2 },
  figureL: { fontFamily: FontFamily.light, fontSize: 30, lineHeight: 32, letterSpacing: -0.9 },
  mono: { fontFamily: FontFamily.mono, fontSize: 13, lineHeight: 18 },
} as const;

export type TypeVariant = keyof typeof Type;

/** Corner radii used by the mocks. */
export const Radius = {
  sm: 12,
  md: 16,
  card: 22,
  hero: 24,
  pill: 999,
} as const;

/** Minimum touch target (44pt, the plan's accessibility floor). */
export const TouchTarget = 44;

// ---------------------------------------------------------------------------
// Legacy exports from the Expo template. Only app/explore.tsx and the
// template components use these; they go in the phase 5 cleanup.
// ---------------------------------------------------------------------------

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
