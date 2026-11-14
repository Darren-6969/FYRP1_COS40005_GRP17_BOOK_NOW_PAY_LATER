import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AccountScreen, SaveError } from "@/components/account/AccountScreen";
import { AppText, Button, FieldError, GlassCard, TextField, useToast } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import { getMe, updateProfile } from "@/services/authApi";
import { getStoredUser, saveStoredUser } from "@/services/session";
import { logger } from "@/utils/logger";
import { normaliseMalaysianPhone } from "@/utils/phone";

/** The server refuses profile images over 1,500,000 characters (auth_controller). */
const MAX_PHOTO_CHARS = 1_450_000;

type Errors = { name?: string; phone?: string; photo?: string };

/** Personal details, pushed from Profile (rule 05b: inline errors, no alerts). */
export default function EditProfileScreen() {
  const router = useRouter();
  const toast = useToast();
  const { tokens } = useTheme();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [photo, setPhoto] = useState("");
  const [email, setEmail] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [saveError, setSaveError] = useState<unknown>(null);

  useEffect(() => {
    let active = true;
    const fill = (user: any) => {
      if (!active || !user) return;
      setName(user.name || "");
      setPhone(user.phone || "");
      setPhoto(user.profileImageUrl || "");
      setEmail(user.email || "");
      setCustomerId(user.userCode || (user.id ? String(user.id) : null));
    };
    (async () => {
      fill(await getStoredUser());
      try {
        const response = await getMe();
        fill(response?.user || response);
      } catch (err) {
        logger.debug("Failed to refresh profile:", err);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const choosePhoto = async () => {
    setErrors((e) => ({ ...e, photo: undefined }));
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setErrors((e) => ({ ...e, photo: "Allow photo access in your phone's settings to choose a profile photo." }));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.base64) {
        setErrors((e) => ({ ...e, photo: "We couldn't read that photo. Please choose another one." }));
        return;
      }
      const dataUrl = `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}`;
      if (dataUrl.length > MAX_PHOTO_CHARS) {
        setErrors((e) => ({ ...e, photo: "This photo is too large. Choose a smaller one or crop it closer." }));
        return;
      }
      setPhoto(dataUrl);
    } catch (err) {
      logger.debug("Profile photo picker failed:", err);
      setErrors((e) => ({ ...e, photo: "We couldn't open your photos. Please try again." }));
    }
  };

  const save = async () => {
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const next: Errors = {};
    if (!trimmedName) next.name = "Enter your full name.";
    const normalisedPhone = trimmedPhone ? normaliseMalaysianPhone(trimmedPhone) : "";
    if (trimmedPhone && !normalisedPhone) next.phone = "Enter a Malaysian mobile number, for example 012-345 6789.";
    setErrors(next);
    setSaveError(null);
    if (next.name || next.phone) return;

    try {
      const response = await updateProfile({
        name: trimmedName,
        phone: normalisedPhone || "",
        profileImageUrl: photo,
      });
      const user = response?.user || response;
      if (user) await saveStoredUser(user);
      toast.show("Profile saved.", { tone: "ok" });
      router.back();
    } catch (err) {
      logger.debug("Failed to update profile:", err);
      setSaveError(err);
    }
  };

  const initials =
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("") || "CU";

  return (
    <AccountScreen title="Personal details" action={<Button label="Save" variant="brand" grow onPress={save} />}>
      <View style={styles.photoBlock}>
        <Pressable
          onPress={choosePhoto}
          accessibilityRole="button"
          accessibilityLabel={photo ? "Change profile photo" : "Add profile photo"}
          style={({ pressed }) => [pressed && { opacity: 0.7 }]}
        >
          {photo ? (
            <Image source={{ uri: photo }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarEmpty, { backgroundColor: tokens.infoBg }]}>
              <AppText variant="title" style={{ color: tokens.infoFg }}>
                {initials}
              </AppText>
            </View>
          )}
          <View style={[styles.camera, { backgroundColor: tokens.brand }]}>
            <Ionicons name="camera-outline" size={16} color={tokens.onBrand} />
          </View>
        </Pressable>
        <View style={styles.photoActions}>
          <Button label={photo ? "Change photo" : "Add photo"} variant="text" size="sm" onPress={choosePhoto} />
          {photo ? <Button label="Remove" variant="text" size="sm" onPress={() => setPhoto("")} /> : null}
        </View>
        <FieldError message={errors.photo} />
      </View>

      <TextField
        label="Full name"
        value={name}
        onChangeText={(v) => {
          setName(v);
          if (errors.name) setErrors((e) => ({ ...e, name: undefined }));
        }}
        error={errors.name}
        placeholder="As on your driving licence"
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        maxLength={120}
      />

      <TextField
        label="Phone number"
        value={phone}
        onChangeText={(v) => {
          setPhone(v);
          if (errors.phone) setErrors((e) => ({ ...e, phone: undefined }));
        }}
        error={errors.phone}
        hint="Operators use this to reach you about a booking."
        placeholder="012-345 6789"
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        maxLength={20}
      />

      <GlassCard>
        <InfoLine label="Email" value={email || "-"} />
        <InfoLine label="Customer ID" value={customerId || "-"} mono divider />
        <AppText variant="caption" style={styles.mt8}>
          To change your email, contact support.
        </AppText>
      </GlassCard>

      <SaveError error={saveError} />
    </AccountScreen>
  );
}

function InfoLine({ label, value, mono, divider }: { label: string; value: string; mono?: boolean; divider?: boolean }) {
  const { tokens } = useTheme();
  return (
    <View
      style={[
        styles.infoLine,
        divider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.line, marginTop: 10, paddingTop: 10 },
      ]}
    >
      <AppText variant="caption" style={styles.flex}>
        {label}
      </AppText>
      <AppText variant={mono ? "mono" : "body"} color="ink" selectable numberOfLines={1} style={styles.value}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  mt8: {
    marginTop: 8,
  },
  photoBlock: {
    alignItems: "center",
    gap: 2,
  },
  photoActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 30,
  },
  avatarEmpty: {
    alignItems: "center",
    justifyContent: "center",
  },
  camera: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  infoLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  value: {
    flexShrink: 1,
  },
});
