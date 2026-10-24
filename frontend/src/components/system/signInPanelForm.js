// Converting the sign-in panel setting (R6) to and from the admin form.

export const DEFAULT_SIGN_IN_PANEL_FORM = {
  mode: "default",
  imageUrl: "",
  imageAlt: "",
  headline: "",
  linkUrl: "",
  sponsored: false,
  showOn: { customer: true, operator: false },
  startsOn: "",
  endsOn: "",
};

export function signInPanelToForm(panel) {
  const value = panel && typeof panel === "object" ? panel : {};
  return {
    ...DEFAULT_SIGN_IN_PANEL_FORM,
    ...value,
    imageUrl: value.imageUrl || "",
    linkUrl: value.linkUrl || "",
    startsOn: value.startsOn || "",
    endsOn: value.endsOn || "",
    showOn: { ...DEFAULT_SIGN_IN_PANEL_FORM.showOn, ...(value.showOn || {}) },
  };
}

export function signInPanelFromForm(form) {
  return {
    mode: form.mode,
    imageUrl: form.imageUrl || null,
    imageAlt: form.imageAlt.trim(),
    headline: form.headline.trim(),
    linkUrl: form.linkUrl.trim() || null,
    sponsored: Boolean(form.sponsored),
    showOn: { customer: Boolean(form.showOn.customer), operator: Boolean(form.showOn.operator) },
    startsOn: form.startsOn || null,
    endsOn: form.endsOn || null,
  };
}

export function signInPanelSummary(panel) {
  const form = signInPanelToForm(panel);
  if (form.mode !== "image") return { text: "Default animated panel" };
  const until = form.endsOn ? ` until ${form.endsOn}` : "";
  return { text: `Custom image on Sign in and Create account${until}`, tone: "on" };
}
