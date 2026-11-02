import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";

import {
  ActivityIndicator,
  Alert,
  Image,
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

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getManualPaymentOptions,
  uploadCustomerReceipt,
  type ManualPaymentMethod,
  type ManualPaymentType,
} from "../../services/customerApi";

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

function formatMoney(value?: number) {
  return `RM ${Number(
    value || 0
  ).toFixed(2)}`;
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  const parsed =
    new Date(value);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return "-";
  }

  return parsed.toLocaleDateString(
    "en-MY",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

function getPaymentLabel(
  type?: ManualPaymentType
) {
  if (
    type ===
    "DOWN_PAYMENT"
  ) {
    return "Down Payment";
  }

  if (
    type ===
    "FINAL_PAYMENT"
  ) {
    return "Final Payment";
  }

  return "Full Payment";
}

export default function UploadReceiptScreen() {
  const router =
    useRouter();

  const params =
    useLocalSearchParams<{
      bookingId?: string;
      paymentType?: string;
    }>();

  const bookingId =
    params.bookingId;

  const requestedPaymentType =
    params.paymentType as
      | ManualPaymentType
      | undefined;

  const [due, setDue] =
    useState<ManualPaymentResponse | null>(
      null
    );

  const [
    paymentType,
    setPaymentType,
  ] =
    useState<ManualPaymentType | null>(
      requestedPaymentType ||
        null
    );

  const [
    paymentMethod,
    setPaymentMethod,
  ] =
    useState<ManualPaymentMethod>(
      "DUITNOW"
    );

  const [
    receiptImage,
    setReceiptImage,
  ] = useState("");

  const [
    remarks,
    setRemarks,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    if (!bookingId) {
      setError(
        "Booking ID is missing."
      );

      setLoading(false);
      return;
    }

    let cancelled =
      false;

    async function loadPaymentOptions() {
      try {
        setLoading(true);
        setError("");

        const response =
          await getManualPaymentOptions(
            bookingId
          );

        if (
          cancelled
        ) {
          return;
        }

        setDue(
          response
        );

        const available =
          (
            response?.options ||
            []
          ).filter(
            (
              item: PaymentOption
            ) =>
              item.available
          );

        const requested =
          available.find(
            (
              item: PaymentOption
            ) =>
              item.paymentType ===
              requestedPaymentType
          );

        if (
          requested
        ) {
          setPaymentType(
            requested.paymentType
          );

          return;
        }

        const defaultOption =
          available.find(
            (
              item: PaymentOption
            ) =>
              item.paymentType ===
              response
                ?.defaultPaymentType
          );

        if (
          defaultOption
        ) {
          setPaymentType(
            defaultOption.paymentType
          );

          return;
        }

        if (
          available.length >
          0
        ) {
          setPaymentType(
            available[0]
              .paymentType
          );
        }
      } catch (
        err: any
      ) {
        console.log(
          "Failed to load manual payment:",
          err
        );

        if (
          !cancelled
        ) {
          setError(
            err?.message ||
              "Could not load the amount to pay."
          );
        }
      } finally {
        if (
          !cancelled
        ) {
          setLoading(
            false
          );
        }
      }
    }

    loadPaymentOptions();

    return () => {
      cancelled =
        true;
    };
  }, [
    bookingId,
    requestedPaymentType,
  ]);

  const availableOptions =
    useMemo(
      () =>
        (
          due?.options ||
          []
        ).filter(
          (item) =>
            item.available
        ),
      [due]
    );

  const selectedOption =
    useMemo(
      () =>
        availableOptions.find(
          (item) =>
            item.paymentType ===
            paymentType
        ) || null,
      [
        availableOptions,
        paymentType,
      ]
    );

  async function selectReceiptImage() {
    try {
      setError("");

      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (
        !permission.granted
      ) {
        Alert.alert(
          "Permission Required",
          "Please allow photo library access to upload your payment receipt."
        );

        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync(
          {
            mediaTypes:
              ["images"],

            allowsEditing:
              true,

            quality:
              0.65,

            base64:
              true,
          }
        );

      if (
        result.canceled
      ) {
        return;
      }

      const asset =
        result.assets?.[0];

      if (
        !asset
      ) {
        return;
      }

      if (
        !asset.base64
      ) {
        setError(
          "Unable to process this image. Please select another receipt image."
        );

        return;
      }

      const mimeType =
        asset.mimeType ||
        "image/jpeg";

      const dataUrl =
        `data:${mimeType};base64,${asset.base64}`;

      setReceiptImage(
        dataUrl
      );
    } catch (
      err: any
    ) {
      console.log(
        "Receipt image picker failed:",
        err
      );

      setError(
        err?.message ||
          "Failed to select receipt image."
      );
    }
  }

  async function submitReceipt() {
    if (
      !bookingId
    ) {
      return;
    }

    if (
      !paymentType ||
      !selectedOption
    ) {
      setError(
        "There is nothing to pay by receipt for this booking right now."
      );

      return;
    }

    if (
      !receiptImage
    ) {
      setError(
        "Please upload a receipt image before submitting."
      );

      return;
    }

    try {
      setSubmitting(
        true
      );

      setError("");

      await uploadCustomerReceipt(
        bookingId,
        {
          imageUrl:
            receiptImage,

          remarks:
            remarks.trim(),

          method:
            paymentMethod,

          paymentType,
        }
      );

      Alert.alert(
        "Receipt Submitted",
        "Your payment receipt has been submitted and is waiting for operator verification.",
        [
          {
            text: "View Booking",
            onPress: () => {
              router.dismissAll();

              router.replace({
                pathname:
                  "/customer/booking/[id]",
                params: {
                  id: String(
                    bookingId
                  ),
                },
              });
            },
          },
        ]
      );
    } catch (
      err: any
    ) {
      console.log(
        "Receipt upload failed:",
        err
      );

      setError(
        err?.message ||
          "Failed to upload receipt."
      );
    } finally {
      setSubmitting(
        false
      );
    }
  }

  if (
    loading
  ) {
    return (
      <SafeAreaView
        style={
          styles.safeArea
        }
      >
        <View
          style={
            styles.center
          }
        >
          <ActivityIndicator
            size="large"
            color="#07869B"
          />

          <Text
            style={
              styles.loadingText
            }
          >
            Loading payment details...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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
          Platform.OS ===
          "ios"
            ? "padding"
            : undefined
        }
      >
        <View
          style={
            styles.header
          }
        >
          <Pressable
            style={
              styles.backButton
            }
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
                styles.headerTitle
              }
            >
              Upload Receipt
            </Text>

            <Text
              style={
                styles.headerSubtitle
              }
            >
              Manual payment verification
            </Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={
            false
          }
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={
            styles.content
          }
        >
          {/* INTRO */}
          <View
            style={
              styles.heroCard
            }
          >
            <View
              style={
                styles.heroIcon
              }
            >
              <Ionicons
                name="receipt-outline"
                size={26}
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
                  styles.heroTitle
                }
              >
                Manual Payment
              </Text>

              <Text
                style={
                  styles.heroText
                }
              >
                Complete your DuitNow or
                SPay payment, then upload
                the payment receipt for
                operator verification.
              </Text>
            </View>
          </View>

          {error ? (
            <View
              style={
                styles.errorBox
              }
            >
              <Ionicons
                name="alert-circle-outline"
                size={18}
                color="#C84242"
              />

              <Text
                style={
                  styles.errorText
                }
              >
                {error}
              </Text>
            </View>
          ) : null}

          {selectedOption ? (
            <>
              {/* PAYMENT DETAILS */}
              <View
                style={
                  styles.card
                }
              >
                <Text
                  style={
                    styles.sectionEyebrow
                  }
                >
                  PAYMENT DETAILS
                </Text>

                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  Amount to Pay
                </Text>

                <Text
                  style={
                    styles.amount
                  }
                >
                  {formatMoney(
                    selectedOption.amount
                  )}
                </Text>

                <View
                  style={
                    styles.summaryBox
                  }
                >
                  <InfoRow
                    label="Payment"
                    value={
                      selectedOption.label ||
                      getPaymentLabel(
                        selectedOption.paymentType
                      )
                    }
                  />

                  <InfoRow
                    label="Reference"
                    value={
                      due?.reference ||
                      "-"
                    }
                  />

                  <InfoRow
                    label="Pay by"
                    value={formatDate(
                      selectedOption.dueDate
                    )}
                  />
                </View>

                <View
                  style={
                    styles.noticeBox
                  }
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={18}
                    color="#07869B"
                  />

                  <Text
                    style={
                      styles.noticeText
                    }
                  >
                    Pay exactly{" "}
                    {formatMoney(
                      selectedOption.amount
                    )}{" "}
                    and include{" "}
                    {due?.reference ||
                      "the booking reference"}{" "}
                    in your payment
                    remarks.
                    {due?.note
                      ? ` ${due.note}`
                      : ""}
                  </Text>
                </View>

                {selectedOption.replacesPendingReceipt ? (
                  <View
                    style={
                      styles.warningBox
                    }
                  >
                    <Ionicons
                      name="warning-outline"
                      size={18}
                      color="#A76A00"
                    />

                    <Text
                      style={
                        styles.warningText
                      }
                    >
                      A receipt for this
                      payment is already
                      waiting for
                      verification.
                      Uploading a new one
                      will replace it.
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* PAYMENT TYPE */}
              {availableOptions.length >
              1 ? (
                <View
                  style={
                    styles.card
                  }
                >
                  <Text
                    style={
                      styles.sectionTitle
                    }
                  >
                    What are you paying?
                  </Text>

                  <View
                    style={
                      styles.optionGroup
                    }
                  >
                    {availableOptions.map(
                      (
                        option
                      ) => {
                        const selected =
                          option.paymentType ===
                          paymentType;

                        return (
                          <Pressable
                            key={
                              option.paymentType
                            }
                            style={[
                              styles.optionCard,

                              selected &&
                                styles.optionCardSelected,
                            ]}
                            onPress={() =>
                              setPaymentType(
                                option.paymentType
                              )
                            }
                          >
                            <View
                              style={[
                                styles.radioOuter,

                                selected &&
                                  styles.radioOuterSelected,
                              ]}
                            >
                              {selected ? (
                                <View
                                  style={
                                    styles.radioInner
                                  }
                                />
                              ) : null}
                            </View>

                            <View
                              style={{
                                flex: 1,
                              }}
                            >
                              <Text
                                style={
                                  styles.optionTitle
                                }
                              >
                                {option.label ||
                                  getPaymentLabel(
                                    option.paymentType
                                  )}
                              </Text>

                              <Text
                                style={
                                  styles.optionAmount
                                }
                              >
                                {formatMoney(
                                  option.amount
                                )}
                              </Text>
                            </View>
                          </Pressable>
                        );
                      }
                    )}
                  </View>
                </View>
              ) : null}

              {/* PAYMENT METHOD */}
              <View
                style={
                  styles.card
                }
              >
                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  Payment Method
                </Text>

                <View
                  style={
                    styles.methodRow
                  }
                >
                  <PaymentMethodButton
                    label="DuitNow"
                    icon="qr-code-outline"
                    selected={
                      paymentMethod ===
                      "DUITNOW"
                    }
                    onPress={() =>
                      setPaymentMethod(
                        "DUITNOW"
                      )
                    }
                  />

                  <PaymentMethodButton
                    label="SPay"
                    icon="wallet-outline"
                    selected={
                      paymentMethod ===
                      "SPAY"
                    }
                    onPress={() =>
                      setPaymentMethod(
                        "SPAY"
                      )
                    }
                  />
                </View>
              </View>

              {/* RECEIPT IMAGE */}
              <View
                style={
                  styles.card
                }
              >
                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  Receipt Image
                </Text>

                <Text
                  style={
                    styles.sectionDescription
                  }
                >
                  Upload a clear screenshot
                  or photo showing the
                  completed payment.
                </Text>

                {receiptImage ? (
                  <View>
                    <Image
                      source={{
                        uri: receiptImage,
                      }}
                      style={
                        styles.preview
                      }
                      resizeMode="contain"
                    />

                    <View
                      style={
                        styles.imageActions
                      }
                    >
                      <Pressable
                        style={
                          styles.changeImageButton
                        }
                        onPress={
                          selectReceiptImage
                        }
                      >
                        <Ionicons
                          name="images-outline"
                          size={17}
                          color="#07869B"
                        />

                        <Text
                          style={
                            styles.changeImageText
                          }
                        >
                          Change Image
                        </Text>
                      </Pressable>

                      <Pressable
                        style={
                          styles.removeImageButton
                        }
                        onPress={() =>
                          setReceiptImage(
                            ""
                          )
                        }
                      >
                        <Ionicons
                          name="trash-outline"
                          size={17}
                          color="#C84242"
                        />

                        <Text
                          style={
                            styles.removeImageText
                          }
                        >
                          Remove
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    style={({ pressed }) => [
                      styles.uploadBox,

                      pressed && {
                        opacity:
                          0.75,
                      },
                    ]}
                    onPress={
                      selectReceiptImage
                    }
                  >
                    <View
                      style={
                        styles.uploadIcon
                      }
                    >
                      <Ionicons
                        name="cloud-upload-outline"
                        size={28}
                        color="#07869B"
                      />
                    </View>

                    <Text
                      style={
                        styles.uploadTitle
                      }
                    >
                      Choose Receipt Image
                    </Text>

                    <Text
                      style={
                        styles.uploadSubtitle
                      }
                    >
                      Select from your
                      photo library
                    </Text>
                  </Pressable>
                )}
              </View>

              {/* REMARKS */}
              <View
                style={
                  styles.card
                }
              >
                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  Remarks
                </Text>

                <Text
                  style={
                    styles.sectionDescription
                  }
                >
                  Optional payment note for
                  the operator.
                </Text>

                <TextInput
                  value={
                    remarks
                  }
                  onChangeText={
                    setRemarks
                  }
                  placeholder="Example: Paid using DuitNow at 8:30 PM"
                  placeholderTextColor="#A2AFB4"
                  multiline
                  maxLength={
                    300
                  }
                  style={
                    styles.textArea
                  }
                />

                <Text
                  style={
                    styles.characterCount
                  }
                >
                  {remarks.length}/300
                </Text>
              </View>

              {/* SUBMIT */}
              <Pressable
                style={({ pressed }) => [
                  styles.submitButton,

                  (
                    pressed ||
                    submitting ||
                    !receiptImage
                  ) && {
                    opacity:
                      0.7,
                  },
                ]}
                disabled={
                  submitting ||
                  !receiptImage
                }
                onPress={
                  submitReceipt
                }
              >
                {submitting ? (
                  <ActivityIndicator
                    color="#FFFFFF"
                  />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={20}
                      color="#FFFFFF"
                    />

                    <Text
                      style={
                        styles.submitText
                      }
                    >
                      Submit Receipt
                    </Text>
                  </>
                )}
              </Pressable>

              <Text
                style={
                  styles.footerNote
                }
              >
                Your payment will remain
                pending until the operator
                verifies the submitted
                receipt.
              </Text>
            </>
          ) : (
            <View
              style={
                styles.emptyCard
              }
            >
              <Ionicons
                name="information-circle-outline"
                size={34}
                color="#82949C"
              />

              <Text
                style={
                  styles.emptyTitle
                }
              >
                No Manual Payment Available
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                There is currently no
                payment available for
                receipt upload.
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View
      style={
        styles.infoRow
      }
    >
      <Text
        style={
          styles.infoLabel
        }
      >
        {label}
      </Text>

      <Text
        style={
          styles.infoValue
        }
      >
        {value}
      </Text>
    </View>
  );
}

function PaymentMethodButton({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon:
    | "qr-code-outline"
    | "wallet-outline";
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.methodButton,

        selected &&
          styles.methodButtonSelected,
      ]}
      onPress={
        onPress
      }
    >
      <View
        style={[
          styles.methodIcon,

          selected &&
            styles.methodIconSelected,
        ]}
      >
        <Ionicons
          name={
            icon
          }
          size={22}
          color={
            selected
              ? "#FFFFFF"
              : "#07869B"
          }
        />
      </View>

      <Text
        style={[
          styles.methodLabel,

          selected &&
            styles.methodLabelSelected,
        ]}
      >
        {label}
      </Text>

      {selected ? (
        <Ionicons
          name="checkmark-circle"
          size={18}
          color="#07869B"
        />
      ) : null}
    </Pressable>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        "#F5F8F9",
    },

    center: {
      flex: 1,
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    loadingText: {
      marginTop: 12,
      color:
        "#748A93",
      fontSize: 12,
      fontWeight:
        "700",
    },

    header: {
      flexDirection:
        "row",
      alignItems:
        "center",
      gap: 12,
      paddingHorizontal:
        18,
      paddingVertical:
        13,
      backgroundColor:
        "#FFFFFF",
      borderBottomWidth:
        1,
      borderBottomColor:
        "#E4EAED",
    },

    backButton: {
      width: 42,
      height: 42,
      borderRadius:
        14,
      alignItems:
        "center",
      justifyContent:
        "center",
      backgroundColor:
        "#F3F7F8",
    },

    headerTitle: {
      color:
        "#17313C",
      fontSize: 17,
      fontWeight:
        "900",
    },

    headerSubtitle: {
      marginTop: 2,
      color:
        "#82949C",
      fontSize: 10,
    },

    content: {
      padding: 18,
      paddingBottom:
        40,
    },

    heroCard: {
      flexDirection:
        "row",
      alignItems:
        "center",
      gap: 13,
      padding: 16,
      borderRadius:
        20,
      backgroundColor:
        "#EAF8FA",
      borderWidth: 1,
      borderColor:
        "#CFECEF",
      marginBottom:
        14,
    },

    heroIcon: {
      width: 48,
      height: 48,
      borderRadius:
        16,
      alignItems:
        "center",
      justifyContent:
        "center",
      backgroundColor:
        "#FFFFFF",
    },

    heroTitle: {
      color:
        "#17313C",
      fontSize: 14,
      fontWeight:
        "900",
    },

    heroText: {
      marginTop: 4,
      color:
        "#64828D",
      fontSize: 10,
      lineHeight: 16,
    },

    errorBox: {
      flexDirection:
        "row",
      gap: 9,
      alignItems:
        "flex-start",
      padding: 13,
      borderRadius:
        14,
      backgroundColor:
        "#FDEEEE",
      marginBottom:
        14,
    },

    errorText: {
      flex: 1,
      color:
        "#A53B3B",
      fontSize: 11,
      lineHeight: 16,
      fontWeight:
        "700",
    },

    card: {
      padding: 17,
      borderRadius:
        20,
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#E1E8EB",
      marginBottom:
        14,
    },

    sectionEyebrow: {
      color:
        "#07869B",
      fontSize: 9,
      fontWeight:
        "900",
      letterSpacing:
        0.8,
    },

    sectionTitle: {
      marginTop: 3,
      color:
        "#17313C",
      fontSize: 14,
      fontWeight:
        "900",
    },

    sectionDescription: {
      marginTop: 5,
      color:
        "#80939B",
      fontSize: 10,
      lineHeight: 15,
    },

    amount: {
      marginTop: 10,
      color:
        "#07869B",
      fontSize: 30,
      fontWeight:
        "900",
    },

    summaryBox: {
      marginTop: 15,
      padding: 13,
      backgroundColor:
        "#F7FAFB",
      borderRadius:
        14,
    },

    infoRow: {
      flexDirection:
        "row",
      alignItems:
        "center",
      justifyContent:
        "space-between",
      gap: 20,
      paddingVertical:
        6,
    },

    infoLabel: {
      color:
        "#81939B",
      fontSize: 10,
    },

    infoValue: {
      flex: 1,
      color:
        "#17313C",
      fontSize: 10,
      fontWeight:
        "900",
      textAlign:
        "right",
    },

    noticeBox: {
      flexDirection:
        "row",
      alignItems:
        "flex-start",
      gap: 9,
      marginTop: 13,
      padding: 12,
      borderRadius:
        13,
      backgroundColor:
        "#EFF9FA",
    },

    noticeText: {
      flex: 1,
      color:
        "#567680",
      fontSize: 10,
      lineHeight: 16,
    },

    warningBox: {
      flexDirection:
        "row",
      alignItems:
        "flex-start",
      gap: 9,
      marginTop: 10,
      padding: 12,
      borderRadius:
        13,
      backgroundColor:
        "#FFF7E8",
    },

    warningText: {
      flex: 1,
      color:
        "#8C620E",
      fontSize: 10,
      lineHeight: 16,
    },

    optionGroup: {
      marginTop: 12,
      gap: 9,
    },

    optionCard: {
      flexDirection:
        "row",
      alignItems:
        "center",
      gap: 12,
      padding: 13,
      borderRadius:
        14,
      borderWidth: 1,
      borderColor:
        "#DFE7EA",
      backgroundColor:
        "#FAFCFC",
    },

    optionCardSelected: {
      borderColor:
        "#07869B",
      backgroundColor:
        "#EFF9FA",
    },

    radioOuter: {
      width: 20,
      height: 20,
      borderRadius:
        10,
      borderWidth: 2,
      borderColor:
        "#B8C5CA",
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    radioOuterSelected: {
      borderColor:
        "#07869B",
    },

    radioInner: {
      width: 10,
      height: 10,
      borderRadius:
        5,
      backgroundColor:
        "#07869B",
    },

    optionTitle: {
      color:
        "#17313C",
      fontSize: 11,
      fontWeight:
        "900",
    },

    optionAmount: {
      marginTop: 3,
      color:
        "#07869B",
      fontSize: 10,
      fontWeight:
        "800",
    },

    methodRow: {
      marginTop: 12,
      gap: 9,
    },

    methodButton: {
      minHeight: 62,
      flexDirection:
        "row",
      alignItems:
        "center",
      gap: 11,
      paddingHorizontal:
        12,
      borderRadius:
        15,
      borderWidth: 1,
      borderColor:
        "#DFE7EA",
      backgroundColor:
        "#FAFCFC",
    },

    methodButtonSelected: {
      borderColor:
        "#07869B",
      backgroundColor:
        "#EFF9FA",
    },

    methodIcon: {
      width: 38,
      height: 38,
      borderRadius:
        12,
      backgroundColor:
        "#EAF8FA",
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    methodIconSelected: {
      backgroundColor:
        "#07869B",
    },

    methodLabel: {
      flex: 1,
      color:
        "#647A83",
      fontSize: 11,
      fontWeight:
        "800",
    },

    methodLabelSelected: {
      color:
        "#17313C",
      fontWeight:
        "900",
    },

    uploadBox: {
      marginTop: 14,
      minHeight: 170,
      borderRadius:
        17,
      borderWidth: 1.5,
      borderStyle:
        "dashed",
      borderColor:
        "#AED3D9",
      backgroundColor:
        "#F5FBFC",
      alignItems:
        "center",
      justifyContent:
        "center",
      padding: 20,
    },

    uploadIcon: {
      width: 54,
      height: 54,
      borderRadius:
        18,
      backgroundColor:
        "#E4F5F7",
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    uploadTitle: {
      marginTop: 12,
      color:
        "#17313C",
      fontSize: 12,
      fontWeight:
        "900",
    },

    uploadSubtitle: {
      marginTop: 4,
      color:
        "#82949C",
      fontSize: 10,
    },

    preview: {
      marginTop: 14,
      width:
        "100%",
      height: 260,
      borderRadius:
        16,
      backgroundColor:
        "#F4F7F8",
    },

    imageActions: {
      flexDirection:
        "row",
      gap: 9,
      marginTop: 10,
    },

    changeImageButton: {
      flex: 1,
      height: 44,
      borderRadius:
        13,
      flexDirection:
        "row",
      alignItems:
        "center",
      justifyContent:
        "center",
      gap: 7,
      backgroundColor:
        "#EAF8FA",
    },

    changeImageText: {
      color:
        "#07869B",
      fontSize: 10,
      fontWeight:
        "900",
    },

    removeImageButton: {
      flex: 1,
      height: 44,
      borderRadius:
        13,
      flexDirection:
        "row",
      alignItems:
        "center",
      justifyContent:
        "center",
      gap: 7,
      backgroundColor:
        "#FDEEEE",
    },

    removeImageText: {
      color:
        "#C84242",
      fontSize: 10,
      fontWeight:
        "900",
    },

    textArea: {
      marginTop: 12,
      minHeight: 110,
      padding: 13,
      borderRadius:
        14,
      borderWidth: 1,
      borderColor:
        "#DCE5E8",
      backgroundColor:
        "#FAFCFC",
      color:
        "#17313C",
      fontSize: 11,
      textAlignVertical:
        "top",
    },

    characterCount: {
      marginTop: 6,
      color:
        "#99A7AC",
      fontSize: 9,
      textAlign:
        "right",
    },

    submitButton: {
      height: 54,
      borderRadius:
        16,
      backgroundColor:
        "#07869B",
      flexDirection:
        "row",
      alignItems:
        "center",
      justifyContent:
        "center",
      gap: 8,
    },

    submitText: {
      color:
        "#FFFFFF",
      fontSize: 12,
      fontWeight:
        "900",
    },

    footerNote: {
      marginTop: 12,
      paddingHorizontal:
        20,
      textAlign:
        "center",
      color:
        "#87989F",
      fontSize: 9,
      lineHeight: 14,
    },

    emptyCard: {
      alignItems:
        "center",
      padding: 28,
      borderRadius:
        20,
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#E1E8EB",
    },

    emptyTitle: {
      marginTop: 12,
      color:
        "#17313C",
      fontSize: 14,
      fontWeight:
        "900",
    },

    emptyText: {
      marginTop: 6,
      color:
        "#81939B",
      fontSize: 10,
      textAlign:
        "center",
      lineHeight: 16,
    },
  });