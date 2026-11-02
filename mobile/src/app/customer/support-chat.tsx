import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMemo, useState } from "react";

type Message = {
  id: number;
  sender: "user" | "support";
  text: string;
};

const quickQuestions = [
  "How do I make a payment?",
  "Why is my payment pending?",
  "How do I upload a receipt?",
  "Where can I view my invoice?",
];

function getSupportReply(message: string) {
  const value = message.toLowerCase();

  if (
    value.includes("pay") ||
    value.includes("payment")
  ) {
    if (
      value.includes("pending") ||
      value.includes("verification")
    ) {
      return "Your payment may be waiting for operator verification. If you uploaded a manual payment receipt, the status will update after the operator reviews it.";
    }

    return "After your booking is accepted, you can make payment from Booking Detail or the Payments page. The available payment type depends on your current booking payment status.";
  }

  if (
    value.includes("receipt") ||
    value.includes("upload")
  ) {
    return "You can upload a manual payment receipt from the payment flow when manual payment is available. After submission, the receipt will remain pending until the operator verifies it.";
  }

  if (
    value.includes("invoice")
  ) {
    return "You can view your invoice from Booking Detail or the Payments page when an invoice has been generated for your booking.";
  }

  if (
    value.includes("booking") &&
    value.includes("reject")
  ) {
    return "If your booking is rejected by the operator, the booking status will be updated and you will not be required to make payment for that booking.";
  }

  if (
    value.includes("booking") &&
    (
      value.includes("accept") ||
      value.includes("pending")
    )
  ) {
    return "New bookings remain pending until the operator reviews them. Once accepted, the booking status will update and payment options will become available.";
  }

  if (
    value.includes("password")
  ) {
    return "You can change your password from Profile > Change Password.";
  }

  if (
    value.includes("profile") ||
    value.includes("phone") ||
    value.includes("name")
  ) {
    return "You can update your name, phone number, and profile picture from Profile > Edit Profile.";
  }

  return "I could not find an exact answer for that question. Please try asking about bookings, payments, receipts, invoices, or your account.";
}

export default function SupportChatScreen() {
  const router = useRouter();

  const [input, setInput] =
    useState("");

  const [messages, setMessages] =
    useState<Message[]>([
      {
        id: 1,
        sender: "support",
        text: "Hi! I am BNPL Support. How can I help you today?",
      },
    ]);

  const nextId = useMemo(
    () =>
      messages.length === 0
        ? 1
        : Math.max(
            ...messages.map(
              (message) =>
                message.id
            )
          ) + 1,
    [messages]
  );

  const sendMessage = (
    customMessage?: string
  ) => {
    const text =
      (
        customMessage ??
        input
      ).trim();

    if (!text) {
      return;
    }

    const userMessage: Message = {
      id: nextId,
      sender: "user",
      text,
    };

    const supportMessage: Message = {
      id: nextId + 1,
      sender: "support",
      text:
        getSupportReply(
          text
        ),
    };

    setMessages(
      (current) => [
        ...current,
        userMessage,
        supportMessage,
      ]
    );

    setInput("");
  };

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
    >
      <KeyboardAvoidingView
        style={{
          flex: 1,
        }}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        <View
          style={
            styles.topBar
          }
        >
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed && {
                opacity: 0.65,
              },
            ]}
            onPress={() =>
              router.back()
            }
          >
            <Ionicons
              name="chevron-back"
              size={22}
              color="#17313C"
            />
          </Pressable>

          <View
            style={{
              flex: 1,
            }}
          >
            <Text
              style={
                styles.topBarTitle
              }
            >
              BNPL Support
            </Text>

            <View
              style={
                styles.statusRow
              }
            >
              <View
                style={
                  styles.statusDot
                }
              />

              <Text
                style={
                  styles.statusText
                }
              >
                Automated Support
              </Text>
            </View>
          </View>
        </View>

        <ScrollView
          style={
            styles.messages
          }
          contentContainerStyle={
            styles.messagesContent
          }
          showsVerticalScrollIndicator={
            false
          }
        >
          <View
            style={
              styles.welcomeCard
            }
          >
            <View
              style={
                styles.welcomeIcon
              }
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={22}
                color="#07869B"
              />
            </View>

            <View
              style={{
                flex: 1,
              }}
            >
              <Text
                style={
                  styles.welcomeTitle
                }
              >
                Support Assistant
              </Text>

              <Text
                style={
                  styles.welcomeText
                }
              >
                Ask questions about bookings, payments, receipts, invoices, and account settings.
              </Text>
            </View>
          </View>

          <Text
            style={
              styles.quickTitle
            }
          >
            Quick Questions
          </Text>

          <View
            style={
              styles.quickContainer
            }
          >
            {quickQuestions.map(
              (question) => (
                <Pressable
                  key={
                    question
                  }
                  style={({ pressed }) => [
                    styles.quickButton,
                    pressed && {
                      opacity:
                        0.7,
                    },
                  ]}
                  onPress={() =>
                    sendMessage(
                      question
                    )
                  }
                >
                  <Text
                    style={
                      styles.quickButtonText
                    }
                  >
                    {
                      question
                    }
                  </Text>
                </Pressable>
              )
            )}
          </View>

          <View
            style={
              styles.chatArea
            }
          >
            {messages.map(
              (message) => {
                const isUser =
                  message.sender ===
                  "user";

                return (
                  <View
                    key={
                      message.id
                    }
                    style={[
                      styles.messageRow,

                      isUser
                        ? styles.userRow
                        : styles.supportRow,
                    ]}
                  >
                    {!isUser ? (
                      <View
                        style={
                          styles.supportAvatar
                        }
                      >
                        <Ionicons
                          name="headset-outline"
                          size={16}
                          color="#07869B"
                        />
                      </View>
                    ) : null}

                    <View
                      style={[
                        styles.messageBubble,

                        isUser
                          ? styles.userBubble
                          : styles.supportBubble,
                      ]}
                    >
                      <Text
                        style={[
                          styles.messageText,

                          isUser &&
                            styles.userMessageText,
                        ]}
                      >
                        {
                          message.text
                        }
                      </Text>
                    </View>
                  </View>
                );
              }
            )}
          </View>
        </ScrollView>

        <View
          style={
            styles.inputArea
          }
        >
          <View
            style={
              styles.inputContainer
            }
          >
            <TextInput
              value={input}
              onChangeText={
                setInput
              }
              placeholder="Type your message..."
              placeholderTextColor="#9BA8AD"
              style={
                styles.input
              }
              multiline
              maxLength={500}
              returnKeyType="send"
            />

            <Pressable
              style={({ pressed }) => [
                styles.sendButton,

                !input.trim() &&
                  styles.sendButtonDisabled,

                pressed &&
                  input.trim() && {
                    opacity:
                      0.75,
                  },
              ]}
              disabled={
                !input.trim()
              }
              onPress={() =>
                sendMessage()
              }
            >
              <Ionicons
                name="send"
                size={18}
                color="#FFFFFF"
              />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        "#F5F8F9",
    },

    topBar: {
      minHeight: 64,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 18,
      backgroundColor:
        "#FFFFFF",
      borderBottomWidth: 1,
      borderBottomColor:
        "#E4EBED",
    },

    backButton: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor:
        "#F2F6F7",
      alignItems: "center",
      justifyContent:
        "center",
    },

    topBarTitle: {
      color: "#17313C",
      fontSize: 14,
      fontWeight: "900",
    },

    statusRow: {
      marginTop: 3,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },

    statusDot: {
      width: 7,
      height: 7,
      borderRadius: 10,
      backgroundColor:
        "#37B76C",
    },

    statusText: {
      color: "#83949B",
      fontSize: 8,
      fontWeight: "700",
    },

    messages: {
      flex: 1,
    },

    messagesContent: {
      padding: 16,
      paddingBottom: 26,
    },

    welcomeCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: 17,
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#E1E8EB",
      marginBottom: 18,
    },

    welcomeIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        "#EAF8FA",
    },

    welcomeTitle: {
      color: "#17313C",
      fontSize: 11,
      fontWeight: "900",
    },

    welcomeText: {
      marginTop: 4,
      color: "#82949C",
      fontSize: 8,
      lineHeight: 13,
    },

    quickTitle: {
      color: "#17313C",
      fontSize: 10,
      fontWeight: "900",
      marginBottom: 9,
    },

    quickContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 7,
      marginBottom: 20,
    },

    quickButton: {
      paddingHorizontal: 11,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor:
        "#EAF8FA",
      borderWidth: 1,
      borderColor:
        "#D7EEF1",
    },

    quickButtonText: {
      color: "#07869B",
      fontSize: 8,
      fontWeight: "800",
    },

    chatArea: {
      gap: 12,
    },

    messageRow: {
      flexDirection: "row",
      alignItems:
        "flex-end",
      gap: 8,
    },

    userRow: {
      justifyContent:
        "flex-end",
    },

    supportRow: {
      justifyContent:
        "flex-start",
    },

    supportAvatar: {
      width: 30,
      height: 30,
      borderRadius: 10,
      backgroundColor:
        "#EAF8FA",
      alignItems: "center",
      justifyContent:
        "center",
    },

    messageBubble: {
      maxWidth: "78%",
      paddingHorizontal: 13,
      paddingVertical: 10,
      borderRadius: 16,
    },

    supportBubble: {
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#E1E8EB",
      borderBottomLeftRadius: 5,
    },

    userBubble: {
      backgroundColor:
        "#07869B",
      borderBottomRightRadius: 5,
    },

    messageText: {
      color: "#4F646D",
      fontSize: 9,
      lineHeight: 15,
    },

    userMessageText: {
      color: "#FFFFFF",
    },

    inputArea: {
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom:
        Platform.OS ===
        "ios"
          ? 12
          : 10,
      backgroundColor:
        "#FFFFFF",
      borderTopWidth: 1,
      borderTopColor:
        "#E4EBED",
    },

    inputContainer: {
      minHeight: 50,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingLeft: 14,
      paddingRight: 6,
      borderRadius: 17,
      backgroundColor:
        "#F4F7F8",
      borderWidth: 1,
      borderColor:
        "#E0E7E9",
    },

    input: {
      flex: 1,
      maxHeight: 100,
      color: "#17313C",
      fontSize: 10,
      paddingVertical: 10,
    },

    sendButton: {
      width: 39,
      height: 39,
      borderRadius: 13,
      backgroundColor:
        "#07869B",
      alignItems: "center",
      justifyContent:
        "center",
    },

    sendButtonDisabled: {
      opacity: 0.4,
    },
  });