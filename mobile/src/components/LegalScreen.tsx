import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { ComponentProps } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText, GlassCard, IconButton } from "@/components/ui";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export type LegalSection = { title: string; body: string };

/**
 * Terms and Privacy (plan phase 5): numbered frosted sections under a large
 * title. The wording lives in each screen; this only lays it out.
 */
export function LegalScreen({
  title,
  icon,
  intro,
  notice,
  sections,
  footerTitle,
  footerText,
  updated,
}: {
  title: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  intro: string;
  notice?: string;
  sections: LegalSection[];
  footerTitle?: string;
  footerText?: string;
  updated?: string;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
          <AppText variant="largeTitle" accessibilityRole="header" style={styles.flex} numberOfLines={1} adjustsFontSizeToFit>
            {title}
          </AppText>
        </View>

        <GlassCard strong>
          <View style={styles.introRow}>
            <View style={[styles.icon, { backgroundColor: tokens.infoBg }]}>
              <Ionicons name={icon} size={22} color={tokens.infoFg} />
            </View>
            <AppText variant="body" color="ink" style={styles.flex}>
              {intro}
            </AppText>
          </View>
          {notice ? (
            <AppText variant="caption" style={styles.notice}>
              {notice}
            </AppText>
          ) : null}
        </GlassCard>

        {sections.map((s, i) => (
          <GlassCard key={s.title}>
            <View style={styles.sectionHead}>
              <View style={[styles.number, { backgroundColor: tokens.glassStrong, borderColor: tokens.glassLine }]}>
                <AppText variant="mono" color="ink">
                  {i + 1}
                </AppText>
              </View>
              <AppText variant="headline" accessibilityRole="header" style={styles.flex}>
                {s.title}
              </AppText>
            </View>
            <AppText variant="body" style={styles.body}>
              {s.body}
            </AppText>
          </GlassCard>
        ))}

        {footerTitle || footerText ? (
          <GlassCard>
            {footerTitle ? <AppText variant="bodyStrong">{footerTitle}</AppText> : null}
            {footerText ? (
              <AppText variant="body" style={styles.body}>
                {footerText}
              </AppText>
            ) : null}
          </GlassCard>
        ) : null}

        {updated ? (
          <AppText variant="caption" align="center">
            {updated}
          </AppText>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    gap: 12,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 4,
  },
  flex: {
    flex: 1,
  },
  introRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  notice: {
    marginTop: 12,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  number: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    marginTop: 8,
  },
});
