// Ask the layout's notification hook to refetch immediately (post-action snappiness).
export function refreshNotifications() {
  window.dispatchEvent(new Event("bnpl:refresh-notifications"));
}