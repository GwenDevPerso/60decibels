"use client";

import {useEffect, useMemo, useState} from "react";
import type {PreviewResponse} from "@/lib/types";
import {detectSchemaIssues, type SchemaIssue} from "@/lib/schema-detection";
import styles from "./DataPreviewTable.module.css";

/**
 * Number of columns to show by default
 */
const DEFAULT_VISIBLE_COLUMNS = 10;

/**
 * Number of rows per page for pagination
 */
const ROWS_PER_PAGE = 20;

/**
 * Minimum number of columns required to enable sticky first column
 */
const MIN_COLUMNS_FOR_STICKY = 10;

/**
 * Main component for displaying CSV preview data with enhanced features:
 * - Schema issue detection and display
 * - Column limiting for wide datasets
 * - Sticky columns during horizontal scroll
 * - Pagination for large row sets
 */
export default function DataPreviewTable() {
  const [data, setData] = useState<PreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllColumns, setShowAllColumns] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionIdExtracted, setSessionIdExtracted] = useState(false);

  /**
   * Extracts sessionId from URL query parameters after component mounts
   * This ensures consistent server/client rendering to avoid hydration errors
   */
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setSessionId(sp.get("sessionId"));
    setSessionIdExtracted(true);
  }, []);

  /**
   * Fetches preview data from the API
   */
  useEffect(() => {
    if (!sessionId) return;
    ; (async () => {
      setError(null);
      setData(null);
      const res = await fetch(`/api/upload/finalize?sessionId=${encodeURIComponent(sessionId)}`, {method: "GET"});
      if (!res.ok) {
        setError(`Failed to load preview (${res.status})`);
        return;
      }
      const json = (await res.json()) as PreviewResponse;
      setData(json);
    })();
  }, [sessionId]);

  // Extract columns, types, and rows safely (with defaults for when data is not loaded)
  const columns = data?.preview.columns ?? [];
  const types = data?.preview.types ?? {};
  const rows = data?.preview.rows ?? [];

  // Detect schema issues (only when data is available)
  const schemaIssues = useMemo(() => {
    if (columns.length === 0 || rows.length === 0) return [];
    return detectSchemaIssues(columns, types, rows);
  }, [columns, types, rows]);

  // Determine visible columns
  const visibleColumns = useMemo(() => {
    if (columns.length === 0) return [];
    return showAllColumns ? columns : columns.slice(0, DEFAULT_VISIBLE_COLUMNS);
  }, [columns, showAllColumns]);

  const hasMoreColumns = columns.length > visibleColumns.length;

  // Pagination calculations
  const totalPages = Math.ceil(rows.length / ROWS_PER_PAGE);
  const startRow = (currentPage - 1) * ROWS_PER_PAGE;
  const endRow = startRow + ROWS_PER_PAGE;
  const paginatedRows = rows.slice(startRow, endRow);

  // Reset to first page when data changes
  useEffect(() => {
    if (data) {
      setCurrentPage(1);
    }
  }, [data]);

  // Show loading state while extracting sessionId to avoid hydration mismatch
  if (!sessionIdExtracted) return <div className={styles.loading}>Loading preview…</div>;
  if (!sessionId) return <div className={styles.loading}>Missing sessionId. Upload first, then click "Go to preview".</div>;
  if (error) return <div className={styles.error}>{error}</div>;
  if (!data) return <div className={styles.loading}>Loading preview…</div>;

  return (
    <div id="data-preview-table" className={styles.container}>
      {/* Schema Issues Panel */}
      {schemaIssues.length > 0 && (
        <div className={styles.schemaIssuesPanel}>
          <div className={styles.schemaIssuesHeader}>
            <span>⚠️</span>
            <span>Schema Issues Detected ({schemaIssues.length})</span>
          </div>
          <div className={styles.schemaIssuesList}>
            {schemaIssues.map((issue, idx) => (
              <SchemaIssueItem key={idx} issue={issue} />
            ))}
          </div>
        </div>
      )}

      {/* Columns Overview */}
      <div className={styles.columnsPanel}>
        <div className={styles.columnsHeader}>
          <span>Columns ({columns.length})</span>
          {columns.length > DEFAULT_VISIBLE_COLUMNS && (
            <button
              onClick={() => setShowAllColumns(!showAllColumns)}
              className={styles.columnsToggleButton}
            >
              {showAllColumns ? `Show first ${DEFAULT_VISIBLE_COLUMNS}` : `Show all ${columns.length}`}
            </button>
          )}
        </div>
        <div className={styles.columnsList}>
          {visibleColumns.map((c) => (
            <span key={c} className={styles.columnTag}>
              <b>{c}</b> <span className={styles.columnTagType}>({types[c] ?? "unknown"})</span>
            </span>
          ))}
          {hasMoreColumns && !showAllColumns && (
            <span className={styles.columnTagMore}>
              +{columns.length - DEFAULT_VISIBLE_COLUMNS} more
            </span>
          )}
        </div>
      </div>

      {/* Table View */}
      <TableView
        visibleColumns={visibleColumns}
        types={types}
        rows={paginatedRows}
        stickyColumns={visibleColumns.length > MIN_COLUMNS_FOR_STICKY ? 1 : 0}
      />

      {/* Pagination Controls */}
      {rows.length > ROWS_PER_PAGE && (
        <div className={styles.pagination}>
          <div className={styles.paginationInfo}>
            Showing {startRow + 1}-{Math.min(endRow, rows.length)} of {rows.length} rows
          </div>
          <div className={styles.paginationControls}>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={styles.paginationButton}
            >
              Previous
            </button>
            <span className={styles.paginationPageInfo}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={styles.paginationButton}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Displays a single schema issue with appropriate styling
 */
function SchemaIssueItem({issue}: {issue: SchemaIssue;}) {
  const isError = issue.severity === "error";

  return (
    <div className={`${styles.schemaIssueItem} ${isError ? styles.schemaIssueItemError : styles.schemaIssueItemWarning}`}>
      <div className={`${styles.schemaIssueHeader} ${isError ? styles.schemaIssueHeaderError : styles.schemaIssueHeaderWarning}`}>
        <span className={styles.schemaIssueIcon}>{isError ? "❌" : "⚠️"}</span>
        <span className={styles.schemaIssueColumn}>{issue.column}</span>: {issue.message}
      </div>
      {issue.details && <div className={styles.schemaIssueDetails}>{issue.details}</div>}
    </div>
  );
}

/**
 * Table view component with sticky columns support
 */
function TableView({
  visibleColumns,
  types,
  rows,
  stickyColumns,
}: {
  visibleColumns: string[];
  types: Record<string, string>;
  rows: Array<Record<string, string>>;
  stickyColumns: number;
}) {
  // Determine if this is a small dataset (no sticky columns needed)
  // For small datasets, columns should fill the table width
  // For large datasets, use fixed widths to enable horizontal scroll
  const isSmallDataset = visibleColumns.length <= MIN_COLUMNS_FOR_STICKY;

  // Calculate minimum table width only for large datasets
  const minTableWidth = isSmallDataset
    ? undefined
    : stickyColumns > 0
      ? stickyColumns * 150 + (visibleColumns.length - stickyColumns) * 120
      : visibleColumns.length * 120;

  return (
    <div className={styles.tablePanel}>
      <div className={styles.tableHeader}>Rows (preview)</div>

      <div className={`${styles.tableContainer} ${isSmallDataset ? styles.tableContainerSmall : ""}`}>
        <table
          className={`${styles.table} ${isSmallDataset ? styles.tableSmall : styles.tableLarge}`}
          style={!isSmallDataset && minTableWidth ? {minWidth: `${Math.max(minTableWidth, 800)}px`} : undefined}
        >
          <thead>
            <tr>
              {visibleColumns.map((c, idx) => {
                const isSticky = stickyColumns > 0 && idx < stickyColumns;
                return (
                  <th
                    key={c}
                    className={`${styles.tableHeaderCell} ${isSticky ? styles.tableHeaderCellSticky : ""} ${isSmallDataset ? styles.tableHeaderCellSmall : isSticky ? styles.tableHeaderCellLarge : styles.tableHeaderCellLargeNotSticky}`}
                  >
                    {c}
                    <span className={styles.tableHeaderType}>
                      ({types[c] ?? "unknown"})
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, rowIdx) => (
              <tr key={rowIdx}>
                {visibleColumns.map((c, colIdx) => {
                  const isSticky = stickyColumns > 0 && colIdx < stickyColumns;
                  return (
                    <td
                      key={c}
                      className={`${styles.tableCell} ${isSticky ? styles.tableCellSticky : ""} ${isSmallDataset ? styles.tableCellSmall : isSticky ? styles.tableCellLarge : styles.tableCellLargeNotSticky}`}
                    >
                      {String(r[c] ?? "")}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

