
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
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
  createOperatorBranch,
  getOperatorBranches,
  OperatorBranch,
  OperatorBranchPayload,
  updateOperatorBranch,
} from "../../services/operatorApi";

type BranchForm = {
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  phone: string;
};

const emptyForm: BranchForm = {
  name: "",
  address: "",
  city: "",
  state: "",
  country: "Malaysia",
  phone: "",
};

export default function OperatorBranchesScreen() {
  const router = useRouter();

  const [branches, setBranches] =
    useState<OperatorBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [formVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] =
    useState<number | null>(null);

  const [form, setForm] =
    useState<BranchForm>({ ...emptyForm });

  const loadBranches = useCallback(
    async (refresh = false) => {
      try {
        setError("");

        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const response = await getOperatorBranches();

        setBranches(
          Array.isArray(response?.branches)
            ? response.branches
            : []
        );
      } catch (err: any) {
        setError(
          err?.message || "Unable to load branches."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      loadBranches();
    }, [loadBranches])
  );

  const activeCount = branches.filter(
    (branch) => branch.isActive
  ).length;

  const updateField = (
    key: keyof BranchForm,
    value: string
  ) => {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setFormVisible(true);
  };

  const openEdit = (branch: OperatorBranch) => {
    setEditingId(branch.id);

    setForm({
      name: branch.name || "",
      address: branch.address || "",
      city: branch.city || "",
      state: branch.state || "",
      country: branch.country || "Malaysia",
      phone: branch.phone || "",
    });

    setFormVisible(true);
  };

  const closeForm = () => {
    if (saving) return;

    setFormVisible(false);
    setEditingId(null);
  };

  const saveBranch = async () => {
    if (saving) return;

    if (!form.name.trim()) {
      Alert.alert(
        "Required Field",
        "Branch name is required."
      );
      return;
    }

    if (!form.address.trim()) {
      Alert.alert(
        "Required Field",
        "Branch address is required."
      );
      return;
    }

    const payload: OperatorBranchPayload = {
      name: form.name.trim(),
      address: form.address.trim(),
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      country: form.country.trim() || "Malaysia",
      phone: form.phone.trim() || null,
    };

    try {
      setSaving(true);

      if (editingId !== null) {
        await updateOperatorBranch(editingId, payload);
      } else {
        await createOperatorBranch(payload);
      }

      setFormVisible(false);
      setEditingId(null);

      await loadBranches(true);

      Alert.alert(
        "Success",
        editingId !== null
          ? "Branch updated successfully."
          : "Branch created successfully."
      );
    } catch (err: any) {
      Alert.alert(
        "Unable to Save",
        err?.message || "Failed to save branch."
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleBranchStatus = (branch: OperatorBranch) => {
    const nextStatus = !branch.isActive;

    Alert.alert(
      nextStatus ? "Activate Branch" : "Deactivate Branch",
      nextStatus
        ? `Activate ${branch.name}?`
        : `Deactivate ${branch.name}? This may affect available pickup locations.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              setSaving(true);

              await updateOperatorBranch(branch.id, {
                isActive: nextStatus,
              });

              await loadBranches(true);
            } catch (err: any) {
              Alert.alert(
                "Update Failed",
                err?.message ||
                  "Unable to change branch status."
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
    <SafeAreaView style={styles.safeArea}>
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
            OPERATOR LOCATIONS
          </Text>
          <Text style={styles.title}>Branches</Text>
          <Text style={styles.subtitle}>
            Manage rental locations
          </Text>
        </View>

        <Pressable
          style={styles.addButton}
          onPress={openCreate}
        >
          <Ionicons
            name="add"
            size={21}
            color="#FFFFFF"
          />
          <Text style={styles.addText}>Add</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadBranches(true)}
          />
        }
      >
        <View style={styles.statsRow}>
          <StatCard label="Total" value={branches.length} />
          <StatCard label="Active" value={activeCount} />
          <StatCard
            label="Inactive"
            value={branches.length - activeCount}
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Existing Branches
          </Text>
          <Text style={styles.sectionCount}>
            {branches.length} branches
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#07869B"
            style={{ marginTop: 65 }}
          />
        ) : error ? (
          <View style={styles.emptyCard}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => loadBranches()}>
              <Text style={styles.link}>Try Again</Text>
            </Pressable>
          </View>
        ) : branches.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="business-outline"
              size={35}
              color="#81939C"
            />
            <Text style={styles.emptyTitle}>
              No branches found
            </Text>
            <Text style={styles.subtitle}>
              Add your first rental branch.
            </Text>
          </View>
        ) : (
          branches.map((branch) => (
            <View key={branch.id} style={styles.branchCard}>
              <View style={styles.cardHeading}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.branchName}>
                    {branch.name}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    !branch.isActive &&
                      styles.inactiveBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      !branch.isActive &&
                        styles.inactiveText,
                    ]}
                  >
                    {branch.isActive
                      ? "ACTIVE"
                      : "INACTIVE"}
                  </Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Ionicons
                  name="location-outline"
                  size={18}
                  color="#81939C"
                />
                <Text style={styles.detailText}>
                  {[
                    branch.address,
                    branch.city,
                    branch.state,
                    branch.country,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Ionicons
                  name="call-outline"
                  size={18}
                  color="#81939C"
                />
                <Text style={styles.detailText}>
                  {branch.phone || "No contact number"}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Ionicons
                  name="navigate-outline"
                  size={18}
                  color="#81939C"
                />
                <Text style={styles.detailText}>
                  {branch.pickupPoints?.length || 0} pickup /
                  drop-off points
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.actionRow}>
                <Pressable
                  style={styles.editButton}
                  onPress={() => openEdit(branch)}
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
                  style={styles.pointsButton}
                  disabled
                >
                  <Ionicons
                    name="navigate-outline"
                    size={17}
                    color="#17313C"
                  />
                  <Text style={styles.pointsText}>
                    Manage Points
                  </Text>
                </Pressable>
              </View>
              
                <Pressable
                style={styles.pointsButton}
                disabled={saving}
                onPress={() =>
                    router.push({
                    pathname: "/operator/branch/points",
                    params: {
                        branchId: String(branch.id),
                    },
                    })
                }
                >
                <Ionicons
                    name="navigate-outline"
                    size={17}
                    color="#17313C"
                />
                <Text style={styles.pointsText}>
                    Manage Points
                </Text>
                </Pressable>

            </View>
          ))
        )}
      </ScrollView>

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
                  BRANCH MANAGEMENT
                </Text>
                <Text style={styles.modalTitle}>
                  {editingId !== null
                    ? "Edit Branch"
                    : "Add Branch"}
                </Text>
              </View>

              <Pressable
                onPress={closeForm}
                disabled={saving}
                style={styles.closeButton}
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
              <FormField
                label="Branch Name *"
                value={form.name}
                onChangeText={(value) =>
                  updateField("name", value)
                }
                placeholder="Branch name"
              />

              <FormField
                label="Address *"
                value={form.address}
                onChangeText={(value) =>
                  updateField("address", value)
                }
                placeholder="Full branch address"
                multiline
              />

              <FormField
                label="City"
                value={form.city}
                onChangeText={(value) =>
                  updateField("city", value)
                }
                placeholder="City"
              />

              <FormField
                label="State"
                value={form.state}
                onChangeText={(value) =>
                  updateField("state", value)
                }
                placeholder="State"
              />

              <FormField
                label="Country"
                value={form.country}
                onChangeText={(value) =>
                  updateField("country", value)
                }
                placeholder="Malaysia"
              />

              <FormField
                label="Phone"
                value={form.phone}
                onChangeText={(value) =>
                  updateField("phone", value)
                }
                placeholder="Contact number"
                keyboardType="phone-pad"
              />

              <Text style={styles.notice}>
                Branch details are shared with the website
                and can be used by vehicle listings.
              </Text>

              <Pressable
                style={styles.saveButton}
                disabled={saving}
                onPress={saveBranch}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveText}>
                    {editingId !== null
                      ? "Save Changes"
                      : "Create Branch"}
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

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: "default" | "phone-pad";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#91A2A9"
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        keyboardType={keyboardType || "default"}
        style={[
          styles.input,
          multiline && styles.textArea,
        ]}
      />
    </View>
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
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
  },
  backButton: {
    width: 43,
    height: 43,
    backgroundColor: "#FFFFFF",
    borderRadius: 13,
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
    color: "#17313C",
    fontSize: 25,
    fontWeight: "900",
    marginTop: 4,
  },
  subtitle: {
    color: "#81939C",
    fontSize: 12,
    marginTop: 6,
  },
  addButton: {
    backgroundColor: "#07869B",
    height: 44,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 13,
  },
  addText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 75,
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
    borderRadius: 15,
    padding: 13,
  },
  statValue: {
    fontSize: 21,
    fontWeight: "900",
    color: "#17313C",
  },
  statLabel: {
    fontSize: 10,
    color: "#81939C",
    marginTop: 5,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: {
    color: "#17313C",
    fontWeight: "900",
    fontSize: 17,
  },
  sectionCount: {
    color: "#81939C",
    fontSize: 11,
  },
  branchCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EAED",
    borderRadius: 19,
    padding: 17,
    marginBottom: 15,
  },
  cardHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 15,
  },
  branchName: {
    fontSize: 16,
    fontWeight: "900",
    color: "#17313C",
  },
  statusBadge: {
    backgroundColor: "#E3F7EC",
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#15834A",
  },
  inactiveBadge: {
    backgroundColor: "#FFF0F0",
  },
  inactiveText: {
    color: "#D14343",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    marginBottom: 13,
  },
  detailText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 19,
    color: "#6F838C",
  },
  divider: {
    backgroundColor: "#EDF1F3",
    height: 1,
    marginVertical: 7,
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  editButton: {
    flex: 1,
    backgroundColor: "#E6F7F9",
    borderRadius: 12,
    minHeight: 44,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  editText: {
    color: "#07869B",
    fontWeight: "900",
    fontSize: 11,
  },
  pointsButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E3EAED",
    minHeight: 44,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  pointsText: {
    color: "#17313C",
    fontWeight: "900",
    fontSize: 11,
  },
  statusButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E3EAED",
    padding: 13,
    alignItems: "center",
    marginTop: 10,
  },
  statusActionText: {
    color: "#617780",
    fontSize: 12,
    fontWeight: "800",
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E3EAED",
    padding: 30,
    alignItems: "center",
  },
  emptyTitle: {
    color: "#17313C",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 12,
  },
  errorText: {
    color: "#D14343",
    textAlign: "center",
    fontSize: 12,
  },
  link: {
    color: "#07869B",
    fontWeight: "900",
    marginTop: 12,
  },
  modalScreen: {
    flex: 1,
    backgroundColor: "#F7FAFB",
  },
  modalHeader: {
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 23,
    fontWeight: "900",
    color: "#17313C",
    marginTop: 5,
  },
  closeButton: {
    width: 41,
    height: 41,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EAED",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingBottom: 65,
  },
  field: {
    marginBottom: 16,
  },
  fieldLabel: {
    color: "#17313C",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 9,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EAED",
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    color: "#17313C",
  },
  textArea: {
    minHeight: 85,
  },
  notice: {
    color: "#81939C",
    fontSize: 12,
    lineHeight: 19,
    marginBottom: 20,
  },
  saveButton: {
    backgroundColor: "#07869B",
    borderRadius: 14,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
});
