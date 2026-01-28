"use client";

import {useEffect, useMemo, useState} from "react";
import type {PreviewResponse} from "@/lib/types";
import {detectSchemaIssues, type SchemaIssue} from "@/lib/schema-detection";

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
  if (!sessionIdExtracted) return <div style={{color: "#666"}}>Loading preview…</div>;
  if (!sessionId) return <div style={{color: "#666"}}>Missing sessionId. Upload first, then click "Go to preview".</div>;
  if (error) return <div style={{color: "#b00020"}}>{error}</div>;
  if (!data) return <div style={{color: "#666"}}>Loading preview…</div>;

  return (
    <div
      id="data-preview-table"
      style={{
        display: "grid",
        gap: 14,
        width: "100%",
        maxWidth: "100%",
        overflow: "hidden",
      }}
    >
      {/* Schema Issues Panel */}
      {schemaIssues.length > 0 && (
        <div
          style={{
            border: "1px solid #ffa726",
            borderRadius: 12,
            padding: 12,
            background: "#fff3e0",
            width: "100%",
            maxWidth: "100%",
            overflow: "hidden",
          }}
        >
          <div style={{fontWeight: 650, marginBottom: 8, display: "flex", alignItems: "center", gap: 6}}>
            <span>⚠️</span>
            <span>Schema Issues Detected ({schemaIssues.length})</span>
          </div>
          <div style={{display: "flex", flexDirection: "column", gap: 6}}>
            {schemaIssues.map((issue, idx) => (
              <SchemaIssueItem key={idx} issue={issue} />
            ))}
          </div>
        </div>
      )}

      {/* Columns Overview */}
      <div style={{border: "1px solid #e5e5e5", borderRadius: 12, padding: 12, maxWidth: "100%", overflow: "hidden"}}>
        <div style={{fontWeight: 650, marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center"}}>
          <span>Columns ({columns.length})</span>
          {hasMoreColumns && (
            <button
              onClick={() => setShowAllColumns(!showAllColumns)}
              style={{
                padding: "4px 8px",
                borderRadius: 4,
                border: "1px solid #e5e5e5",
                background: "white",
                cursor: "pointer",
                fontSize: 11,
              }}
            >
              {showAllColumns ? `Show first ${DEFAULT_VISIBLE_COLUMNS}` : `Show all ${columns.length}`}
            </button>
          )}
        </div>
        <div style={{display: "flex", flexWrap: "wrap", gap: 8, width: "100%", maxWidth: "100%"}}>
          {visibleColumns.map((c) => (
            <span key={c} style={{padding: "4px 8px", borderRadius: 999, background: "#f3f3f3", fontSize: 12}}>
              <b>{c}</b> <span style={{color: "#666"}}>({types[c] ?? "unknown"})</span>
            </span>
          ))}
          {hasMoreColumns && !showAllColumns && (
            <span style={{padding: "4px 8px", borderRadius: 999, background: "#e3f2fd", fontSize: 12, color: "#1976d2"}}>
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
        <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12}}>
          <div style={{color: "#666"}}>
            Showing {startRow + 1}-{Math.min(endRow, rows.length)} of {rows.length} rows
          </div>
          <div style={{display: "flex", gap: 8}}>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{
                padding: "4px 12px",
                borderRadius: 4,
                border: "1px solid #e5e5e5",
                background: currentPage === 1 ? "#f5f5f5" : "white",
                cursor: currentPage === 1 ? "not-allowed" : "pointer",
                opacity: currentPage === 1 ? 0.5 : 1,
              }}
            >
              Previous
            </button>
            <span style={{padding: "4px 8px", color: "#666"}}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{
                padding: "4px 12px",
                borderRadius: 4,
                border: "1px solid #e5e5e5",
                background: currentPage === totalPages ? "#f5f5f5" : "white",
                cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                opacity: currentPage === totalPages ? 0.5 : 1,
              }}
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
  const severityColors = {
    error: {bg: "#ffebee", border: "#e57373", text: "#c62828"},
    warning: {bg: "#fff3e0", border: "#ffb74d", text: "#e65100"},
  };
  const colors = severityColors[issue.severity];

  return (
    <div
      style={{
        padding: 8,
        borderRadius: 6,
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        fontSize: 12,
      }}
    >
      <div style={{fontWeight: 600, color: colors.text}}>
        <span style={{marginRight: 4}}>{issue.severity === "error" ? "❌" : "⚠️"}</span>
        <span style={{fontWeight: 600}}>{issue.column}</span>: {issue.message}
      </div>
      {issue.details && <div style={{marginTop: 4, color: "#666", fontSize: 11}}>{issue.details}</div>}
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
    <div style={{border: "1px solid #e5e5e5", borderRadius: 12, padding: 12, maxWidth: "100%", overflow: "hidden"}}>
      <div style={{fontWeight: 650, marginBottom: 8}}>Rows (preview)</div>

      <div
        style={{
          overflowX: isSmallDataset ? "hidden" : "auto",
          overflowY: "visible",
          borderRadius: 10,
          border: "1px solid #eee",
          position: "relative",
          width: "100%",
          maxWidth: "100%",
        }}
      >
        <table
          style={{
            borderCollapse: "collapse",
            width: isSmallDataset ? "100%" : undefined,
            minWidth: isSmallDataset ? undefined : `${Math.max(minTableWidth ?? 800, 800)}px`,
            fontSize: 12,
            tableLayout: isSmallDataset ? "auto" : "fixed",
          }}
        >
          <thead>
            <tr>
              {visibleColumns.map((c, idx) => {
                const isSticky = stickyColumns > 0 && idx < stickyColumns;
                return (
                  <th
                    key={c}
                    style={{
                      textAlign: "left",
                      padding: 8,
                      borderBottom: "1px solid #eee",
                      whiteSpace: "nowrap",
                      position: isSticky ? ("sticky" as const) : "static",
                      left: isSticky ? 0 : "auto",
                      background: isSticky ? "white" : "transparent",
                      zIndex: isSticky ? 10 : 1,
                      boxShadow: isSticky ? "2px 0 4px rgba(0,0,0,0.1)" : "none",
                      minWidth: isSmallDataset ? undefined : isSticky ? 150 : 120,
                      width: isSmallDataset ? "auto" : undefined,
                    }}
                  >
                    {c}
                    <span style={{marginLeft: 4, color: "#999", fontWeight: 400, fontSize: 10}}>
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
                      style={{
                        padding: 8,
                        borderBottom: "1px solid #f3f3f3",
                        whiteSpace: "nowrap",
                        position: isSticky ? ("sticky" as const) : "static",
                        left: isSticky ? 0 : "auto",
                        background: isSticky ? "white" : "transparent",
                        zIndex: isSticky ? 10 : 1,
                        boxShadow: isSticky ? "2px 0 4px rgba(0,0,0,0.1)" : "none",
                        minWidth: isSmallDataset ? undefined : isSticky ? 150 : 120,
                        maxWidth: isSmallDataset ? undefined : isSticky ? 150 : "none",
                        width: isSmallDataset ? "auto" : undefined,
                        overflow: isSticky ? "hidden" : "visible",
                        textOverflow: isSticky ? "ellipsis" : "clip",
                      }}
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

