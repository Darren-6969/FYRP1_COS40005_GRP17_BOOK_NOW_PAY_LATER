import { ChevronLeft, ChevronRight } from "lucide-react";

import "../../assets/styles/customer-lists.css";

// Page numbers to show: always the first and last, the current page and
// its neighbours, with "..." for the gaps. 1 ... 4 5 6 ... 12
function pageNumbers(page, totalPages) {
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);

  const result = [];
  sorted.forEach((n, index) => {
    if (index > 0 && n - sorted[index - 1] > 1) result.push(`gap-${n}`);
    result.push(n);
  });
  return result;
}

export default function ListPagination({
  pagination,
  label = "items",
  listId,
}) {
  const { page, totalPages, total, start, end, setPage } = pagination;

  if (total <= 0) return null;

  const goTo = (next) => {
    setPage(next);
    // Back to the top of the list, so the new page starts where the eye is.
    if (listId) {
      document.getElementById(listId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <nav className="list-pagination" aria-label={`${label} pages`}>
      <p className="list-pagination-summary">
        Showing {start}-{end} of {total} {label}
      </p>

      {totalPages > 1 && (
        <div className="list-pagination-buttons">
          <button
            type="button"
            className="list-pagination-btn"
            onClick={() => goTo(page - 1)}
            disabled={page === 1}
            aria-label="Previous page"
          >
            <ChevronLeft size={16} aria-hidden="true" />
            <span className="list-pagination-word">Previous</span>
          </button>

          {pageNumbers(page, totalPages).map((item) =>
            typeof item === "string" ? (
              <span key={item} className="list-pagination-gap" aria-hidden="true">
                ...
              </span>
            ) : (
              <button
                key={item}
                type="button"
                className={`list-pagination-btn number ${item === page ? "current" : ""}`}
                onClick={() => goTo(item)}
                aria-label={`Page ${item}`}
                aria-current={item === page ? "page" : undefined}
              >
                {item}
              </button>
            )
          )}

          <button
            type="button"
            className="list-pagination-btn"
            onClick={() => goTo(page + 1)}
            disabled={page === totalPages}
            aria-label="Next page"
          >
            <span className="list-pagination-word">Next</span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </nav>
  );
}
