import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useRef, useState, type ComponentRef } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText, Button, ErrorState, GlassCard, IconButton, Money, SkeletonText, StatusPill } from "@/components/ui";
import { FontFamily, Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { isApiError } from "@/services/api";
import {
  getChatConversation,
  postChatMessage,
  type ChatAction,
  type ChatBooking,
  type ChatCar,
  type ChatMessage,
  type ChatTicket,
} from "@/services/chatApi";
import { getStoredUser } from "@/services/session";
import { chatLinkTarget } from "@/utils/chat-links";
import { describeError } from "@/utils/errors";
import { logger } from "@/utils/logger";
import { startAsync } from "@/utils/start-async";

/** Which conversation to resume, per signed-in customer. */
const STORE_KEY = "bnpl_chat_conversation";
const MAX_KEPT = 60;
/** While a person is handling the chat, check for their replies this often (as the website does). */
const POLL_MS = 15 * 1000;
const BOOKING_KEYS = ["booking-status", "payments-due", "licence-status"];
const TICKET_STATUS: Record<string, string> = { OPEN: "waiting for a reply", ANSWERED: "replied" };

type Saved = { userId: number | null; conversationId: number; visitorToken: string | null };

async function readSaved(): Promise<Saved | null> {
  try {
    const raw = Platform.OS === "web" ? globalThis.localStorage?.getItem(STORE_KEY) : await SecureStore.getItemAsync(STORE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

async function writeSaved(value: Saved | null) {
  try {
    if (Platform.OS === "web") {
      if (value) globalThis.localStorage?.setItem(STORE_KEY, JSON.stringify(value));
      else globalThis.localStorage?.removeItem(STORE_KEY);
    } else if (value) {
      await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(value));
    } else {
      await SecureStore.deleteItemAsync(STORE_KEY);
    }
  } catch (err) {
    logger.debug("[chat] could not save the conversation id", err);
  }
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** The day picked, as YYYY-MM-DD (the picker's own calendar day). */
function dayOf(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function dayLabel(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

let tempCounter = 0;

/**
 * Help and support (plan phase 3): the platform chatbot, the same one as the
 * website. Answers, guided car search, the customer's bookings and "Talk to
 * a person" all come from the server; the app only shows them.
 */
export default function SupportChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();

  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [ticket, setTicket] = useState<ChatTicket | null>(null);
  const [sending, setSending] = useState(false);
  const [hint, setHint] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [text, setText] = useState("");

  const session = useRef<Saved | null>(null);
  const userId = useRef<number | null>(null);
  // A ref as well as state: a second tap in the same frame sees it (F17).
  const busy = useRef(false);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  // The latest messages for send(), updated after render (never during it).
  const messagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages ?? [];
  }, [messages]);

  const remember = useCallback(async (conversationId: number, visitorToken: string | null) => {
    const next = { userId: userId.current, conversationId, visitorToken };
    session.current = next;
    await writeSaved(next);
  }, []);

  const send = useCallback(
    async (body: { text?: string; action?: ChatAction }, label: string | null) => {
      if (busy.current) return;
      busy.current = true;
      const optimistic: ChatMessage[] = label ? [{ id: `tmp-${++tempCounter}`, role: "user", text: label, pending: true }] : [];
      const lastAssistant = [...messagesRef.current].reverse().find((m) => m.role === "assistant");
      setHint(
        body.text
          ? ticket
            ? "Sending"
            : "Thinking"
          : body.action?.type === "quick" && BOOKING_KEYS.includes(body.action.key)
            ? "Checking your bookings"
            : body.action?.type === "guided" && lastAssistant?.step === "budget"
              ? "Searching cars for your dates"
              : ""
      );
      setSendError(null);
      setSending(true);
      setMessages((current) => [...(current ?? []), ...optimistic]);
      try {
        const data = await postChatMessage({
          ...body,
          conversationId: session.current?.conversationId,
          visitorToken: session.current?.visitorToken ?? undefined,
        });
        const restarted = session.current?.conversationId && data.conversationId !== session.current.conversationId;
        await remember(data.conversationId, data.visitorToken);
        setMessages((current) => {
          const base = restarted ? optimistic : current ?? [];
          // With a ticket open, the server sends back the stored message instead of an answer.
          const kept = base.filter((m) => !(data.sent && m.pending)).map((m) => (m.pending ? { ...m, pending: false } : m));
          return [...kept, ...[data.sent, data.reply].filter(Boolean)].slice(-MAX_KEPT) as ChatMessage[];
        });
        setTicket(data.ticket ?? null);
      } catch (err) {
        logger.debug("[chat] send failed", err);
        setMessages((current) => (current ?? []).filter((m) => !optimistic.includes(m)));
        setSendError(
          isApiError(err) && (err.status === 429 || err.status === 400)
            ? err.message
            : describeError(err).message || "The assistant couldn't be reached. Check your connection and try again."
        );
        if (body.text) setText(body.text);
      } finally {
        busy.current = false;
        setSending(false);
        setHint("");
      }
    },
    [remember, ticket]
  );

  const start = useCallback(() => startAsync(async () => {
    try {
      const user = await getStoredUser();
      userId.current = user?.id ?? null;
      const saved = await readSaved();
      if (saved && saved.userId === userId.current && saved.conversationId) {
        try {
          const data = await getChatConversation(saved.conversationId, saved.visitorToken);
          session.current = saved;
          setMessages(data.messages.slice(-MAX_KEPT));
          setTicket(data.ticket ?? null);
          if (data.messages.length) return;
        } catch (err) {
          // Gone or not this customer's: start a new conversation.
          logger.debug("[chat] could not resume the conversation", err);
          session.current = null;
          await writeSaved(null);
        }
      }
      setMessages([]);
      await send({ action: { type: "welcome" } }, null);
    } catch (err) {
      setLoadError(err);
    }
  }), [send]);

  // Retry resets first; the first load needs no reset, so the effect's load
  // makes no synchronous state updates (react-hooks/set-state-in-effect).
  const retryStart = () => {
    setLoadError(null);
    setMessages(null);
    return start();
  };

  useEffect(() => {
    start();
    // Only on open; start() is stable enough for this screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A person's replies arrive by polling while a ticket is open and the screen is shown.
  useFocusEffect(
    useCallback(() => {
      if (!ticket || !session.current) return;
      const timer = setInterval(async () => {
        if (busy.current || !session.current) return;
        try {
          const data = await getChatConversation(session.current.conversationId, session.current.visitorToken);
          if (busy.current) return;
          setMessages(data.messages.slice(-MAX_KEPT));
          setTicket(data.ticket ?? null);
        } catch (err) {
          logger.debug("[chat] refresh failed", err);
        }
      }, POLL_MS);
      return () => clearInterval(timer);
    }, [ticket])
  );

  const newChat = async () => {
    if (busy.current) return;
    session.current = null;
    await writeSaved(null);
    setTicket(null);
    setSendError(null);
    setMessages([]);
    await send({ action: { type: "welcome" } }, null);
  };

  const sendText = () => {
    const clean = text.trim();
    if (!clean || busy.current) return;
    setText("");
    send({ text: clean }, clean);
  };

  const openLink = (href: string) => {
    const target = chatLinkTarget(href);
    if (!target) return;
    if (target.kind === "app") router.push(target.href);
    else Linking.openURL(target.url).catch((err) => logger.debug("[chat] could not open link", err));
  };

  const lastAssistant = [...(messages ?? [])].reverse().find((m) => m.role === "assistant");

  const header = (
    <View style={[styles.topRow, { paddingTop: insets.top + 8 }]}>
      <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
      <View style={styles.flex}>
        <AppText variant="title" accessibilityRole="header" numberOfLines={1}>
          Help and support
        </AppText>
        <AppText variant="caption" numberOfLines={1}>
          {ticket ? `With ${ticket.with}` : "Assistant, with a person when you need one"}
        </AppText>
      </View>
      <IconButton icon="add" label="New chat" onPress={newChat} disabled={sending} />
    </View>
  );

  if (loadError) {
    return (
      <View style={[styles.screen, styles.pad]}>
        {header}
        <ErrorState error={loadError} onRetry={retryStart} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.pad}>{header}</View>

      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.messages}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        accessibilityLiveRegion="polite"
      >
        {messages === null ? (
          <GlassCard>
            <SkeletonText lines={3} />
          </GlassCard>
        ) : (
          messages.map((m) =>
            m.role === "user" ? (
              <View key={m.id} style={styles.userRow}>
                <View style={[styles.userBubble, { backgroundColor: tokens.brand, opacity: m.pending ? 0.7 : 1 }]}>
                  <AppText variant="body" style={{ color: tokens.onBrand }}>
                    {m.text}
                  </AppText>
                </View>
              </View>
            ) : m.role === "staff" ? (
              <View key={m.id} style={styles.assistantRow}>
                <View style={styles.staffFrom}>
                  <Ionicons name="headset-outline" size={14} color={tokens.label} />
                  <AppText variant="micro">{m.from || "Support"}</AppText>
                </View>
                <Bubble text={m.text} staff />
              </View>
            ) : (
              <AssistantMessage
                key={m.id}
                message={m}
                latest={m === lastAssistant}
                sending={sending}
                onAction={(action, label) => send({ action }, label)}
                onLink={openLink}
              />
            )
          )
        )}

        {sending ? (
          <View style={styles.assistantRow} accessibilityLabel={hint || "The assistant is answering"}>
            <View style={[styles.bubble, styles.typing, { backgroundColor: tokens.glassStrong, borderColor: tokens.glassLine }]}>
              <ActivityIndicator size="small" color={tokens.label} />
              {hint ? <AppText variant="caption">{hint}…</AppText> : null}
            </View>
          </View>
        ) : null}

        {sendError ? (
          <View style={[styles.note, { backgroundColor: tokens.errBg }]} accessibilityRole="alert">
            <Ionicons name="alert-circle-outline" size={18} color={tokens.errFg} />
            <AppText variant="caption" style={[styles.flex, { color: tokens.errFg }]}>
              {sendError}
            </AppText>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {ticket ? (
          <GlassCard padding={12}>
            <AppText variant="caption" color="ink">
              <AppText variant="label" color="ink">
                {ticket.reference}
              </AppText>{" "}
              with {ticket.with} · {TICKET_STATUS[ticket.status] || ticket.status.toLowerCase()}. Messages you type go to them.
            </AppText>
            <Button
              label="Back to the assistant"
              variant="line"
              size="sm"
              style={styles.mt8}
              disabled={sending}
              onPress={() => send({ action: { type: "handoff", value: "close" } }, "Back to the assistant")}
            />
          </GlassCard>
        ) : null}
        <View style={[styles.composer, { backgroundColor: tokens.glassStrong, borderColor: tokens.glassLine }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={ticket ? `Message ${ticket.with}` : "Ask about cars, payments or refunds"}
            placeholderTextColor={tokens.label}
            accessibilityLabel={ticket ? `Message ${ticket.with}` : "Message the assistant"}
            multiline
            maxLength={1000}
            style={[styles.input, { color: tokens.ink }]}
          />
          <Pressable
            onPress={sendText}
            disabled={sending || !text.trim()}
            accessibilityRole="button"
            accessibilityLabel="Send"
            accessibilityState={{ disabled: sending || !text.trim() }}
            style={[styles.send, { backgroundColor: tokens.brand, opacity: sending || !text.trim() ? 0.4 : 1 }]}
          >
            <Ionicons name="arrow-up" size={20} color={tokens.onBrand} />
          </Pressable>
        </View>
        <AppText variant="micro" align="center">
          The assistant can&apos;t book, pay or cancel for you.
        </AppText>
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ text, staff = false }: { text?: string; staff?: boolean }) {
  const { tokens } = useTheme();
  if (!text) return null;
  return (
    <View
      style={[
        styles.bubble,
        {
          backgroundColor: staff ? tokens.infoBg : tokens.glassStrong,
          borderColor: staff ? "transparent" : tokens.glassLine,
        },
      ]}
    >
      <AppText variant="body" color="ink" selectable>
        {text}
      </AppText>
    </View>
  );
}

function AssistantMessage({
  message,
  latest,
  sending,
  onAction,
  onLink,
}: {
  message: ChatMessage;
  latest: boolean;
  sending: boolean;
  onAction: (action: ChatAction, label: string) => void;
  onLink: (href: string) => void;
}) {
  const kind = message.kind || "text";
  return (
    <View style={styles.assistantRow}>
      {kind === "options" ? <Options message={message} interactive={latest} disabled={sending} onAction={onAction} /> : null}
      {kind === "cars" ? (
        <>
          <Bubble text={message.intro || message.text} />
          <Chips message={message} interactive={latest} disabled={sending} onAction={onAction} />
          {(message.cars ?? []).map((car) => (
            <CarRow key={car.id} car={car} onPress={() => onLink(car.href)} />
          ))}
          {message.resultsHref ? (
            <Button
              label={message.total && message.cars && message.total > message.cars.length ? `See all ${message.total} cars` : "Open in the car list"}
              variant="text"
              size="sm"
              icon="arrow-forward"
              iconPosition="end"
              style={styles.alignStart}
              onPress={() => onLink(message.resultsHref!)}
            />
          ) : null}
        </>
      ) : null}
      {kind === "bookings" ? (
        <>
          <Bubble text={message.intro} />
          {(message.bookings ?? []).map((b) => (
            <BookingCard key={b.code} booking={b} onLink={onLink} />
          ))}
        </>
      ) : null}
      {kind === "text" ? <Bubble text={message.text} /> : null}

      {message.links?.length ? (
        <View style={styles.wrapRow}>
          {message.links.map((l) => (
            <Button key={l.href} label={l.label} variant="text" size="sm" onPress={() => onLink(l.href)} />
          ))}
        </View>
      ) : null}

      {latest && message.actions?.length ? (
        <View style={styles.wrapRow}>
          {message.actions.map((a) => (
            <Pill
              key={a.key}
              label={a.label}
              disabled={sending}
              onPress={() => onAction(a.action || { type: "quick", key: a.key }, a.label)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Pill({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { tokens } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: tokens.glass, borderColor: tokens.glassLine, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 },
      ]}
    >
      <AppText variant="label" color="ink">
        {label}
      </AppText>
    </Pressable>
  );
}

/** A guided step: a question with buttons; answered steps just say so. */
function Options({
  message,
  interactive,
  disabled,
  onAction,
}: {
  message: ChatMessage;
  interactive: boolean;
  disabled: boolean;
  onAction: (action: ChatAction, label: string) => void;
}) {
  const type = message.optionType || "guided";
  return (
    <>
      <Bubble text={message.intro} />
      <GlassCard padding={12}>
        <View style={styles.stepHead}>
          <AppText variant="bodyStrong" style={styles.flex}>
            {message.text}
          </AppText>
          {message.stepLabel ? <AppText variant="micro">{message.stepLabel}</AppText> : null}
        </View>
        {interactive ? (
          <>
            <View style={[styles.wrapRow, styles.mt8]}>
              {(message.options ?? []).map((o) => (
                <Pill
                  key={o.value}
                  label={o.label}
                  disabled={disabled}
                  onPress={() => onAction({ type, value: o.value } as ChatAction, o.label)}
                />
              ))}
            </View>
            {message.allowCustomDates ? <CustomDates disabled={disabled} onAction={onAction} /> : null}
            {message.note ? (
              <AppText variant="caption" style={styles.mt8}>
                {message.note}
              </AppText>
            ) : null}
          </>
        ) : (
          <AppText variant="caption" style={styles.mt4}>
            Answered
          </AppText>
        )}
      </GlassCard>
    </>
  );
}

/** Pick-up and return days for the guided search, with the phone's date picker. */
function CustomDates({ disabled, onAction }: { disabled: boolean; onAction: (action: ChatAction, label: string) => void }) {
  const { scheme } = useTheme();
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [picking, setPicking] = useState<"from" | "to" | null>(null);
  const today = dayOf(new Date());
  const valid = !!from && !!to && from >= today && to > from;

  const onPicked = (event: DateTimePickerEvent, selected?: Date) => {
    const target = picking;
    if (Platform.OS === "android") setPicking(null);
    if (event.type === "dismissed" || !selected || !target) return;
    const day = dayOf(selected);
    if (target === "from") {
      setFrom(day);
      if (!to || to <= day) setTo(null);
    } else {
      setTo(day);
    }
  };

  const base = (value: string | null) => {
    if (!value) return new Date();
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d, 12);
  };

  return (
    <View style={styles.mt8}>
      <AppText variant="caption">Or choose your own days</AppText>
      <View style={[styles.wrapRow, styles.mt4]}>
        <Pill label={from ? `Pick-up ${dayLabel(from)}` : "Pick-up day"} disabled={disabled} onPress={() => setPicking("from")} />
        <Pill label={to ? `Return ${dayLabel(to)}` : "Return day"} disabled={disabled || !from} onPress={() => setPicking("to")} />
      </View>
      {picking ? (
        <DateTimePicker
          value={picking === "from" ? base(from) : base(to ?? from)}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          themeVariant={scheme}
          minimumDate={picking === "from" ? new Date() : base(from)}
          onChange={onPicked}
        />
      ) : null}
      {Platform.OS === "ios" && picking ? (
        <Button label="Done" variant="text" size="sm" style={styles.alignStart} onPress={() => setPicking(null)} />
      ) : null}
      <Button
        label="Use these dates"
        variant="line"
        size="sm"
        style={[styles.mt8, styles.alignStart]}
        disabled={disabled || !valid}
        onPress={() => onAction({ type: "guided", value: `custom:${from}:${to}` }, `${dayLabel(from!)} to ${dayLabel(to!)}`)}
      />
    </View>
  );
}

/** A search's filters. On the latest AI search each one can be removed to search again. */
function Chips({
  message,
  interactive,
  disabled,
  onAction,
}: {
  message: ChatMessage;
  interactive: boolean;
  disabled: boolean;
  onAction: (action: ChatAction, label: string) => void;
}) {
  const { tokens } = useTheme();
  if (!message.chips?.length) return null;
  const editable = message.chipsEditable && interactive;
  return (
    <View style={styles.wrapRow} accessibilityLabel="Searched with">
      {message.chips.map((c) => {
        const label = typeof c === "string" ? c : c.label;
        if (!editable || typeof c === "string") {
          return (
            <View key={label} style={[styles.chip, { backgroundColor: tokens.glass, borderColor: tokens.glassLine }]}>
              <AppText variant="micro" color="ink">
                {label}
              </AppText>
            </View>
          );
        }
        return (
          <Pressable
            key={c.key}
            disabled={disabled}
            onPress={() => onAction({ type: "chip", key: c.key }, `Remove: ${label}`)}
            accessibilityRole="button"
            accessibilityLabel={`Search again without ${label}`}
            style={[styles.chip, { backgroundColor: tokens.glass, borderColor: tokens.glassLine }]}
          >
            <AppText variant="micro" color="ink">
              {label}
            </AppText>
            <Ionicons name="close" size={12} color={tokens.ink} />
          </Pressable>
        );
      })}
    </View>
  );
}

function CarRow({ car, onPress }: { car: ChatCar; onPress: () => void }) {
  const { tokens } = useTheme();
  const meta = [car.operator, car.seats ? `${car.seats} seats` : null, car.city].filter(Boolean).join(" · ");
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${car.name}. ${meta}`} style={({ pressed }) => [pressed && { opacity: 0.8 }]}>
      <GlassCard padding={8}>
        <View style={styles.carRow}>
          <View style={[styles.carPhoto, { backgroundColor: tokens.glassStrong }]}>
            {car.imageUrl ? (
              <Image source={{ uri: car.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
            ) : (
              <Ionicons name="car-sport-outline" size={24} color={tokens.label} />
            )}
          </View>
          <View style={styles.flex}>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {car.name}
            </AppText>
            {meta ? (
              <AppText variant="caption" numberOfLines={1}>
                {meta}
              </AppText>
            ) : null}
            {car.totalSen !== null && car.totalSen !== undefined ? (
              <View style={styles.priceRow}>
                <Money sen={car.totalSen} variant="label" color="ink" />
                <AppText variant="caption"> total · </AppText>
                <Money sen={car.depositSen} variant="caption" />
                <AppText variant="caption"> deposit</AppText>
              </View>
            ) : (
              <View style={styles.priceRow}>
                <Money sen={car.dailySen} variant="label" color="ink" />
                <AppText variant="caption"> a day</AppText>
              </View>
            )}
          </View>
          <Ionicons name="chevron-forward" size={18} color={tokens.label} />
        </View>
      </GlassCard>
    </Pressable>
  );
}

const FACT_TONE: Record<string, "ok" | "warn"> = { ok: "ok", warn: "warn" };

function BookingCard({ booking, onLink }: { booking: ChatBooking; onLink: (href: string) => void }) {
  return (
    <GlassCard padding={12}>
      <View style={styles.stepHead}>
        <AppText variant="bodyStrong" style={styles.flex} numberOfLines={2}>
          {booking.code} · {booking.car}
        </AppText>
        <StatusPill label={booking.status} tone="neutral" />
      </View>
      {booking.dates || booking.operator ? (
        <AppText variant="caption" style={styles.mt4}>
          {[booking.dates, booking.operator].filter(Boolean).join(" · ")}
        </AppText>
      ) : null}
      {booking.facts?.length ? (
        <View style={[styles.facts, styles.mt8]}>
          {booking.facts.map((f) => (
            <View key={`${f.label}-${f.detail}`} style={styles.fact}>
              <StatusPill label={f.label} tone={FACT_TONE[String(f.tone || "").toLowerCase()] ?? "neutral"} dot={false} />
              <AppText variant="caption" style={styles.flex}>
                {f.detail}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
      {booking.actions?.length ? (
        <View style={[styles.wrapRow, styles.mt8]}>
          {booking.actions.map((a) => (
            <Button key={a.href + a.label} label={a.label} variant={a.primary ? "cta" : "line"} size="sm" onPress={() => onLink(a.href)} />
          ))}
        </View>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  pad: {
    paddingHorizontal: 18,
  },
  flex: {
    flex: 1,
  },
  mt4: {
    marginTop: 4,
  },
  mt8: {
    marginTop: 8,
  },
  alignStart: {
    alignSelf: "flex-start",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 10,
  },
  messages: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    gap: 12,
  },
  userRow: {
    alignItems: "flex-end",
  },
  userBubble: {
    maxWidth: "85%",
    borderRadius: 20,
    borderBottomRightRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  assistantRow: {
    alignItems: "stretch",
    gap: 8,
  },
  bubble: {
    alignSelf: "flex-start",
    maxWidth: "92%",
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  typing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  staffFrom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  wrapRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    height: 28,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  stepHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  carRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  carPhoto: {
    width: 72,
    height: 54,
    borderRadius: Radius.sm,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "wrap",
    marginTop: 2,
  },
  facts: {
    gap: 6,
  },
  fact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  note: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    padding: 12,
    borderRadius: Radius.sm,
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 8,
    gap: 8,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 15,
    maxHeight: 120,
    paddingVertical: 8,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
