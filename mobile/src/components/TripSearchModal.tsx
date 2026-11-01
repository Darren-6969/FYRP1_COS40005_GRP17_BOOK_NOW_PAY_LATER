import { Ionicons } from "@expo/vector-icons";
import {
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useEffect, useState } from "react";

import DateTimePicker from "@react-native-community/datetimepicker";

export type TripSearch = {
  city: string;
  from: string;
  fromTime: string;
  to: string;
  toTime: string;
};

type Props = {
  visible: boolean;
  value: TripSearch;
  onClose: () => void;
  onApply: (value: TripSearch) => void;
};

const CITIES = [
  "Kuching",
  "Miri",
  "Sibu",
  "Bintulu",
];

function todayString() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(
    now.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    now.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toDateValue(
  date: string,
  time: string
) {
  const safeDate =
    date || todayString();

  const safeTime =
    time || "10:00";

  return new Date(
    `${safeDate}T${safeTime}:00`
  );
}

function formatDateDisplay(
  value: string
) {
  if (!value) return "Select date";

  return new Date(
    `${value}T12:00:00`
  ).toLocaleDateString(
    "en-MY",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

function formatTimeDisplay(
  value: string
) {
  if (!value) return "Select time";

  const [hour, minute] =
    value.split(":");

  const date = new Date();

  date.setHours(
    Number(hour),
    Number(minute),
    0,
    0
  );

  return date.toLocaleTimeString(
    "en-MY",
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function formatDateValue(
  date: Date
) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatTimeValue(
  date: Date
) {
  const hour =
    String(
      date.getHours()
    ).padStart(2, "0");

  const minute =
    String(
      date.getMinutes()
    ).padStart(2, "0");

  return `${hour}:${minute}`;
}

export default function TripSearchModal({
  visible,
  value,
  onClose,
  onApply,
}: Props) {
  const [draft, setDraft] =
    useState<TripSearch>(value);

  const [error, setError] =
    useState("");

const [showPicker, setShowPicker] =
  useState<
    | "fromDate"
    | "fromTime"
    | "toDate"
    | "toTime"
    | null
  >(null);

  useEffect(() => {
    if (visible) {
      setDraft(value);
      setError("");
    }
  }, [visible, value]);

  const apply = () => {
    const today = todayString();

    if (
      draft.from &&
      draft.from < today
    ) {
      setError(
        "Pick-up date cannot be in the past."
      );
      return;
    }

    if (draft.from && !draft.to) {
      setError(
        "Please select a return date."
      );
      return;
    }

    if (!draft.from && draft.to) {
      setError(
        "Please select a pick-up date."
      );
      return;
    }

    if (
      draft.from &&
      draft.to
    ) {
      const start = new Date(
        `${draft.from}T${
          draft.fromTime || "10:00"
        }`
      );

      const end = new Date(
        `${draft.to}T${
          draft.toTime || "10:00"
        }`
      );

      if (
        end.getTime() <=
        start.getTime()
      ) {
        setError(
          "Return must be after pick-up."
        );
        return;
      }
    }

    onApply(draft);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            style={styles.headerButton}
            onPress={onClose}
          >
            <Ionicons
              name="close"
              size={23}
              color="#17313C"
            />
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={styles.title}>
              Plan Your Trip
            </Text>

            <Text style={styles.subtitle}>
              Choose location and rental period
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>
            Pick-up city
          </Text>

          <View style={styles.cityGrid}>
            {CITIES.map((city) => {
              const selected =
                draft.city === city;

              return (
                <Pressable
                  key={city}
                  style={[
                    styles.cityButton,
                    selected &&
                      styles.cityButtonSelected,
                  ]}
                  onPress={() =>
                    setDraft(
                      (current) => ({
                        ...current,
                        city,
                      })
                    )
                  }
                >
                  <Ionicons
                    name="location-outline"
                    size={18}
                    color={
                      selected
                        ? "#FFFFFF"
                        : "#07869B"
                    }
                  />

                  <Text
                    style={[
                      styles.cityText,
                      selected &&
                        styles.cityTextSelected,
                    ]}
                  >
                    {city}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionTitle}>
            Pick-up
            </Text>

            <Pressable
            style={styles.inputCard}
            onPress={() =>
                setShowPicker("fromDate")
            }
            >
            <View style={styles.inputIcon}>
                <Ionicons
                name="calendar-outline"
                size={20}
                color="#07869B"
                />
            </View>

            <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>
                Pick-up date
                </Text>

                <Text style={styles.inputValue}>
                {formatDateDisplay(
                    draft.from
                )}
                </Text>
            </View>

            <Ionicons
                name="chevron-forward"
                size={18}
                color="#9AABB2"
            />
            </Pressable>

            <Pressable
            style={styles.inputCard}
            onPress={() =>
                setShowPicker("fromTime")
            }
            >
            <View style={styles.inputIcon}>
                <Ionicons
                name="time-outline"
                size={20}
                color="#07869B"
                />
            </View>

            <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>
                Pick-up time
                </Text>

                <Text style={styles.inputValue}>
                {formatTimeDisplay(
                    draft.fromTime
                )}
                </Text>
            </View>

            <Ionicons
                name="chevron-forward"
                size={18}
                color="#9AABB2"
            />
            </Pressable>

            <Text style={styles.sectionTitle}>
            Return
            </Text>

            <Pressable
            style={styles.inputCard}
            onPress={() =>
                setShowPicker("toDate")
            }
            >
            <View style={styles.inputIcon}>
                <Ionicons
                name="calendar-outline"
                size={20}
                color="#07869B"
                />
            </View>

            <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>
                Return date
                </Text>

                <Text style={styles.inputValue}>
                {formatDateDisplay(
                    draft.to
                )}
                </Text>
            </View>

            <Ionicons
                name="chevron-forward"
                size={18}
                color="#9AABB2"
            />
            </Pressable>

            <Pressable
            style={styles.inputCard}
            onPress={() =>
                setShowPicker("toTime")
            }
            >
            <View style={styles.inputIcon}>
                <Ionicons
                name="time-outline"
                size={20}
                color="#07869B"
                />
            </View>

            <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>
                Return time
                </Text>

                <Text style={styles.inputValue}>
                {formatTimeDisplay(
                    draft.toTime
                )}
                </Text>
            </View>

            <Ionicons
                name="chevron-forward"
                size={18}
                color="#9AABB2"
            />
            </Pressable>

          {error ? (
            <View style={styles.errorCard}>
              <Ionicons
                name="alert-circle-outline"
                size={18}
                color="#C84545"
              />

              <Text style={styles.errorText}>
                {error}
              </Text>
            </View>
          ) : null}

          <View style={styles.infoCard}>
            <Ionicons
              name="information-circle-outline"
              size={20}
              color="#07869B"
            />

            <Text style={styles.infoText}>
              Selecting your rental dates unlocks
              exact deposit calculations and
              amount-payable-now filtering.
            </Text>
          </View>
        </ScrollView>

   {showPicker && (
        <View style={styles.pickerOverlay}>
            <Pressable
            style={styles.pickerBackdrop}
            onPress={() =>
                setShowPicker(null)
            }
            />

            <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
                <Pressable
                onPress={() =>
                    setShowPicker(null)
                }
                >
                <Text style={styles.pickerCancel}>
                    Cancel
                </Text>
                </Pressable>

                <Text style={styles.pickerTitle}>
                {showPicker === "fromDate"
                    ? "Pick-up Date"
                    : showPicker === "fromTime"
                    ? "Pick-up Time"
                    : showPicker === "toDate"
                        ? "Return Date"
                        : "Return Time"}
                </Text>

                <Pressable
                onPress={() =>
                    setShowPicker(null)
                }
                >
                <Text style={styles.pickerDone}>
                    Done
                </Text>
                </Pressable>
            </View>

            <DateTimePicker
                value={
                showPicker === "fromDate" ||
                showPicker === "fromTime"
                    ? toDateValue(
                        draft.from,
                        draft.fromTime
                    )
                    : toDateValue(
                        draft.to,
                        draft.toTime
                    )
                }
                mode={
                showPicker === "fromDate" ||
                showPicker === "toDate"
                    ? "date"
                    : "time"
                }
                display="spinner"
                themeVariant="light"
                textColor="#17313C"
                style={{
                height: 220,
                }}
                minimumDate={
                showPicker === "fromDate"
                    ? new Date()
                    : showPicker === "toDate" &&
                        draft.from
                    ? new Date(
                        `${draft.from}T00:00:00`
                        )
                    : undefined
                }
                onChange={(
                event,
                selectedDate
                ) => {
                if (!selectedDate) {
                    return;
                }

                const pickerType =
                    showPicker;

                if (
                    pickerType === "fromDate"
                ) {
                    const newFrom =
                    formatDateValue(
                        selectedDate
                    );

                    setDraft(
                    (current) => {
                        let nextTo =
                        current.to;

                        if (
                        !nextTo ||
                        nextTo <= newFrom
                        ) {
                        const returnDate =
                            new Date(
                            selectedDate
                            );

                        returnDate.setDate(
                            returnDate.getDate() +
                            1
                        );

                        nextTo =
                            formatDateValue(
                            returnDate
                            );
                        }

                        return {
                        ...current,
                        from: newFrom,
                        to: nextTo,
                        };
                    }
                    );

                    return;
                }

                if (
                    pickerType === "fromTime"
                ) {
                    setDraft(
                    (current) => ({
                        ...current,
                        fromTime:
                        formatTimeValue(
                            selectedDate
                        ),
                    })
                    );

                    return;
                }

                if (
                    pickerType === "toDate"
                ) {
                    setDraft(
                    (current) => ({
                        ...current,
                        to: formatDateValue(
                        selectedDate
                        ),
                    })
                    );

                    return;
                }

                if (
                    pickerType === "toTime"
                ) {
                    setDraft(
                    (current) => ({
                        ...current,
                        toTime:
                        formatTimeValue(
                            selectedDate
                        ),
                    })
                    );
                }
                }}
            />
            </View>
        </View>
        )}

        <View style={styles.footer}>
          <Pressable
            style={styles.clearButton}
            onPress={() =>
              setDraft({
                city: "",
                from: "",
                fromTime: "10:00",
                to: "",
                toTime: "10:00",
              })
            }
          >
            <Text style={styles.clearText}>
              Clear
            </Text>
          </Pressable>

          <Pressable
            style={styles.applyButton}
            onPress={apply}
          >
            <Text style={styles.applyText}>
              Search Cars
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7FAFB",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5ECEF",
  },

  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#F3F7F8",
    justifyContent: "center",
    alignItems: "center",
  },

  title: {
    fontSize: 19,
    fontWeight: "900",
    color: "#17313C",
  },

  subtitle: {
    fontSize: 10,
    color: "#8798A1",
    marginTop: 2,
  },

  content: {
    padding: 18,
    paddingBottom: 120,
  },

  sectionTitle: {
    color: "#17313C",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 10,
    marginBottom: 11,
  },

  cityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 15,
  },

  cityButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE7EA",
  },

  cityButtonSelected: {
    backgroundColor: "#07869B",
    borderColor: "#07869B",
  },

  cityText: {
    color: "#536871",
    fontSize: 11,
    fontWeight: "800",
  },

  cityTextSelected: {
    color: "#FFFFFF",
  },

  inputCard: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#E1E9EC",
    paddingHorizontal: 13,
    marginBottom: 10,
  },

  inputIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#E7F7F9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  inputLabel: {
    color: "#84969E",
    fontSize: 9,
    fontWeight: "700",
  },

  inputValue: {
  color: "#17313C",
  fontSize: 13,
  fontWeight: "800",
  marginTop: 4,
  },

  input: {
    color: "#17313C",
    fontSize: 13,
    fontWeight: "800",
    paddingVertical: 5,
  },

  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    padding: 13,
    borderRadius: 14,
    backgroundColor: "#FDEEEE",
  },

  errorText: {
    flex: 1,
    color: "#C84545",
    fontSize: 11,
  },

  infoCard: {
    flexDirection: "row",
    gap: 10,
    marginTop: 15,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#EAF8FA",
  },

  infoText: {
    flex: 1,
    color: "#52727B",
    fontSize: 10,
    lineHeight: 16,
  },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E4EBEE",
    paddingHorizontal: 18,
    paddingTop: 13,
    paddingBottom: 20,
  },

  clearButton: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DCE5E8",
    alignItems: "center",
    justifyContent: "center",
  },

  clearText: {
    color: "#536871",
    fontSize: 12,
    fontWeight: "800",
  },

  applyButton: {
    flex: 1.5,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#07869B",
    alignItems: "center",
    justifyContent: "center",
  },

  applyText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },

  pickerOverlay: {
  position: "absolute",
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
  justifyContent: "flex-end",
  zIndex: 999,
},

pickerBackdrop: {
  position: "absolute",
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
  backgroundColor:
    "rgba(0, 0, 0, 0.35)",
},

pickerSheet: {
  backgroundColor: "#FFFFFF",
  borderTopLeftRadius: 24,
  borderTopRightRadius: 24,
  paddingBottom: 25,
  overflow: "hidden",
  zIndex: 1000,
},

pickerHeader: {
  height: 58,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingHorizontal: 20,
  borderBottomWidth: 1,
  borderBottomColor: "#E7ECEF",
},

pickerTitle: {
  fontSize: 15,
  fontWeight: "900",
  color: "#17313C",
},

pickerCancel: {
  fontSize: 13,
  fontWeight: "700",
  color: "#7E9098",
},

pickerDone: {
  fontSize: 13,
  fontWeight: "900",
  color: "#07869B",
},
});