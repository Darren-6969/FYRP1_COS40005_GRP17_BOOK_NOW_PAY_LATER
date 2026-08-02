// postMessage bridge to the host page that embedded this iframe.
// Target is pinned to the host page's origin (from document.referrer).

function parentOrigin() {
  try {
    const fromQuery = new URLSearchParams(window.location.search).get("host");
    if (fromQuery) return new URL(fromQuery).origin;
  } catch {}
  try {
    return new URL(document.referrer).origin;
  } catch {
    return null;
  }
}

export function postToHost(type, payload = {}) {
  const target = parentOrigin();
  if (target && window.parent && window.parent !== window) {
    window.parent.postMessage({ source: "bnpl", type, ...payload }, target);
  }
}

// Keeps the modal sized to the content (desktop).
export function startAutoResize() {
  const send = () =>
    postToHost("bnpl:resize", { height: document.body.scrollHeight });
  send();
  const ro = new ResizeObserver(send);
  ro.observe(document.body);
  return () => ro.disconnect();
}