import { useEffect, useState } from "react";
import { getSupportTicketCounts } from "../services/support_service";

const POLL_MS = 60 * 1000;

// Open and overdue chat requests for the signed-in operator or admin, for
// the menu badge (Step 9). Refreshed every minute; a failure just hides it.
export function useSupportCounts() {
  const [counts, setCounts] = useState({ open: 0, overdue: 0 });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await getSupportTicketCounts();
        if (!cancelled) setCounts({ open: data.open || 0, overdue: data.overdue || 0 });
      } catch {
        if (!cancelled) setCounts({ open: 0, overdue: 0 });
      }
    };
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return counts;
}
