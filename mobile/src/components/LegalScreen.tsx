import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText, Button, ErrorState, GlassCard, IconButton, SegmentedControl, SkeletonText } from "@/components/ui";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { getPublicPolicy, type PolicySection } from "@/services/policyApi";
import { WEBSITE_URL } from "@/utils/chat-links";
import { logger } from "@/utils/logger";
import { startAsync } from "@/utils/start-async";

type Language = "en" | "ms";

/** One language of a policy: its library document, page path and the text around it. */
export type LegalCopy = {
  documentKey: string;
  webPath: string;
  title: string;
  intro: string;
  updatedLabel: string;
  webLabel: string;
};

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ms", label: "Bahasa Malaysia" },
] as const;

type Block = { type: "p"; text: string } | { type: "ul"; items: string[] };

/**
 * Policy body text to blocks, the same rule as the website
 * (frontend/src/utils/policyText.js): a blank line separates paragraphs and
 * a line starting with "- " is a list item.
 */
export function parsePolicyBody(body: string): Block[] {
  const blocks: Block[] = [];
  let list: { type: "ul"; items: string[] } | null = null;
  for (const raw of String(body || "").split("\n")) {
    const line = raw.trim();
    if (line.startsWith("- ")) {
      if (!list) {
        list = { type: "ul", items: [] };
        blocks.push(list);
      }
      list.items.push(line.slice(2).trim());
    } else {
      list = null;
      if (line) blocks.push({ type: "p", text: line });
    }
  }
  return blocks;
}

function latestDate(sections: PolicySection[], locale: string) {
  const times = sections.map((s) => new Date(s.publishedAt).getTime()).filter(Number.isFinite);
  if (!times.length) return null;
  return new Date(Math.max(...times)).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
}

function SectionBody({ body }: { body: string }) {
  return (
    <View style={styles.body}>
      {parsePolicyBody(body).map((block, i) =>
        block.type === "ul" ? (
          <View key={i} style={styles.list}>
            {block.items.map((item, j) => (
              <View key={j} style={styles.listItem}>
                <AppText variant="body" accessibilityElementsHidden importantForAccessibility="no">
                  {"•"}
                </AppText>
                <AppText variant="body" style={styles.flex}>
                  {item}
                </AppText>
              </View>
            ))}
          </View>
        ) : (
          <AppText key={i} variant="body">
            {block.text}
          </AppText>
        )
      )}
    </View>
  );
}

/**
 * Terms and Privacy: the published policy library text, in English or
 * Bahasa Malaysia, as numbered frosted sections under a large title.
 */
export function LegalScreen({
  icon,
  copy,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  copy: Record<Language, LegalCopy>;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();

  const [language, setLanguage] = useState<Language>("en");
  const [sections, setSections] = useState<PolicySection[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const current = copy[language];
  // The document the latest load asked for, so a slow answer for the other
  // language never replaces the one on screen.
  const wanted = useRef(current.documentKey);

  const load = useCallback(
    () =>
      startAsync(async () => {
        const key = current.documentKey;
        wanted.current = key;
        setSections(null);
        setError(null);
        try {
          const policy = await getPublicPolicy(key);
          if (wanted.current === key) setSections(policy.sections ?? []);
        } catch (err) {
          logger.debug(`Failed to load policy ${key}:`, err);
          if (wanted.current === key) setError(err);
        }
      }),
    [current.documentKey]
  );

  useEffect(() => {
    load();
  }, [load]);

  const openWeb = () => WebBrowser.openBrowserAsync(`${WEBSITE_URL}${current.webPath}`).catch(() => {});
  const updated = sections?.length ? latestDate(sections, language === "ms" ? "ms-MY" : "en-GB") : null;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
          <AppText variant="largeTitle" accessibilityRole="header" style={styles.flex} numberOfLines={1} adjustsFontSizeToFit>
            {current.title}
          </AppText>
        </View>

        <SegmentedControl
          options={LANGUAGES}
          value={language}
          onChange={setLanguage}
          accessibilityLabel="Language"
        />

        <GlassCard strong>
          <View style={styles.introRow}>
            <View style={[styles.icon, { backgroundColor: tokens.infoBg }]}>
              <Ionicons name={icon} size={22} color={tokens.infoFg} />
            </View>
            <AppText variant="body" color="ink" style={styles.flex}>
              {current.intro}
            </AppText>
          </View>
        </GlassCard>

        {error ? (
          <ErrorState error={error} onRetry={load} />
        ) : !sections ? (
          <GlassCard>
            <SkeletonText lines={6} />
          </GlassCard>
        ) : (
          sections.map((s, i) => (
            <GlassCard key={s.key}>
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
              <SectionBody body={s.body} />
            </GlassCard>
          ))
        )}

        <Button variant="line" label={current.webLabel} onPress={openWeb} />

        {updated ? (
          <AppText variant="caption" align="center">
            {current.updatedLabel} {updated}
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
    gap: 8,
  },
  list: {
    gap: 6,
  },
  listItem: {
    flexDirection: "row",
    gap: 8,
  },
});
