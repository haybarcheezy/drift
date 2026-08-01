import React from "react";
import { Pagination as PaginationMeta } from "../types";

interface PaginationProps {
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({
  pagination,
  onPageChange,
}) => {
  const { page, total_pages, total } = pagination;
  if (total === 0) return null;

  return (
    <div className="pagination">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        ← Prev
      </button>
      <span>
        Page {page} of {total_pages} ({total.toLocaleString()} records)
      </span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= total_pages}
        aria-label="Next page"
      >
        Next →
      </button>
    </div>
  );
};

export default Pagination;
