import { useRef, useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { uploadSignInPanelImage } from "../../services/admin_service";
import { FormField, SettingsSection } from "./SettingsParts";

const choiceStyle = (active) => ({
  textAlign: "left",
  display: "grid",
  gap: 4,
  padding: "14px 16px",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  color: "#0f172a",
  boxShadow: active ? "0 0 0 2px #2563eb" : "none",
  cursor: "pointer",
});

// The panel beside Sign in and Create account. "Default" keeps the animated
// illustration; "Custom image" swaps in an uploaded image for one of the
// platform's own promotions. Password pages and operator register always keep
// their own panel, and there are no third-party adverts beside a password.
export default function SignInPanelSettings({ value, onChange, notify }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const set = (patch) => onChange({ ...value, ...patch });

  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadSignInPanelImage(file);
      set({ imageUrl: res.data?.url || "" });
      notify("success", "Image uploaded. Save changes to put it live.");
    } catch (err) {
      notify("danger", err.response?.data?.message || "Failed to upload the image.");
    } finally {
      setUploading(false);
    }
  };

  const custom = value.mode === "image";

  // A radio group moves with the arrow keys, and only the chosen option is a
  // tab stop.
  const onRadioKey = (event) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const next = custom ? "default" : "image";
    set({ mode: next });
    event.currentTarget.parentElement?.querySelector(`[data-mode="${next}"]`)?.focus();
  };

  return (
    <SettingsSection
      icon={<ImageIcon size={20} />}
      title="Sign-in Panel"
      description="The panel beside Sign in and Create account. Password pages and operator register always show their own panel. Outside the dates below, or with no image, the default animated panel shows."
    >
      <div className="admin-settings-stack">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }} role="radiogroup" aria-label="Panel content">
          <button
            type="button"
            role="radio"
            data-mode="default"
            aria-checked={!custom}
            tabIndex={custom ? -1 : 0}
            style={choiceStyle(!custom)}
            onClick={() => set({ mode: "default" })}
            onKeyDown={onRadioKey}
          >
            <strong>Default illustration</strong>
            <span style={{ fontSize: 13, color: "#475569" }}>The road panel and how paying later works.</span>
          </button>
          <button
            type="button"
            role="radio"
            data-mode="image"
            aria-checked={custom}
            tabIndex={custom ? 0 : -1}
            style={choiceStyle(custom)}
            onClick={() => set({ mode: "image" })}
            onKeyDown={onRadioKey}
          >
            <strong>Custom image</strong>
            <span style={{ fontSize: 13, color: "#475569" }}>An uploaded image for one of our own promotions.</span>
          </button>
        </div>

        {custom && (
          <>
            <div className="admin-settings-subcard" style={{ display: "grid", gridTemplateColumns: "120px minmax(0, 1fr)", gap: 16, alignItems: "center" }}>
              <div
                style={{
                  width: 120,
                  height: 150,
                  borderRadius: 8,
                  overflow: "hidden",
                  background: "repeating-linear-gradient(135deg, #e2e8f0 0 10px, #f1f5f9 10px 20px)",
                }}
              >
                {value.imageUrl && <img src={value.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
              </div>
              <div style={{ display: "grid", gap: 8, justifyItems: "start" }}>
                <strong>Background image</strong>
                <small style={{ color: "#475569" }}>
                  JPG, PNG or WebP, portrait, at least 1200 × 1600 px, up to 5 MB. Keep the lower third calm: the headline sits there.
                </small>
                <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp" onChange={upload} hidden />
                <button type="button" className="operator-secondary-btn" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  {uploading ? "Uploading..." : value.imageUrl ? "Replace image" : "Upload image"}
                </button>
              </div>
            </div>

            <div className="operator-settings-form-grid">
              <FormField wide label="Image description" helper="Read out by screen readers. Describe what the image shows.">
                <input value={value.imageAlt} onChange={(e) => set({ imageAlt: e.target.value })} maxLength={200} />
              </FormField>

              <FormField label={`Headline (optional, ${value.headline.length}/60)`}>
                <input value={value.headline} onChange={(e) => set({ headline: e.target.value })} maxLength={60} />
              </FormField>

              <FormField label="Link (optional)" helper="Adds a Learn more button. A page on this site, like /cars, or an https address (opens in a new tab).">
                <input value={value.linkUrl} onChange={(e) => set({ linkUrl: e.target.value })} placeholder="/cars or https://" />
              </FormField>

              <FormField label="Show from (optional)">
                <input type="date" value={value.startsOn} onChange={(e) => set({ startsOn: e.target.value })} />
              </FormField>

              <FormField label="Show until (optional)" helper="Malaysian dates. Outside them the default panel shows.">
                <input type="date" value={value.endsOn} onChange={(e) => set({ endsOn: e.target.value })} />
              </FormField>
            </div>

          </>
        )}
      </div>
    </SettingsSection>
  );
}
