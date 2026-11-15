import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppText,
  Button,
  ErrorState,
  FieldError,
  FLOATING_BAR_CLEARANCE,
  FloatingActionBar,
  GlassCard,
  IconButton,
  Money,
  SkeletonText,
  TextField,
  useToast,
} from "@/components/ui";
import { Radius } from "@/constants/theme";
import { useIdempotentAttempt } from "@/hooks/use-idempotent-attempt";
import { useTheme } from "@/hooks/use-theme";
import {
  getManualPaymentOptions,
  uploadCustomerReceipt,
  uploadCustomerReceiptFile,
  type ManualPaymentMethod,
  type ManualPaymentType,
} from "@/services/customerApi";
import { isApiError } from "@/services/api";
import { formatMYT } from "@/utils/datetime";
import { describeError } from "@/utils/errors";
import { logger } from "@/utils/logger";
import { formatRM } from "@/utils/money";
import { startAsync } from "@/utils/start-async";

type PaymentOption = {
  paymentType: ManualPaymentType;
  label?: string;
  amount: number;
  available: boolean;
  dueDate?: string | null;
  reason?: string | null;
  replacesPendingReceipt?: boolean;
};

type ManualPaymentResponse = {
  bookingId: number;
  reference: string;
  currency: string;
  options: PaymentOption[];
  defaultPaymentType?: ManualPaymentType;
  note?: string | null;
};

/**
 * F13: the photo is sent as a file to /receipt-file, which stores it
 * privately (max 10 MB). If the server can't take files (private storage not
 * set up, or an older backend without the route), it falls back to the
 * original JSON route, which takes a data URL of at most 7,000,000
 * characters; the base64 copy is kept for that case only.
 */
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const MAX_RECEIPT_CHARS = 6_500_000;
const PICK_QUALITY = 0.5;

type PickedReceipt = {
  /** Local file, sent to the file route and used for the preview. */
  uri: string;
  /** Data URL for the fallback route; null if too large for it. */
  dataUrl: string | null;
};

/** The server can't take receipt files: use the JSON route instead. */
function fileRouteUnavailable(err: unknown) {
  return isApiError(err) && (err.code === "PRIVATE_STORAGE_UNAVAILABLE" || err.status === 404);
}

const TOO_LARGE = "This photo is too large to send. Crop it closer to the receipt, or take a screenshot of it instead.";

const METHODS: { value: ManualPaymentMethod; label: string; icon: "qr-code-outline" | "wallet-outline" }[] = [
  { value: "DUITNOW", label: "DuitNow", icon: "qr-code-outline" },
  { value: "SPAY", label: "SPay", icon: "wallet-outline" },
];

function partLabel(option: PaymentOption) {
  if (option.label) return option.label;
  if (option.paymentType === "DOWN_PAYMENT") return "Down payment";
  if (option.paymentType === "FINAL_PAYMENT") return "Balance";
  return "Payment in full";
}

/**
 * Pay by DuitNow or SPay outside the app, then upload the receipt for the
 * operator to check. The amount, reference and due date are the server's
 * (manual-payment options); the submit keeps one Idempotency-Key per
 * attempt (F1), so a retry after a timeout can't send the receipt twice.
 */
export default function UploadReceiptScreen() {
  const router = useRouter();
  const toast = useToast();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ bookingId?: string; paymentType?: string }>();
  const bookingId = params.bookingId;
  const requestedPaymentType = params.paymentType as ManualPaymentType | undefined;

  const [due, setDue] = useState<ManualPaymentResponse | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [paymentType, setPaymentType] = useState<ManualPaymentType | null>(requestedPaymentType || null);
  const [method, setMethod] = useState<ManualPaymentMethod>("DUITNOW");
  const [receipt, setReceipt] = useState<PickedReceipt | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [remarks, setRemarks] = useState("");
  const [submitError, setSubmitError] = useState<unknown>(null);
  const receiptAttempt = useIdempotentAttempt();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  // The error sits at the end of the form, under the floating bar's reach:
  // bring it into view when it appears.
  useEffect(() => {
    if (submitError) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }, [submitError]);

  const load = useCallback(() => startAsync(async () => {
    if (!bookingId) return;
    try {
      const response: ManualPaymentResponse = await getManualPaymentOptions(bookingId);
      setDue(response);
      const available = (response?.options || []).filter((o) => o.available);
      const pick =
        available.find((o) => o.paymentType === requestedPaymentType) ||
        available.find((o) => o.paymentType === response?.defaultPaymentType) ||
        available[0];
      if (pick) setPaymentType(pick.paymentType);
    } catch (err) {
      logger.debug("Failed to load manual payment:", err);
      setLoadError(err);
    }
  }), [bookingId, requestedPaymentType]);

  // Retry resets first; the first load needs no reset, so the effect's load
  // makes no synchronous state updates (react-hooks/set-state-in-effect).
  const retry = () => {
    setLoadError(null);
    setDue(null);
    return load();
  };

  useEffect(() => {
    load();
  }, [load]);

  const options = useMemo(() => (due?.options || []).filter((o) => o.available), [due]);
  const selected = useMemo(() => options.find((o) => o.paymentType === paymentType) || null, [options, paymentType]);

  const pickImage = async () => {
    setImageError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setImageError("Allow photo access in your phone's settings to upload the receipt.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: PICK_QUALITY,
        base64: true,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) {
        setImageError("We couldn't read that photo. Please choose another one.");
        return;
      }
      if (asset.fileSize && asset.fileSize > MAX_RECEIPT_BYTES) {
        setReceipt(null);
        setImageError(TOO_LARGE);
        return;
      }
      const dataUrl = asset.base64 ? `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}` : null;
      setReceipt({ uri: asset.uri, dataUrl: dataUrl && dataUrl.length <= MAX_RECEIPT_CHARS ? dataUrl : null });
    } catch (err) {
      logger.debug("Receipt image picker failed:", err);
      setImageError("We couldn't open your photos. Please try again.");
    }
  };

  const sendReceipt = async () => {
    const id = bookingId;
    if (!id || !selected || !paymentType) return;
    if (!receipt) {
      setImageError("Add a photo of your payment receipt.");
      return;
    }
    setSubmitError(null);

    const details = { remarks: remarks.trim(), method, paymentType };
    // Same booking, photo and details -> same key, so a retry after a
    // timeout replays the first answer instead of sending twice (F1). The
    // two routes are separate endpoints, so each gets its own key.
    try {
      try {
        const attempt = receiptAttempt.attemptFor(JSON.stringify({ route: "file", bookingId: id, uri: receipt.uri, ...details }));
        await uploadCustomerReceiptFile(id, { uri: receipt.uri, ...details }, attempt.key);
      } catch (err) {
        if (!fileRouteUnavailable(err)) throw err;
        logger.debug("Receipt file route unavailable, sending as data URL:", err);
        if (!receipt.dataUrl) {
          setImageError(TOO_LARGE);
          return;
        }
        const body = { imageUrl: receipt.dataUrl, ...details };
        const attempt = receiptAttempt.attemptFor(JSON.stringify({ route: "json", bookingId: id, ...body }));
        await uploadCustomerReceipt(id, body, attempt.key);
      }
      receiptAttempt.finish();
      toast.show("Receipt sent. The operator will check it.", { tone: "ok" });
      // Nothing to dismiss when opened straight from a link.
      if (router.canDismiss()) router.dismissAll();
      router.replace({ pathname: "/customer/booking/[id]", params: { id: String(id) } } as unknown as Href);
    } catch (err) {
      logger.debug("Receipt upload failed:", err);
      setSubmitError(err);
    }
  };

  const submit = () => receiptAttempt.run(sendReceipt);

  const header = (
    <View style={styles.topRow}>
      <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
      <AppText variant="largeTitle" accessibilityRole="header" style={styles.flex}>
        Pay by receipt
      </AppText>
    </View>
  );

  // A link without a booking is an error straight away, with nothing to load.
  const shownLoadError = loadError ?? (bookingId ? null : new Error("Booking information is missing."));

  if (shownLoadError) {
    return (
      <View style={[styles.screen, styles.pad, { paddingTop: insets.top + 8 }]}>
        {header}
        <ErrorState error={shownLoadError} onRetry={retry} />
      </View>
    );
  }

  const submitInfo = submitError ? describeError(submitError) : null;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 8, paddingBottom: FLOATING_BAR_CLEARANCE + insets.bottom + 12 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {header}

        {!due ? (
          <GlassCard>
            <SkeletonText lines={5} />
          </GlassCard>
        ) : !selected ? (
          <GlassCard>
            <AppText variant="bodyStrong">Nothing to pay by receipt right now</AppText>
            <AppText variant="caption" style={styles.mt4}>
              {due.options?.find((o) => o.reason)?.reason ||
                "There's no payment due on this booking, or a receipt is already being checked."}
            </AppText>
          </GlassCard>
        ) : (
          <>
            <GlassCard>
              <AppText variant="micro">Amount to pay</AppText>
              <Money value={selected.amount} variant="figureL" style={styles.mt4} />
              <AppText variant="caption" style={styles.mt4}>
                {partLabel(selected)}
                {selected.dueDate ? ` · due ${formatMYT(selected.dueDate, "dayDateTime")}` : ""}
              </AppText>
              <View style={[styles.refRow, { borderTopColor: tokens.line }]}>
                <AppText variant="caption" style={styles.flex}>
                  Reference
                </AppText>
                <AppText variant="mono" color="ink" selectable>
                  {due.reference}
                </AppText>
              </View>
              <View style={[styles.note, { backgroundColor: tokens.infoBg }]}>
                <Ionicons name="information-circle-outline" size={18} color={tokens.infoFg} />
                <AppText variant="caption" style={[styles.flex, { color: tokens.infoFg }]}>
                  Pay exactly {formatRM(selected.amount)} and put {due.reference} in the payment remarks.
                  {due.note ? ` ${due.note}` : ""}
                </AppText>
              </View>
              {selected.replacesPendingReceipt ? (
                <View style={[styles.note, { backgroundColor: tokens.warnBg }]}>
                  <Ionicons name="warning-outline" size={18} color={tokens.warnFg} />
                  <AppText variant="caption" style={[styles.flex, { color: tokens.warnFg }]}>
                    A receipt for this payment is already waiting to be checked. Sending a new one replaces it.
                  </AppText>
                </View>
              ) : null}
            </GlassCard>

            {options.length > 1 ? (
              <Section title="What are you paying?">
                <GlassCard padding={4}>
                  {options.map((option, i) => {
                    const on = option.paymentType === paymentType;
                    return (
                      <Pressable
                        key={option.paymentType}
                        onPress={() => setPaymentType(option.paymentType)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on }}
                        style={[styles.option, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.line }]}
                      >
                        <View style={[styles.radio, { borderColor: on ? tokens.brand : tokens.label }]}>
                          {on ? <View style={[styles.radioDot, { backgroundColor: tokens.brand }]} /> : null}
                        </View>
                        <AppText variant="bodyStrong" style={styles.flex}>
                          {partLabel(option)}
                        </AppText>
                        <Money value={option.amount} />
                      </Pressable>
                    );
                  })}
                </GlassCard>
              </Section>
            ) : null}

            <Section title="Paid with">
              <View style={styles.methods}>
                {METHODS.map((m) => {
                  const on = method === m.value;
                  return (
                    <Pressable
                      key={m.value}
                      onPress={() => setMethod(m.value)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      style={[
                        styles.method,
                        {
                          backgroundColor: tokens.glass,
                          borderColor: on ? tokens.leafInk : tokens.glassLine,
                          borderWidth: on ? 2 : StyleSheet.hairlineWidth,
                        },
                      ]}
                    >
                      <Ionicons name={m.icon} size={20} color={on ? tokens.leafInk : tokens.label} />
                      <AppText variant="bodyStrong">{m.label}</AppText>
                    </Pressable>
                  );
                })}
              </View>
            </Section>

            <Section title="Receipt">
              <Pressable
                onPress={pickImage}
                accessibilityRole="button"
                accessibilityLabel={receipt ? "Change receipt photo" : "Add receipt photo"}
                style={[
                  styles.photo,
                  {
                    backgroundColor: tokens.glass,
                    borderColor: imageError ? tokens.errFg : tokens.glassLine,
                    borderWidth: imageError ? 1.5 : StyleSheet.hairlineWidth,
                  },
                ]}
              >
                {receipt ? (
                  <>
                    <Image source={{ uri: receipt.uri }} style={styles.photoImage} contentFit="contain" />
                    <View style={[styles.change, { backgroundColor: tokens.glassStrong }]}>
                      <Ionicons name="swap-horizontal" size={16} color={tokens.ink} />
                      <AppText variant="label" color="ink">
                        Change
                      </AppText>
                    </View>
                  </>
                ) : (
                  <View style={styles.photoEmpty}>
                    <Ionicons name="image-outline" size={30} color={tokens.label} />
                    <AppText variant="bodyStrong">Add receipt photo</AppText>
                    <AppText variant="caption" align="center">
                      A screenshot from your banking app works best.
                    </AppText>
                  </View>
                )}
              </Pressable>
              <FieldError message={imageError} />
            </Section>

            <TextField
              label="Note for the operator (optional)"
              value={remarks}
              onChangeText={setRemarks}
              placeholder="e.g. paid from a family member's account"
              multiline
              maxLength={300}
            />

            {submitInfo ? (
              <View style={[styles.note, { backgroundColor: tokens.errBg }]} accessibilityRole="alert">
                <Ionicons name="alert-circle-outline" size={18} color={tokens.errFg} />
                <View style={styles.flex}>
                  <AppText variant="label" style={{ color: tokens.errFg }}>
                    {submitInfo.title}
                  </AppText>
                  <AppText variant="caption" style={{ color: tokens.errFg }}>
                    {submitInfo.message}
                  </AppText>
                  {submitInfo.retryable ? (
                    // F1: the same attempt keeps its Idempotency-Key, so a
                    // second tap replays the server's answer.
                    <AppText variant="caption" style={[styles.mt4, { color: tokens.errFg }]}>
                      Your receipt may already have arrived. Tapping Send receipt again won&apos;t send it twice.
                    </AppText>
                  ) : null}
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      {selected ? (
        <FloatingActionBar
          action={<Button label="Send receipt" variant="cta" grow disabled={!receipt} onPress={submit} />}
        >
          <Money value={selected.amount} variant="headline" />
          <AppText variant="caption">{partLabel(selected)}</AppText>
        </FloatingActionBar>
      ) : null}
    </KeyboardAvoidingView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="headline" accessibilityRole="header">
        {title}
      </AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  pad: {
    paddingHorizontal: 18,
  },
  content: {
    paddingHorizontal: 18,
    gap: 16,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  mt4: {
    marginTop: 4,
  },
  section: {
    gap: 10,
  },
  refRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  note: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    padding: 12,
    borderRadius: Radius.sm,
    marginTop: 12,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 12,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  methods: {
    flexDirection: "row",
    gap: 10,
  },
  method: {
    flex: 1,
    minHeight: 56,
    borderRadius: Radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  photo: {
    height: 240,
    borderRadius: Radius.card,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
  photoEmpty: {
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 24,
  },
  change: {
    position: "absolute",
    right: 10,
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: Radius.pill,
  },
});
