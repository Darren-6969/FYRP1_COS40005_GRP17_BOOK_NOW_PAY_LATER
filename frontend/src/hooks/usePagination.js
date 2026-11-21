import { useMemo, useState } from "react";

// Splits a list into pages on the client. The customer lists (payments,
// invoices, notifications) are loaded whole, so this only limits how many
// are shown at once. `resetKey` (for example the search text and filter)
// sends the list back to page 1 when it changes.
export function usePagination(items, pageSize = 10, resetKey = "") {
  const [state, setState] = useState({ page: 1, key: resetKey });

  // Back to page 1 when the filters change (set during render, the
  // React-recommended way to reset state from props).
  if (state.key !== resetKey) {
    setState({ page: 1, key: resetKey });
  }

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(state.page, totalPages);

  const pageItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize]
  );

  return {
    page,
    totalPages,
    total,
    pageItems,
    start: total ? (page - 1) * pageSize + 1 : 0,
    end: Math.min(page * pageSize, total),
    setPage: (next) =>
      setState((previous) => ({
        ...previous,
        page: Math.min(Math.max(1, next), totalPages),
      })),
  };
}
