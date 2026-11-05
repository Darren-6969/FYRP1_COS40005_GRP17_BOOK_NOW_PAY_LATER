
import { Ionicons } from "@expo/vector-icons";
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useCallback, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  createOperatorBranchPoint,
  getOperatorBranches,
  OperatorBranch,
  OperatorPickupPoint,
  OperatorPointPayload,
  updateOperatorBranchPoint,
} from "../../../services/operatorApi";

type PointUsage = "PICKUP" | "DROPOFF" | "BOTH";

type PointForm = {
  label: string;
  address: string;
  note: string;
  usage: PointUsage;
  pickupFee: string;
  dropoffFee: string;
};

const emptyForm: PointForm = {
  label: "",
  address: "",
  note: "",
  usage: "BOTH",
  pickupFee: "0",
  dropoffFee: "0",
};

const usageOptions: PointUsage[] = [
  "PICKUP",
  "DROPOFF",
  "BOTH",
];

function money(value: number | string | null | undefined) {
  return `RM ${Number(value ?? 0).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function validFee(value: string): boolean {
  const input = value.trim();

  return (
    /^\d+(\.\d{1,2})?$/.test(input) &&
    Number.isFinite(Number(input))
  );
}

export default function OperatorBranchPointsScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    branchId?: string;
  }>();

  const branchId = Number(params.branchId);

  const [branch, setBranch] = useState<OperatorBranch | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [formVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(
    null
  );
  const [form, setForm] = useState<PointForm>({
    ...emptyForm,
  });

  const loadPoints = useCallback(
    async (refresh = false) => {
      if (!Number.isInteger(branchId) || branchId <= 0) {
        setError("Invalid branch ID.");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        setError("");

        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const response = await getOperatorBranches();

        const matchedBranch = response.branches.find(
          (item) => item.id === branchId
        );

        if (!matchedBranch) {
          throw new Error("Branch not found.");
        }

        setBranch(matchedBranch);
      } catch (err: any) {
        setError(
          err?.message || "Unable to load pickup points."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [branchId]
  );

  useFocusEffect(
    useCallback(() => {
      loadPoints();
    }, [loadPoints])
  );

  const points = [...(branch?.pickupPoints || [])].sort(
    (a, b) =>
      a.sortOrder - b.sortOrder || a.id - b.id
  );

  const activeCount = points.filter(
    (point) => point.isActive
  ).length;

  const updateField = (
    key: keyof PointForm,
    value: string
  ) => {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const changeUsage = (usage: PointUsage) => {
    setForm((previous) => ({
      ...previous,
      usage,
      pickupFee:
        usage === "DROPOFF" ? "0" : previous.pickupFee,
      dropoffFee:
        usage === "PICKUP" ? "0" : previous.dropoffFee,
    }));
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setFormVisible(true);
  };

  const openEdit = (point: OperatorPickupPoint) => {
    setEditingId(point.id);

    setForm({
      label: point.label || "",
      address: point.address || "",
      note: point.note || "",
      usage: point.usage || "BOTH",
      pickupFee: String(point.fee ?? 0),
      dropoffFee: String(point.dropoffFee ?? 0),
    });

    setFormVisible(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormVisible(false);
    setEditingId(null);
  };

  const savePoint = async () => {
    if (saving || !branch) return;

    if (!form.label.trim()) {
      Alert.alert(
        "Required Field",
        "Pickup/drop-off point name is required."
      );
      return;
    }

    if (
      !validFee(form.pickupFee) ||
      !validFee(form.dropoffFee)
    ) {
      Alert.alert(
        "Invalid Fee",
        "Enter a valid non-negative RM amount with up to 2 decimal places."
      );
      return;
    }

    const payload: OperatorPointPayload = {
      label: form.label.trim(),
      address: form.address.trim() || null,
      note: form.note.trim() || null,
      usage: form.usage,
      pickupFee:
        form.usage === "DROPOFF"
          ? 0
          : Number(form.pickupFee),
      dropoffFee:
        form.usage === "PICKUP"
          ? 0
          : Number(form.dropoffFee),
    };

    const wasEditing = editingId !== null;

    try {
      setSaving(true);

      if (editingId !== null) {
        await updateOperatorBranchPoint(
          branchId,
          editingId,
          payload
        );
      } else {
        await createOperatorBranchPoint(
          branchId,
          payload
        );
      }

      setFormVisible(false);
      setEditingId(null);

      await loadPoints(true);

      Alert.alert(
        "Success",
        wasEditing
          ? "Pickup/drop-off point updated successfully."
          : "Pickup/drop-off point created successfully."
      );
    } catch (err: any) {
      Alert.alert(
        "Unable to Save",
        err?.message || "Unable to save point."
      );
    } finally {
      setSaving(false);
    }
  };

  const togglePointStatus = (point: OperatorPickupPoint) => {
    if (saving) return;

    const nextStatus = !point.isActive;

    Alert.alert(
      nextStatus ? "Activate Point" : "Deactivate Point",
      nextStatus
        ? `Activate ${point.label}?`
        : `Deactivate ${point.label}? Customers may no longer be able to select it for new bookings.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              setSaving(true);

              await updateOperatorBranchPoint(
                branchId,
                point.id,
                { isActive: nextStatus }
              );

              await loadPoints(true);
            } catch (err: any) {
              Alert.alert(
                "Update Failed",
                err?.message ||
                  "Unable to update point status."
              );
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          disabled={saving}
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color="#17313C"
          />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>
            BRANCH MANAGEMENT
          </Text>
          <Text style={styles.title}>
            Pickup & Drop-off
          </Text>
        </View>

        <Pressable
          style={styles.addButton}
          onPress={openCreate}
          disabled={saving || !branch}
        >
          <Ionicons
            name="add"
            size={21}
            color="#FFFFFF"
          />
          <Text style={styles.addText}>Add</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator
            size="large"
            color="#07869B"
          />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>
            {error}
          </Text>

          <Pressable onPress={() => loadPoints()}>
            <Text style={styles.retryText}>
              Try Again
            </Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadPoints(true)}
            />
          }
        >
          <View style={styles.branchCard}>
            <Text style={styles.smallLabel}>
              SELECTED BRANCH
            </Text>

            <Text style={styles.branchName}>
              {branch?.name}
            </Text>

            {!!branch?.address && (
              <Text style={styles.branchAddress}>
                {branch.address}
              </Text>
            )}
          </View>

          <View style={styles.statsRow}>
            <Stat
              label="Total"
              value={points.length}
            />
            <Stat
              label="Active"
              value={activeCount}
            />
            <Stat
              label="Inactive"
              value={points.length - activeCount}
            />
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Pickup & Drop-off Points
            </Text>

            <Text style={styles.count}>
              {points.length} points
            </Text>
          </View>

          {points.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons
                name="location-outline"
                size={34}
                color="#81939C"
              />

              <Text style={styles.emptyTitle}>
                No points found
              </Text>

              <Text style={styles.muted}>
                Add pickup and drop-off locations
                for this branch.
              </Text>
            </View>
          ) : (
            points.map((point) => (
              <View
                key={point.id}
                style={styles.pointCard}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.pointName}>
                    {point.label}
                  </Text>

                  <View
                    style={[
                      styles.badge,
                      !point.isActive &&
                        styles.inactiveBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        !point.isActive &&
                          styles.inactiveText,
                      ]}
                    >
                      {point.isActive
                        ? "ACTIVE"
                        : "INACTIVE"}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons
                    name="location-outline"
                    size={17}
                    color="#81939C"
                  />
                  <Text style={styles.detailText}>
                    {point.address || "No address provided"}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons
                    name="swap-horizontal-outline"
                    size={17}
                    color="#81939C"
                  />
                  <Text style={styles.detailText}>
                    {point.usage === "BOTH"
                      ? "Pickup & Drop-off"
                      : point.usage === "PICKUP"
                        ? "Pickup Only"
                        : "Drop-off Only"}
                  </Text>
                </View>

                {!!point.note && (
                  <Text style={styles.note}>
                    {point.note}
                  </Text>
                )}

                <View style={styles.divider} />

                <View style={styles.feeRow}>
                  <View>
                    <Text style={styles.smallLabel}>
                      Pickup Fee
                    </Text>
                    <Text style={styles.feeValue}>
                      {money(point.fee)}
                    </Text>
                  </View>

                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.smallLabel}>
                      Drop-off Fee
                    </Text>
                    <Text style={styles.feeValue}>
                      {money(point.dropoffFee)}
                    </Text>
                  </View>
                </View>

                <View style={styles.actionRow}>
                  <Pressable
                    style={styles.editButton}
                    onPress={() => openEdit(point)}
                    disabled={saving}
                  >
                    <Ionicons
                      name="create-outline"
                      size={17}
                      color="#07869B"
                    />
                    <Text style={styles.editText}>
                      Edit Details
                    </Text>
                  </Pressable>

                  <Pressable
                    style={styles.statusButton}
                    onPress={() =>
                      togglePointStatus(point)
                    }
                    disabled={saving}
                  >
                    <Text style={styles.statusButtonText}>
                      {point.isActive
                        ? "Deactivate"
                        : "Activate"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <Modal
        visible={formVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeForm}
      >
        <SafeAreaView style={styles.modalScreen}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={
              Platform.OS === "ios"
                ? "padding"
                : undefined
            }
          >
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>
                  PICKUP & DROP-OFF
                </Text>

                <Text style={styles.modalTitle}>
                  {editingId !== null
                    ? "Edit Point"
                    : "Add Point"}
                </Text>
              </View>

              <Pressable
                style={styles.closeButton}
                onPress={closeForm}
                disabled={saving}
              >
                <Ionicons
                  name="close"
                  size={22}
                  color="#17313C"
                />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalContent}
            >
              <Field
                label="Point Name *"
                value={form.label}
                onChange={(value) =>
                  updateField("label", value)
                }
                placeholder="e.g. Airport Pickup Counter"
              />

              <Field
                label="Address"
                value={form.address}
                onChange={(value) =>
                  updateField("address", value)
                }
                placeholder="Full location address"
                multiline
              />

              <Field
                label="Notes"
                value={form.note}
                onChange={(value) =>
                  updateField("note", value)
                }
                placeholder="Instructions for customers"
                multiline
              />

              <Text style={styles.inputLabel}>
                Usage Type *
              </Text>

              <View style={styles.usageOptions}>
                {usageOptions.map((usage) => (
                  <Pressable
                    key={usage}
                    style={[
                      styles.usageButton,
                      form.usage === usage &&
                        styles.selectedUsage,
                    ]}
                    onPress={() =>
                      changeUsage(usage)
                    }
                  >
                    <Text
                      style={[
                        styles.usageText,
                        form.usage === usage &&
                          styles.selectedUsageText,
                      ]}
                    >
                      {usage === "BOTH"
                        ? "Both"
                        : usage === "PICKUP"
                          ? "Pickup"
                          : "Drop-off"}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {form.usage !== "DROPOFF" && (
                <Field
                  label="Pickup Fee (RM)"
                  value={form.pickupFee}
                  onChange={(value) =>
                    updateField("pickupFee", value)
                  }
                  placeholder="0.00"
                  decimal
                />
              )}

              {form.usage !== "PICKUP" && (
                <Field
                  label="Drop-off Fee (RM)"
                  value={form.dropoffFee}
                  onChange={(value) =>
                    updateField("dropoffFee", value)
                  }
                  placeholder="0.00"
                  decimal
                />
              )}

              <View style={styles.noticeCard}>
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color="#07869B"
                />

                <Text style={styles.noticeText}>
                  Pickup and drop-off fees are shared
                  with the website and may affect
                  customer booking prices.
                </Text>
              </View>

              <Pressable
                style={[
                  styles.saveButton,
                  saving && { opacity: 0.6 },
                ]}
                onPress={savePoint}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveText}>
                    {editingId !== null
                      ? "Save Changes"
                      : "Create Point"}
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.smallLabel}>{label}</Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  decimal = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  decimal?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.inputLabel}>{label}</Text>

      <TextInput
        style={[
          styles.input,
          multiline && styles.textArea,
        ]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#91A2A9"
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        keyboardType={decimal ? "decimal-pad" : "default"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7FAFB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 20,
  },
  backButton: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EAED",
    justifyContent: "center",
    alignItems: "center",
  },
  eyebrow: {
    color: "#07869B",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: "#17313C",
    marginTop: 5,
  },
  addButton: {
    backgroundColor: "#07869B",
    borderRadius: 13,
    height: 44,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  addText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 25,
  },
  errorText: {
    color: "#D14343",
    fontSize: 13,
    textAlign: "center",
  },
  retryText: {
    color: "#07869B",
    fontWeight: "900",
    marginTop: 12,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 85,
  },
  branchCard: {
    backgroundColor: "#E6F7F9",
    borderRadius: 16,
    padding: 17,
    marginBottom: 17,
  },
  branchName: {
    fontSize: 17,
    fontWeight: "900",
    color: "#17313C",
    marginTop: 7,
  },
  branchAddress: {
    color: "#617780",
    fontSize: 12,
    marginTop: 8,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 22,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EAED",
    borderRadius: 14,
    padding: 14,
  },
  statValue: {
    fontSize: 21,
    fontWeight: "900",
    color: "#17313C",
    marginBottom: 5,
  },
  smallLabel: {
    fontSize: 10,
    color: "#81939C",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "900",
    color: "#17313C",
  },
  count: {
    color: "#81939C",
    fontSize: 11,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E3EAED",
    padding: 33,
    alignItems: "center",
  },
  emptyTitle: {
    color: "#17313C",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 12,
  },
  muted: {
    color: "#81939C",
    fontSize: 12,
    textAlign: "center",
    marginTop: 10,
    lineHeight: 18,
  },
  pointCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E3EAED",
    padding: 16,
    backgroundColor: "#FFFFFF",
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 13,
  },
  pointName: {
    flex: 1,
    color: "#17313C",
    fontSize: 15,
    fontWeight: "900",
  },
  badge: {
    backgroundColor: "#E3F7EC",
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 9,
    color: "#15834A",
    fontWeight: "900",
  },
  inactiveBadge: {
    backgroundColor: "#FFF0F0",
  },
  inactiveText: {
    color: "#D14343",
  },
  detailRow: {
    flexDirection: "row",
    gap: 9,
    alignItems: "flex-start",
    marginBottom: 12,
  },
  detailText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 19,
    color: "#617780",
  },
  note: {
    fontSize: 12,
    lineHeight: 19,
    color: "#81939C",
    marginBottom: 10,
  },
  divider: {
    height: 1,
    backgroundColor: "#EDF1F3",
    marginVertical: 15,
  },
  feeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  feeValue: {
    fontSize: 16,
    fontWeight: "900",
    color: "#17313C",
    marginTop: 6,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  editButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#E6F7F9",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  editText: {
    color: "#07869B",
    fontSize: 11,
    fontWeight: "900",
  },
  statusButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E3EAED",
    alignItems: "center",
    justifyContent: "center",
  },
  statusButtonText: {
    color: "#617780",
    fontSize: 11,
    fontWeight: "900",
  },
  modalScreen: {
    flex: 1,
    backgroundColor: "#F7FAFB",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
  },
  modalTitle: {
    fontSize: 23,
    color: "#17313C",
    fontWeight: "900",
    marginTop: 5,
  },
  closeButton: {
    width: 41,
    height: 41,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EAED",
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingBottom: 65,
  },
  field: {
    marginBottom: 18,
  },
  inputLabel: {
    color: "#17313C",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 9,
  },
  input: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#E3EAED",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 13,
    color: "#17313C",
  },
  textArea: {
    minHeight: 85,
  },
  usageOptions: {
    flexDirection: "row",
    gap: 9,
    marginBottom: 20,
  },
  usageButton: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EAED",
    borderRadius: 12,
    minHeight: 43,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedUsage: {
    backgroundColor: "#07869B",
    borderColor: "#07869B",
  },
  usageText: {
    color: "#617780",
    fontSize: 12,
    fontWeight: "800",
  },
  selectedUsageText: {
    color: "#FFFFFF",
  },
  noticeCard: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#E6F7F9",
    padding: 15,
    borderRadius: 14,
    marginTop: 6,
    marginBottom: 20,
  },
  noticeText: {
    flex: 1,
    color: "#617780",
    fontSize: 11,
    lineHeight: 18,
  },
  saveButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: "#07869B",
    justifyContent: "center",
    alignItems: "center",
  },
  saveText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
});
