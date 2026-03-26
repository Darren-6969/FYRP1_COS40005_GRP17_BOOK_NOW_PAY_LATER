import React, { useState, useEffect } from 'react';
import { FaAngleLeft, FaAngleRight, FaSortUp, FaSortDown } from 'react-icons/fa';
import './PaginatedTable.css';

const PaginatedTable = ({ data = [], columns = [], rowsPerPage = 5, rowKey, enableCheckbox = false }) => {
  const [currentPage, setCurrentPage] = useState(1);
  // Set the initial sort configuration to sort by 'id' in descending order
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'desc' });
  const [selectedRows, setSelectedRows] = useState([]);

  // SAFETY CHECK: Ensure data is always treated as an array to prevent crashes
  const safeData = Array.isArray(data) ? data : [];
  const safeColumns = Array.isArray(columns) ? columns : [];

  const totalPages = Math.ceil(safeData.length / rowsPerPage) || 1;

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const getPageNumbers = () => {
    const pageNumbers = [];
    pageNumbers.push(1);
    if (currentPage > 3) {
      pageNumbers.push("...");
    }
    const startPage = Math.max(2, currentPage - 1);
    const endPage = Math.min(totalPages - 1, currentPage + 1);
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }
    if (currentPage < totalPages - 2) {
      pageNumbers.push("...");
    }
    if (totalPages > 1) {
      pageNumbers.push(totalPages);
    }
    return [...new Set(pageNumbers)];
  };

  const sortedData = [...safeData].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const aValue = a ? a[sortConfig.key] : undefined;
    const bValue = b ? b[sortConfig.key] : undefined;
    if (aValue === bValue) return 0;
    return (aValue < bValue ? -1 : 1) * (sortConfig.direction === 'asc' ? 1 : -1);
  });

  const paginatedData = sortedData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      setSelectedRows(paginatedData.map((row) => row[rowKey]));
    } else {
      setSelectedRows([]);
    }
  };

  const handleSelectRow = (row) => {
    if (!row || !row[rowKey]) return;
    setSelectedRows((prevSelectedRows) =>
      prevSelectedRows.includes(row[rowKey])
        ? prevSelectedRows.filter((id) => id !== row[rowKey])
        : [...prevSelectedRows, row[rowKey]]
    );
  };

  // The dangerous useEffect that caused the infinite loop freeze was safely removed here, 
  // because sortConfig already sets 'id' and 'desc' on line 8!

  return (
    <div className="paginated-table">
      <table className="styled-table">
        <thead>
          <tr>
            {enableCheckbox && (
              <th>
                <input
                  type="checkbox"
                  checked={
                    paginatedData.length > 0 &&
                    paginatedData.every((row) => selectedRows.includes(row[rowKey]))
                  }
                  onChange={handleSelectAll}
                />
              </th>
            )}
            {safeColumns.map((column, index) => (
              <th key={index} onClick={() => handleSort(column.accessor)} style={{ cursor: 'pointer' }}>
                {column.header}
                {sortConfig.key === column.accessor && (
                  <span className="sort-icon">
                    {sortConfig.direction === 'asc' ? <FaSortUp /> : <FaSortDown />}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paginatedData.length > 0 ? (
            paginatedData.map((row, rowIndex) => (
              <tr key={row ? row[rowKey] : rowIndex}>
                {enableCheckbox && (
                  <td>
                    <input
                      type="checkbox"
                      checked={row && selectedRows.includes(row[rowKey])}
                      onChange={() => handleSelectRow(row)}
                    />
                  </td>
                )}
                {safeColumns.map((column, colIndex) => (
                  <td key={colIndex}>
                    {column.render ? column.render(row, rowIndex) : (row && row[column.accessor] ? row[column.accessor] : "N/A")}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={safeColumns.length + (enableCheckbox ? 1 : 0)} style={{ textAlign: 'center' }}>
                No data found
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <FaAngleLeft />
          </button>

          {getPageNumbers().map((page, index) =>
            page === "..." ? (
              <span key={index} className="ellipsis">...</span>
            ) : (
              <button
                key={index}
                className={currentPage === page ? 'active' : ''}
                onClick={() => handlePageChange(page)}
              >
                {page}
              </button>
            )
          )}

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            <FaAngleRight />
          </button>
        </div>
      )}
    </div>
  );
};

export default PaginatedTable;