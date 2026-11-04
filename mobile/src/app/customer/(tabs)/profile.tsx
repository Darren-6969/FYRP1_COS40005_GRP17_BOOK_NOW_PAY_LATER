import { Ionicons } from "@expo/vector-icons";

import {
  useFocusEffect,
  useRouter,
} from "expo-router";

import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  useCallback,
  useState,
} from "react";

import {
  clearSession,
  getStoredUser,
  saveStoredUser,
} from "../../../services/session";

import * as ImagePicker from "expo-image-picker";
import {
  changePassword,
  getMe,
  updateNotificationPreferences,
  updateProfile,
} from "../../../services/authApi";

type UserProfile = {
  id?: number;

  userCode?: string;

  name?: string;

  email?: string;

  phone?: string;

  profileImageUrl?: string;

  role?: string;

  createdAt?: string;

  notifyBookingUpdates?: boolean;

  notifyPaymentReminders?: boolean;

  notifyInvoices?: boolean;

  notifyPromotions?: boolean;
};

export default function ProfileScreen() {
  const router = useRouter();

  const [user, setUser] =
    useState<UserProfile | null>(null);

  const [
    editVisible,
    setEditVisible,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
  passwordVisible,
  setPasswordVisible,
  ] = useState(false);

  const [
    savingPassword,
    setSavingPassword,
  ] = useState(false);

  const [
    showCurrentPassword,
    setShowCurrentPassword,
  ] = useState(false);

  const [
    showNewPassword,
    setShowNewPassword,
  ] = useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);

  const [
    passwordForm,
    setPasswordForm,
  ] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [
  notificationVisible,
  setNotificationVisible,
  ] = useState(false);

  const [
    savingNotifications,
    setSavingNotifications,
  ] = useState(false);

  const [
    notificationForm,
    setNotificationForm,
  ] = useState({
    notifyBookingUpdates: true,
    notifyPaymentReminders: true,
    notifyInvoices: true,
    notifyPromotions: false,
  });

  const [
    profileForm,
    setProfileForm,
  ] = useState({
    name: "",
    phone: "",
    profileImageUrl: "",
  });

  const loadUser = async () => {
  try {
    const response =
      await getMe();

    const nextUser =
      response?.user ||
      response;

    if (nextUser) {
      setUser(nextUser);

      await saveStoredUser(
        nextUser
      );

      setNotificationForm({
      notifyBookingUpdates:
        Boolean(
          nextUser.notifyBookingUpdates
        ),

      notifyPaymentReminders:
        Boolean(
          nextUser.notifyPaymentReminders
        ),

      notifyInvoices:
        Boolean(
          nextUser.notifyInvoices
        ),

      notifyPromotions:
        Boolean(
          nextUser.notifyPromotions
        ),
    });

      setProfileForm({
        name:
          nextUser.name || "",

        phone:
          nextUser.phone || "",

        profileImageUrl:
          nextUser.profileImageUrl ||
          "",
      });

      return;
    }
  } catch (error) {
    console.log(
      "Failed to refresh profile:",
      error
    );
  }

  const storedUser:
    UserProfile | null =
    await getStoredUser();

  setUser(storedUser);

  if (storedUser) {
    setProfileForm({
      name:
        storedUser.name || "",

      phone:
        storedUser.phone || "",

      profileImageUrl:
        storedUser.profileImageUrl ||
        "",
    });

    setNotificationForm({
      notifyBookingUpdates:
        Boolean(
          storedUser.notifyBookingUpdates
        ),

      notifyPaymentReminders:
        Boolean(
          storedUser.notifyPaymentReminders
        ),

      notifyInvoices:
        Boolean(
          storedUser.notifyInvoices
        ),

      notifyPromotions:
        Boolean(
          storedUser.notifyPromotions
        ),
    });
  }
};

  useFocusEffect(
    useCallback(() => {
      loadUser();
    }, [])
  );

  const handleChoosePhoto =
  async () => {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Permission Required",
        "Please allow photo library access to select a profile picture."
      );

      return;
    }

    const result =
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.55,
        base64: true,
      });

    if (
      result.canceled ||
      !result.assets?.[0]
    ) {
      return;
    }

    const asset =
      result.assets[0];

    if (!asset.base64) {
      Alert.alert(
        "Image Error",
        "Unable to process the selected image."
      );

      return;
    }

    const mimeType =
      asset.mimeType ||
      "image/jpeg";

    const imageUrl =
      `data:${mimeType};base64,${asset.base64}`;

    if (
      imageUrl.length >
      1_450_000
    ) {
      Alert.alert(
        "Image Too Large",
        "Please choose a smaller profile picture."
      );

      return;
    }

    setProfileForm(
      (current) => ({
        ...current,

        profileImageUrl:
          imageUrl,
      })
    );
  };

  const openEditProfile =
  () => {
    setProfileForm({
      name:
        user?.name || "",

      phone:
        user?.phone || "",

      profileImageUrl:
        user?.profileImageUrl ||
        "",
    });

    setEditVisible(true);
  };

  const handleSaveProfile =
  async () => {
    const name =
      profileForm.name.trim();

    const phone =
      profileForm.phone.trim();

    if (!name) {
      Alert.alert(
        "Name Required",
        "Please enter your full name."
      );

      return;
    }

    try {
      setSaving(true);

      const response =
        await updateProfile({
          name,

          phone,

          profileImageUrl:
            profileForm.profileImageUrl,
        });

      const nextUser =
        response?.user ||
        response;

      if (!nextUser) {
        throw new Error(
          "Profile update returned no user information."
        );
      }

      setUser(nextUser);

      await saveStoredUser(
        nextUser
      );

      setProfileForm({
        name:
          nextUser.name || "",

        phone:
          nextUser.phone || "",

        profileImageUrl:
          nextUser.profileImageUrl ||
          "",
      });

      setEditVisible(false);

      Alert.alert(
        "Profile Updated",
        "Your profile has been updated successfully."
      );
    } catch (error: any) {
      console.log(
        "Failed to update profile:",
        error
      );

      Alert.alert(
        "Update Failed",
        error?.message ||
          "Unable to update your profile."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword =
  async () => {
    const currentPassword =
      passwordForm.currentPassword;

    const newPassword =
      passwordForm.newPassword;

    const confirmPassword =
      passwordForm.confirmPassword;

    if (
      !currentPassword ||
      !newPassword ||
      !confirmPassword
    ) {
      Alert.alert(
        "Incomplete Information",
        "Please complete all password fields."
      );

      return;
    }

    if (
      newPassword.length < 8
    ) {
      Alert.alert(
        "Invalid Password",
        "New password must be at least 8 characters."
      );

      return;
    }

    if (
      !/[A-Z]/.test(
        newPassword
      )
    ) {
      Alert.alert(
        "Invalid Password",
        "New password must contain at least one uppercase letter."
      );

      return;
    }

    if (
      !/[a-z]/.test(
        newPassword
      )
    ) {
      Alert.alert(
        "Invalid Password",
        "New password must contain at least one lowercase letter."
      );

      return;
    }

    if (
      !/[0-9]/.test(
        newPassword
      )
    ) {
      Alert.alert(
        "Invalid Password",
        "New password must contain at least one number."
      );

      return;
    }

    if (
      currentPassword ===
      newPassword
    ) {
      Alert.alert(
        "Invalid Password",
        "New password must be different from your current password."
      );

      return;
    }

    if (
      newPassword !==
      confirmPassword
    ) {
      Alert.alert(
        "Password Mismatch",
        "New password and confirm password do not match."
      );

      return;
    }

    try {
      setSavingPassword(
        true
      );

      await changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      setPasswordVisible(
        false
      );

      Alert.alert(
        "Password Updated",
        "Your password has been changed successfully."
      );
    } catch (error: any) {
      console.log(
        "Failed to change password:",
        error
      );

      Alert.alert(
        "Update Failed",
        error?.message ||
          "Unable to change your password."
      );
    } finally {
      setSavingPassword(
        false
      );
    }
  };

  const openNotificationPreferences =
    () => {
      setNotificationForm({
        notifyBookingUpdates:
          Boolean(
            user?.notifyBookingUpdates
          ),

        notifyPaymentReminders:
          Boolean(
            user?.notifyPaymentReminders
          ),

        notifyInvoices:
          Boolean(
            user?.notifyInvoices
          ),

        notifyPromotions:
          Boolean(
            user?.notifyPromotions
          ),
      });

      setNotificationVisible(
        true
      );
    };

  const handleSaveNotifications =
  async () => {
    try {
      setSavingNotifications(
        true
      );

      const response =
        await updateNotificationPreferences(
          notificationForm
        );

      const nextUser =
        response?.user ||
        response;

      if (nextUser) {
        setUser(nextUser);

        await saveStoredUser(
          nextUser
        );

        setNotificationForm({
          notifyBookingUpdates:
            Boolean(
              nextUser.notifyBookingUpdates
            ),

          notifyPaymentReminders:
            Boolean(
              nextUser.notifyPaymentReminders
            ),

          notifyInvoices:
            Boolean(
              nextUser.notifyInvoices
            ),

          notifyPromotions:
            Boolean(
              nextUser.notifyPromotions
            ),
        });
      }

      setNotificationVisible(
        false
      );

      Alert.alert(
        "Preferences Updated",
        "Your notification preferences have been saved successfully."
      );
    } catch (error: any) {
      console.log(
        "Failed to update notification preferences:",
        error
      );

      Alert.alert(
        "Update Failed",
        error?.message ||
          "Unable to update notification preferences."
      );
    } finally {
      setSavingNotifications(
        false
      );
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },

        {
          text: "Log Out",
          style: "destructive",

          onPress: async () => {
            await clearSession();

            router.dismissAll();

            router.replace(
              "/login"
            );
          },
        },
      ]
    );
  };

  const displayName =
    user?.name ||
    "Customer";

  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) =>
        part.charAt(0).toUpperCase()
      )
      .join("");

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.content
        }
      >
        {/* Header */}
        <View
          style={
            styles.header
          }
        >
          <View>
            <Text
              style={
                styles.eyebrow
              }
            >
              MY ACCOUNT
            </Text>

            <Text
              style={
                styles.title
              }
            >
              Profile
            </Text>

            <Text
              style={
                styles.subtitle
              }
            >
              Manage your account and preferences
            </Text>
          </View>

          <View
            style={
              styles.headerIcon
            }
          >
            <Ionicons
              name="person-outline"
              size={24}
              color="#07869B"
            />
          </View>
        </View>

        {/* Profile Card */}
        <View
          style={
            styles.profileCard
          }
        >
          <View
          style={
            styles.avatarWrapper
          }
        >
          {user?.profileImageUrl ? (
            <Image
              source={{
                uri:
                  user.profileImageUrl,
              }}
              style={
                styles.avatarImage
              }
            />
          ) : (
            <View
              style={
                styles.avatar
              }
            >
              <Text
                style={
                  styles.avatarText
                }
              >
                {initials ||
                  "CU"}
              </Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.avatarEditButton,

              pressed && {
                opacity: 0.7,
              },
            ]}
            onPress={
              openEditProfile
            }
          >
            <Ionicons
              name="camera-outline"
              size={14}
              color="#FFFFFF"
            />
          </Pressable>
        </View>

          <View
            style={{
              flex: 1,
            }}
          >
            <Text
              style={
                styles.profileName
              }
            >
              {displayName}
            </Text>

            <Text
              style={
                styles.profileEmail
              }
            >
              {user?.email ||
                "No email available"}
            </Text>

            <View
              style={
                styles.roleBadge
              }
            >
              <Ionicons
                name="person-circle-outline"
                size={13}
                color="#07869B"
              />

              <Text
                style={
                  styles.roleText
                }
              >
                {user?.role ||
                  "CUSTOMER"}
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.editProfileButton,

                pressed && {
                  opacity: 0.7,
                },
              ]}
              onPress={
                openEditProfile
              }
            >
              <Ionicons
                name="create-outline"
                size={14}
                color="#07869B"
              />

              <Text
                style={
                  styles.editProfileText
                }
              >
                Edit Profile
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Account Information */}
        <Text
          style={
            styles.sectionTitle
          }
        >
          Account Information
        </Text>

        <View
          style={
            styles.sectionCard
          }
        >
          <ProfileRow
            icon="person-outline"
            label="Full Name"
            value={
              user?.name ||
              "-"
            }
          />

          <View
            style={
              styles.divider
            }
          />

          <ProfileRow
            icon="mail-outline"
            label="Email"
            value={
              user?.email ||
              "-"
            }
          />

          <View
            style={
              styles.divider
            }
          />

          <ProfileRow
            icon="call-outline"
            label="Phone Number"
            value={
              user?.phone ||
              "Not provided"
            }
          />

          <View
            style={
              styles.divider
            }
          />

          <ProfileRow
            icon="id-card-outline"
            label="Customer ID"
            value={
              user?.userCode ||
              user?.id
                ? String(
                    user?.userCode ||
                      user?.id
                  )
                : "-"
            }
          />
        </View>

        {/* Account */}
        <Text
          style={
            styles.sectionTitle
          }
        >
          Account
        </Text>

        <View
          style={
            styles.sectionCard
          }
        >
          <MenuRow
            icon="notifications-outline"
            title="Notifications"
            subtitle="View your booking and payment alerts"
            onPress={() =>
              router.push(
                "/customer/notifications"
              )
            }
          />

          <View
            style={
              styles.divider
            }
          />

          <MenuRow
            icon="wallet-outline"
            title="Payments"
            subtitle="View payment history and status"
            onPress={() =>
              router.push(
                "/customer/(tabs)/payments"
              )
            }
          />

          <View
            style={
              styles.divider
            }
          />

          <MenuRow
            icon="car-outline"
            title="My Bookings"
            subtitle="Manage your rental bookings"
            onPress={() =>
              router.push(
                "/customer/(tabs)/bookings"
              )
            }
          />

          <View
            style={
              styles.divider
            }
          />

          <MenuRow
            icon="heart-outline"
            title="Saved Cars"
            subtitle="View vehicles you saved for later"
            onPress={() =>
              router.push(
                "/customer/saved-cars"
              )
            }
          />

          <View
            style={
              styles.divider
            }
          />

          <MenuRow
            icon="lock-closed-outline"
            title="Change Password"
            subtitle="Update your account password"
            onPress={() =>
              setPasswordVisible(
                true
              )
            }
          />

          <View
            style={
              styles.divider
            }
          />

          <MenuRow
            icon="settings-outline"
            title="Notification Preferences"
            subtitle="Choose which updates you want to receive"
            onPress={
              openNotificationPreferences
            }
          />
        </View>

        {/* Support */}
        <Text
          style={
            styles.sectionTitle
          }
        >
          Support & Legal
        </Text>

        <View
          style={
            styles.sectionCard
          }
        >
          <MenuRow
            icon="help-circle-outline"
            title="Help & Support"
            subtitle="Get help with your bookings and payments"
            onPress={() =>
              router.push(
                "/customer/support-chat"
              )
            }
          />

          <View
            style={
              styles.divider
            }
          />

          <MenuRow
            icon="document-text-outline"
            title="Terms & Conditions"
            subtitle="Review platform terms"
            onPress={() =>
              router.push(
                "/customer/terms"
              )
            }
          />

          <View
            style={
              styles.divider
            }
          />

          <MenuRow
            icon="shield-checkmark-outline"
            title="Privacy Policy"
            subtitle="Learn how your information is handled"
            onPress={() =>
              router.push(
                "/customer/privacy"
              )
            }
          />
        </View>

        {/* Logout */}
        <Pressable
          style={({ pressed }) => [
            styles.logoutButton,

            pressed && {
              opacity: 0.7,
            },
          ]}
          onPress={
            handleLogout
          }
        >
          <Ionicons
            name="log-out-outline"
            size={20}
            color="#C84242"
          />

          <Text
            style={
              styles.logoutText
            }
          >
            Log Out
          </Text>
        </Pressable>

        <Text
          style={
            styles.versionText
          }
        >
          BNPL Mobile App
        </Text>
      </ScrollView>

<Modal
  visible={
    editVisible
  }
  animationType="slide"
  transparent
  onRequestClose={() =>
    setEditVisible(false)
  }
>
  <View
    style={
      styles.modalBackdrop
    }
  >
    <View
      style={
        styles.modalSheet
      }
    >
      <View
        style={
          styles.modalHandle
        }
      />

      <View
        style={
          styles.modalHeader
        }
      >
        <View>
          <Text
            style={
              styles.modalEyebrow
            }
          >
            PROFILE SETTINGS
          </Text>

          <Text
            style={
              styles.modalTitle
            }
          >
            Edit Profile
          </Text>
        </View>

        <Pressable
          style={
            styles.modalClose
          }
          onPress={() =>
            setEditVisible(false)
          }
        >
          <Ionicons
            name="close"
            size={20}
            color="#17313C"
          />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
      >
        <View
          style={
            styles.editAvatarSection
          }
        >
          {profileForm.profileImageUrl ? (
            <Image
              source={{
                uri:
                  profileForm.profileImageUrl,
              }}
              style={
                styles.editAvatarImage
              }
            />
          ) : (
            <View
              style={
                styles.editAvatarFallback
              }
            >
              <Text
                style={
                  styles.editAvatarText
                }
              >
                {initials ||
                  "CU"}
              </Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.changePhotoButton,

              pressed && {
                opacity: 0.7,
              },
            ]}
            onPress={
              handleChoosePhoto
            }
          >
            <Ionicons
              name="camera-outline"
              size={17}
              color="#07869B"
            />

            <Text
              style={
                styles.changePhotoText
              }
            >
              Change Photo
            </Text>
          </Pressable>

          {profileForm.profileImageUrl ? (
            <Pressable
              onPress={() =>
                setProfileForm(
                  (current) => ({
                    ...current,

                    profileImageUrl:
                      "",
                  })
                )
              }
            >
              <Text
                style={
                  styles.removePhotoText
                }
              >
                Remove Photo
              </Text>
            </Pressable>
          ) : null}
        </View>

        <Text
          style={
            styles.inputLabel
          }
        >
          Full Name
        </Text>

        <View
          style={
            styles.inputContainer
          }
        >
          <Ionicons
            name="person-outline"
            size={18}
            color="#82949C"
          />

          <TextInput
            style={
              styles.input
            }
            value={
              profileForm.name
            }
            onChangeText={(
              value
            ) =>
              setProfileForm(
                (current) => ({
                  ...current,

                  name:
                    value,
                })
              )
            }
            placeholder="Enter your full name"
            placeholderTextColor="#9BA8AD"
          />
        </View>

        <Text
          style={
            styles.inputLabel
          }
        >
          Email Address
        </Text>

        <View
          style={[
            styles.inputContainer,

            styles.inputDisabled,
          ]}
        >
          <Ionicons
            name="mail-outline"
            size={18}
            color="#9BA8AD"
          />

          <Text
            style={
              styles.disabledText
            }
          >
            {user?.email ||
              "-"}
          </Text>

          <Ionicons
            name="lock-closed-outline"
            size={14}
            color="#A5B0B5"
          />
        </View>

        <Text
          style={
            styles.emailHint
          }
        >
          Email address cannot be changed because it is used to match booking records.
        </Text>

        <Text
          style={
            styles.inputLabel
          }
        >
          Phone Number
        </Text>

        <View
          style={
            styles.inputContainer
          }
        >
          <Ionicons
            name="call-outline"
            size={18}
            color="#82949C"
          />

          <TextInput
            style={
              styles.input
            }
            value={
              profileForm.phone
            }
            onChangeText={(
              value
            ) =>
              setProfileForm(
                (current) => ({
                  ...current,

                  phone:
                    value,
                })
              )
            }
            placeholder="e.g. 0123456789"
            placeholderTextColor="#9BA8AD"
            keyboardType="phone-pad"
          />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.saveButton,

            saving &&
              styles.saveButtonDisabled,

            pressed &&
              !saving && {
                opacity: 0.8,
              },
          ]}
          disabled={
            saving
          }
          onPress={
            handleSaveProfile
          }
        >
          {saving ? (
            <ActivityIndicator
              size="small"
              color="#FFFFFF"
            />
          ) : (
            <Ionicons
              name="checkmark-circle-outline"
              size={19}
              color="#FFFFFF"
            />
          )}

          <Text
            style={
              styles.saveButtonText
            }
          >
            {saving
              ? "Saving..."
              : "Save Profile"}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  </View>
</Modal>

<Modal
  visible={
    passwordVisible
  }
  animationType="slide"
  transparent
  onRequestClose={() =>
    setPasswordVisible(
      false
    )
  }
>
  <View
    style={
      styles.modalBackdrop
    }
  >
    <View
      style={
        styles.modalSheet
      }
    >
      <View
        style={
          styles.modalHandle
        }
      />

      <View
        style={
          styles.modalHeader
        }
      >
        <View>
          <Text
            style={
              styles.modalEyebrow
            }
          >
            SECURITY
          </Text>

          <Text
            style={
              styles.modalTitle
            }
          >
            Change Password
          </Text>
        </View>

        <Pressable
          style={
            styles.modalClose
          }
          onPress={() =>
            setPasswordVisible(
              false
            )
          }
        >
          <Ionicons
            name="close"
            size={20}
            color="#17313C"
          />
        </Pressable>
      </View>

      <Text
        style={
          styles.passwordDescription
        }
      >
        Your new password must contain at least 8 characters, including uppercase, lowercase, and a number.
      </Text>

      <Text
        style={
          styles.inputLabel
        }
      >
        Current Password
      </Text>

      <View
        style={
          styles.inputContainer
        }
      >
        <Ionicons
          name="lock-closed-outline"
          size={18}
          color="#82949C"
        />

        <TextInput
          style={
            styles.input
          }
          value={
            passwordForm.currentPassword
          }
          onChangeText={(
            value
          ) =>
            setPasswordForm(
              (current) => ({
                ...current,

                currentPassword:
                  value,
              })
            )
          }
          secureTextEntry={
            !showCurrentPassword
          }
          placeholder="Enter current password"
          placeholderTextColor="#9BA8AD"
          autoCapitalize="none"
        />

        <Pressable
          onPress={() =>
            setShowCurrentPassword(
              (current) =>
                !current
            )
          }
        >
          <Ionicons
            name={
              showCurrentPassword
                ? "eye-off-outline"
                : "eye-outline"
            }
            size={18}
            color="#82949C"
          />
        </Pressable>
      </View>

      <Text
        style={
          styles.inputLabel
        }
      >
        New Password
      </Text>

      <View
        style={
          styles.inputContainer
        }
      >
        <Ionicons
          name="key-outline"
          size={18}
          color="#82949C"
        />

        <TextInput
          style={
            styles.input
          }
          value={
            passwordForm.newPassword
          }
          onChangeText={(
            value
          ) =>
            setPasswordForm(
              (current) => ({
                ...current,

                newPassword:
                  value,
              })
            )
          }
          secureTextEntry={
            !showNewPassword
          }
          placeholder="Enter new password"
          placeholderTextColor="#9BA8AD"
          autoCapitalize="none"
        />

        <Pressable
          onPress={() =>
            setShowNewPassword(
              (current) =>
                !current
            )
          }
        >
          <Ionicons
            name={
              showNewPassword
                ? "eye-off-outline"
                : "eye-outline"
            }
            size={18}
            color="#82949C"
          />
        </Pressable>
      </View>

      <Text
        style={
          styles.inputLabel
        }
      >
        Confirm New Password
      </Text>

      <View
        style={
          styles.inputContainer
        }
      >
        <Ionicons
          name="shield-checkmark-outline"
          size={18}
          color="#82949C"
        />

        <TextInput
          style={
            styles.input
          }
          value={
            passwordForm.confirmPassword
          }
          onChangeText={(
            value
          ) =>
            setPasswordForm(
              (current) => ({
                ...current,

                confirmPassword:
                  value,
              })
            )
          }
          secureTextEntry={
            !showConfirmPassword
          }
          placeholder="Confirm new password"
          placeholderTextColor="#9BA8AD"
          autoCapitalize="none"
        />

        <Pressable
          onPress={() =>
            setShowConfirmPassword(
              (current) =>
                !current
            )
          }
        >
          <Ionicons
            name={
              showConfirmPassword
                ? "eye-off-outline"
                : "eye-outline"
            }
            size={18}
            color="#82949C"
          />
        </Pressable>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.saveButton,

          savingPassword &&
            styles.saveButtonDisabled,

          pressed &&
            !savingPassword && {
              opacity: 0.8,
            },
        ]}
        disabled={
          savingPassword
        }
        onPress={
          handleChangePassword
        }
      >
        {savingPassword ? (
          <ActivityIndicator
            size="small"
            color="#FFFFFF"
          />
        ) : (
          <Ionicons
            name="shield-checkmark-outline"
            size={19}
            color="#FFFFFF"
          />
        )}

        <Text
          style={
            styles.saveButtonText
          }
        >
          {savingPassword
            ? "Updating..."
            : "Change Password"}
        </Text>
      </Pressable>
    </View>
  </View>
</Modal>

<Modal
  visible={
    notificationVisible
  }
  animationType="slide"
  transparent
  onRequestClose={() =>
    setNotificationVisible(
      false
    )
  }
>
  <View
    style={
      styles.modalBackdrop
    }
  >
    <View
      style={
        styles.modalSheet
      }
    >
      <View
        style={
          styles.modalHandle
        }
      />

      <View
        style={
          styles.modalHeader
        }
      >
        <View>
          <Text
            style={
              styles.modalEyebrow
            }
          >
            NOTIFICATIONS
          </Text>

          <Text
            style={
              styles.modalTitle
            }
          >
            Preferences
          </Text>
        </View>

        <Pressable
          style={
            styles.modalClose
          }
          onPress={() =>
            setNotificationVisible(
              false
            )
          }
        >
          <Ionicons
            name="close"
            size={20}
            color="#17313C"
          />
        </Pressable>
      </View>

      <Text
        style={
          styles.notificationDescription
        }
      >
        Choose which updates you want to receive from BNPL.
      </Text>

      <NotificationToggle
        icon="car-outline"
        title="Booking Updates"
        description="Receive booking acceptance, rejection, cancellation, and status updates."
        value={
          notificationForm.notifyBookingUpdates
        }
        onPress={() =>
          setNotificationForm(
            (current) => ({
              ...current,

              notifyBookingUpdates:
                !current.notifyBookingUpdates,
            })
          )
        }
      />

      <NotificationToggle
        icon="card-outline"
        title="Payment Reminders"
        description="Receive reminders before payment deadlines and overdue notices."
        value={
          notificationForm.notifyPaymentReminders
        }
        onPress={() =>
          setNotificationForm(
            (current) => ({
              ...current,

              notifyPaymentReminders:
                !current.notifyPaymentReminders,
            })
          )
        }
      />

      <NotificationToggle
        icon="document-text-outline"
        title="Invoice & Receipt Updates"
        description="Receive invoice, receipt, and payment confirmation updates."
        value={
          notificationForm.notifyInvoices
        }
        onPress={() =>
          setNotificationForm(
            (current) => ({
              ...current,

              notifyInvoices:
                !current.notifyInvoices,
            })
          )
        }
      />

      <NotificationToggle
        icon="megaphone-outline"
        title="Promotions"
        description="Receive optional promotions and platform announcements."
        value={
          notificationForm.notifyPromotions
        }
        onPress={() =>
          setNotificationForm(
            (current) => ({
              ...current,

              notifyPromotions:
                !current.notifyPromotions,
            })
          )
        }
      />

      <Pressable
        style={({ pressed }) => [
          styles.saveButton,

          savingNotifications &&
            styles.saveButtonDisabled,

          pressed &&
            !savingNotifications && {
              opacity: 0.8,
            },
        ]}
        disabled={
          savingNotifications
        }
        onPress={
          handleSaveNotifications
        }
      >
        {savingNotifications ? (
          <ActivityIndicator
            size="small"
            color="#FFFFFF"
          />
        ) : (
          <Ionicons
            name="checkmark-circle-outline"
            size={19}
            color="#FFFFFF"
          />
        )}

        <Text
          style={
            styles.saveButtonText
          }
        >
          {savingNotifications
            ? "Saving..."
            : "Save Preferences"}
        </Text>
      </Pressable>
    </View>
  </View>
</Modal>

    </SafeAreaView>
  );
}

function ProfileRow({
  icon,
  label,
  value,
}: {
  icon:
    | "person-outline"
    | "mail-outline"
    | "call-outline"
    | "id-card-outline";

  label: string;

  value: string;
}) {
  return (
    <View
      style={
        styles.profileRow
      }
    >
      <View
        style={
          styles.rowIcon
        }
      >
        <Ionicons
          name={icon}
          size={18}
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
            styles.rowLabel
          }
        >
          {label}
        </Text>

        <Text
          style={
            styles.rowValue
          }
          numberOfLines={1}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

function MenuRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon:
  | "notifications-outline"
  | "wallet-outline"
  | "car-outline"
  | "heart-outline"
  | "lock-closed-outline"
  | "settings-outline"
  | "help-circle-outline"
  | "document-text-outline"
  | "shield-checkmark-outline";

  title: string;

  subtitle: string;

  onPress?: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuRow,

        pressed &&
          onPress && {
            opacity: 0.65,
          },
      ]}
      disabled={!onPress}
      onPress={onPress}
    >
      <View
        style={
          styles.rowIcon
        }
      >
        <Ionicons
          name={icon}
          size={19}
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
            styles.menuTitle
          }
        >
          {title}
        </Text>

        <Text
          style={
            styles.menuSubtitle
          }
        >
          {subtitle}
        </Text>
      </View>

      {onPress ? (
        <Ionicons
          name="chevron-forward"
          size={18}
          color="#9AA8AE"
        />
      ) : null}
    </Pressable>
  );
}

function NotificationToggle({
  icon,
  title,
  description,
  value,
  onPress,
}: {
  icon:
    | "car-outline"
    | "card-outline"
    | "document-text-outline"
    | "megaphone-outline";

  title: string;

  description: string;

  value: boolean;

  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.notificationToggle,

        pressed && {
          opacity: 0.75,
        },
      ]}
      onPress={onPress}
    >
      <View
        style={
          styles.notificationToggleIcon
        }
      >
        <Ionicons
          name={icon}
          size={19}
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
            styles.notificationToggleTitle
          }
        >
          {title}
        </Text>

        <Text
          style={
            styles.notificationToggleDescription
          }
        >
          {description}
        </Text>
      </View>

      <View
        style={[
          styles.switchTrack,

          value &&
            styles.switchTrackActive,
        ]}
      >
        <View
          style={[
            styles.switchThumb,

            value &&
              styles.switchThumbActive,
          ]}
        />
      </View>
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

    content: {
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 120,
    },

    header: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",
      marginBottom: 18,
    },

    eyebrow: {
      color: "#07869B",
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1,
    },

    title: {
      marginTop: 4,
      color: "#17313C",
      fontSize: 27,
      fontWeight: "900",
    },

    subtitle: {
      marginTop: 4,
      color: "#81939B",
      fontSize: 11,
    },

    headerIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor:
        "#EAF8FA",
      alignItems: "center",
      justifyContent: "center",
    },

    profileCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      padding: 18,
      borderRadius: 22,
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#E1E8EB",
      marginBottom: 22,
    },

    avatar: {
      width: 68,
      height: 68,
      borderRadius: 23,
      backgroundColor:
        "#07869B",
      alignItems: "center",
      justifyContent: "center",
    },

    avatarText: {
      color: "#FFFFFF",
      fontSize: 22,
      fontWeight: "900",
    },

    profileName: {
      color: "#17313C",
      fontSize: 17,
      fontWeight: "900",
    },

    profileEmail: {
      marginTop: 4,
      color: "#82949C",
      fontSize: 10,
    },

    roleBadge: {
      marginTop: 9,
      alignSelf:
        "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 20,
      backgroundColor:
        "#EAF8FA",
    },

    roleText: {
      color: "#07869B",
      fontSize: 8,
      fontWeight: "900",
    },

    sectionTitle: {
      color: "#17313C",
      fontSize: 13,
      fontWeight: "900",
      marginBottom: 9,
      marginTop: 4,
    },

    sectionCard: {
      backgroundColor:
        "#FFFFFF",
      borderRadius: 18,
      borderWidth: 1,
      borderColor:
        "#E1E8EB",
      paddingHorizontal: 14,
      marginBottom: 20,
    },

    profileRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      minHeight: 66,
    },

    rowIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor:
        "#EAF8FA",
      alignItems: "center",
      justifyContent: "center",
    },

    rowLabel: {
      color: "#8A9AA1",
      fontSize: 8,
      fontWeight: "700",
      textTransform:
        "uppercase",
    },

    rowValue: {
      marginTop: 4,
      color: "#17313C",
      fontSize: 11,
      fontWeight: "800",
    },

    divider: {
      height: 1,
      backgroundColor:
        "#E8EDEF",
    },

    menuRow: {
      minHeight: 70,
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
    },

    menuTitle: {
      color: "#17313C",
      fontSize: 11,
      fontWeight: "900",
    },

    menuSubtitle: {
      marginTop: 3,
      color: "#87989F",
      fontSize: 9,
      lineHeight: 14,
    },

    logoutButton: {
      height: 52,
      borderRadius: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor:
        "#FDEEEE",
      borderWidth: 1,
      borderColor:
        "#F3D3D3",
      marginTop: 2,
    },

    logoutText: {
      color: "#C84242",
      fontSize: 11,
      fontWeight: "900",
    },

    versionText: {
      marginTop: 18,
      textAlign: "center",
      color: "#9BA8AD",
      fontSize: 8,
    },

    editProfileButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 9,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#F2F8F9",
  },

  editProfileText: {
    color: "#07869B",
    fontSize: 8,
    fontWeight: "900",
  },

  avatarWrapper: {
  position: "relative",
},

avatarImage: {
  width: 68,
  height: 68,
  borderRadius: 23,
  backgroundColor: "#EAF8FA",
},

avatarEditButton: {
  position: "absolute",
  right: -5,
  bottom: -5,
  width: 27,
  height: 27,
  borderRadius: 9,
  backgroundColor: "#07869B",
  alignItems: "center",
  justifyContent: "center",
  borderWidth: 2,
  borderColor: "#FFFFFF",
},

modalBackdrop: {
  flex: 1,
  justifyContent: "flex-end",
  backgroundColor:
    "rgba(10, 26, 32, 0.42)",
},

modalSheet: {
  maxHeight: "92%",
  backgroundColor: "#FFFFFF",
  borderTopLeftRadius: 28,
  borderTopRightRadius: 28,
  paddingHorizontal: 20,
  paddingTop: 10,
  paddingBottom: 32,
},

modalHandle: {
  alignSelf: "center",
  width: 44,
  height: 5,
  borderRadius: 10,
  backgroundColor: "#D9E1E4",
  marginBottom: 17,
},

modalHeader: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 20,
},

modalEyebrow: {
  color: "#07869B",
  fontSize: 8,
  fontWeight: "900",
  letterSpacing: 1,
},

modalTitle: {
  marginTop: 4,
  color: "#17313C",
  fontSize: 22,
  fontWeight: "900",
},

modalClose: {
  width: 38,
  height: 38,
  borderRadius: 12,
  backgroundColor: "#F1F5F6",
  alignItems: "center",
  justifyContent: "center",
},

editAvatarSection: {
  alignItems: "center",
  marginBottom: 22,
},

editAvatarImage: {
  width: 96,
  height: 96,
  borderRadius: 31,
  backgroundColor: "#EAF8FA",
},

editAvatarFallback: {
  width: 96,
  height: 96,
  borderRadius: 31,
  backgroundColor: "#07869B",
  alignItems: "center",
  justifyContent: "center",
},

editAvatarText: {
  color: "#FFFFFF",
  fontSize: 30,
  fontWeight: "900",
},

changePhotoButton: {
  marginTop: 12,
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
  paddingHorizontal: 14,
  paddingVertical: 9,
  borderRadius: 12,
  backgroundColor: "#EAF8FA",
},

changePhotoText: {
  color: "#07869B",
  fontSize: 9,
  fontWeight: "900",
},

removePhotoText: {
  marginTop: 9,
  color: "#C84242",
  fontSize: 8,
  fontWeight: "800",
},

inputLabel: {
  marginBottom: 7,
  marginTop: 5,
  color: "#526871",
  fontSize: 9,
  fontWeight: "900",
},

inputContainer: {
  minHeight: 52,
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
  paddingHorizontal: 14,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: "#DCE5E8",
  backgroundColor: "#FFFFFF",
  marginBottom: 15,
},

input: {
  flex: 1,
  color: "#17313C",
  fontSize: 11,
  fontWeight: "700",
},

inputDisabled: {
  backgroundColor: "#F5F7F8",
},

disabledText: {
  flex: 1,
  color: "#7E9098",
  fontSize: 10,
  fontWeight: "700",
},

emailHint: {
  marginTop: -7,
  marginBottom: 15,
  color: "#94A1A7",
  fontSize: 8,
  lineHeight: 12,
},

saveButton: {
  height: 52,
  marginTop: 10,
  borderRadius: 15,
  backgroundColor: "#07869B",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
},

saveButtonDisabled: {
  opacity: 0.6,
},

saveButtonText: {
  color: "#FFFFFF",
  fontSize: 10,
  fontWeight: "900",
},

passwordDescription: {
  color: "#7E9098",
  fontSize: 9,
  lineHeight: 15,
  marginBottom: 18,
  padding: 12,
  borderRadius: 12,
  backgroundColor: "#F5F8F9",
},

notificationDescription: {
  color: "#7E9098",
  fontSize: 9,
  lineHeight: 15,
  marginBottom: 14,
},

notificationToggle: {
  minHeight: 78,
  flexDirection: "row",
  alignItems: "center",
  gap: 11,
  paddingVertical: 12,
  borderBottomWidth: 1,
  borderBottomColor: "#E8EDEF",
},

notificationToggleIcon: {
  width: 40,
  height: 40,
  borderRadius: 13,
  backgroundColor: "#EAF8FA",
  alignItems: "center",
  justifyContent: "center",
},

notificationToggleTitle: {
  color: "#17313C",
  fontSize: 10,
  fontWeight: "900",
},

notificationToggleDescription: {
  marginTop: 3,
  color: "#87989F",
  fontSize: 8,
  lineHeight: 12,
},

switchTrack: {
  width: 44,
  height: 25,
  borderRadius: 20,
  backgroundColor: "#D5DEE1",
  padding: 3,
  justifyContent: "center",
},

switchTrackActive: {
  backgroundColor: "#07869B",
},

switchThumb: {
  width: 19,
  height: 19,
  borderRadius: 10,
  backgroundColor: "#FFFFFF",
  alignSelf: "flex-start",
},

switchThumbActive: {
  alignSelf: "flex-end",
},
  });
