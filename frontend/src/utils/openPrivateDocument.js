// Open a private document (licence, IDP) fetched as a blob in a new tab.
// The object URL is revoked after a minute so the file does not linger.
export async function openPrivateDocument(fetchBlob) {
  // Open the tab first so the browser does not treat it as a pop-up
  // opened after an await.
  const tab = window.open("", "_blank");
  try {
    const response = await fetchBlob();
    const url = URL.createObjectURL(response.data);
    if (tab) {
      tab.location.href = url;
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (err) {
    tab?.close();
    throw err;
  }
}
