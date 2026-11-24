import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { AccountScreen } from "@/components/account/AccountScreen";
import { AppText, Button, ConfirmSheet, ErrorState, GlassCard, SkeletonText, useToast } from "@/components/ui";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { getAccountDeletionRequest, requestAccountDeletion, type AccountDeletionStatus } from "@/services/customerApi";
import { ACCOUNT_DELETION_URL } from "@/utils/chat-links";
import { logger } from "@/utils/logger";
import { startAsync } from "@/utils/start-async";

const POINTS: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }[] = [
  {
    icon: "trash-outline",
    title: "What we delete",
    text: "Your email, phone number, profile photo and password, your driving licence and permits, saved cars, notifications, and your Assistant chats.",
  },
  {
    icon: "document-text-outline",
    title: "What we keep",
    text: "Records of past bookings, payments, refunds and invoices, with your name on them, for 7 years, as Malaysian tax and accounting law requires.",
  },
  {
    icon: "time-outline",
    title: "How long it takes",
    text: "Our team checks the request and deletes the account within 30 days. We email you when it is done.",
  },
];

function formatDate(value?: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-MY", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kuala_Lumpur" }).format(
    new Date(value)
  );
}

/**
 * Delete account, pushed from Profile (rule 05b). The customer confirms in a
 * sheet and the request goes straight to the platform team as a support
 * ticket; the team deletes the account and emails them.
 */
export default function DeleteAccountScreen() {
  const toast = useToast();
  const { tokens } = useTheme();
  const [status, setStatus] = useState<AccountDeletionStatus | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(() => startAsync(async () => {
    setLoadError(null);
    try {
      setStatus(await getAccountDeletionRequest());
    } catch (err) {
      logger.debug("Failed to load deletion request:", err);
      setLoadError(err);
    }
  }), []);

  useEffect(() => {
    load();
  }, [load]);

  const send = async () => {
    // A failure throws: ConfirmSheet shows it and stays open.
    const result = await requestAccountDeletion();
    setStatus({ request: result.request, blockers: result.blockers || [] });
    setConfirmOpen(false);
    toast.show("Request sent. We'll email you when it's done.", { tone: "ok" });
  };

  const request = status?.request;
  const blockers = status?.blockers || [];

  return (
    <AccountScreen
      title="Delete account"
      action={
        status && !request ? (
          <Button label="Request account deletion" variant="danger" icon="trash-outline" grow onPress={() => setConfirmOpen(true)} />
        ) : undefined
      }
    >
      <AppText variant="caption">
        Ask us to delete your account and the personal data linked to it.
      </AppText>

      <GlassCard padding={4}>
        {POINTS.map((point, i) => (
          <View
            key={point.title}
            style={[styles.point, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.line }]}
          >
            <Ionicons name={point.icon} size={20} color={tokens.label} style={styles.pointIcon} />
            <View style={styles.flex}>
              <AppText variant="bodyStrong">{point.title}</AppText>
              <AppText variant="caption">{point.text}</AppText>
            </View>
          </View>
        ))}
      </GlassCard>

      {loadError ? <ErrorState error={loadError} onRetry={load} compact /> : null}
      {!status && !loadError ? <SkeletonText lines={2} /> : null}

      {blockers.length > 0 ? (
        <View style={[styles.banner, { backgroundColor: tokens.warnBg }]} accessibilityRole="summary">
          <AppText variant="bodyStrong" color="warnFg">
            Finish these first, or we will ask you to before deleting:
          </AppText>
          {blockers.map((text) => (
            <AppText key={text} variant="caption" color="warnFg">
              {"• "}
              {text}
            </AppText>
          ))}
        </View>
      ) : null}

      {request ? (
        <View style={[styles.banner, { backgroundColor: tokens.okBg }]} accessibilityLiveRegion="polite">
          <AppText variant="bodyStrong" color="okFg">
            Your request has been sent
          </AppText>
          <AppText variant="caption" color="okFg">
            Reference {request.reference}, sent {formatDate(request.requestedAt)}. We will email you when your account has been
            deleted, or if we need anything from you first.
          </AppText>
        </View>
      ) : null}

      <Button
        label="Read the full details"
        variant="line"
        icon="open-outline"
        onPress={() => WebBrowser.openBrowserAsync(ACCOUNT_DELETION_URL).catch(() => {})}
      />

      <ConfirmSheet
        visible={confirmOpen}
        title="Delete your account?"
        message="We'll send your request to our team. Once your account is deleted it can't be brought back, and you won't be able to sign in."
        confirmLabel="Send deletion request"
        confirmVariant="danger"
        onConfirm={send}
        onCancel={() => setConfirmOpen(false)}
      />
    </AccountScreen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  point: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  pointIcon: {
    marginTop: 2,
  },
  banner: {
    borderRadius: Radius.card,
    padding: 14,
    gap: 4,
  },
});
