"use client"

import { useEffect, useMemo, useState } from "react"
import type { PreviewResponse } from "@/lib/types"

export default function DataPreviewTable() {
  const [data, setData] = useState<PreviewResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sessionId = useMemo(() => {
    if (typeof window === "undefined") return null
    const sp = new URLSearchParams(window.location.search)
    return sp.get("sessionId")
  }, [])

  useEffect(() => {
    if (!sessionId) return
    ;(async () => {
      setError(null)
      setData(null)
      const res = await fetch(`/api/upload/finalize?sessionId=${encodeURIComponent(sessionId)}`, { method: "GET" })
      if (!res.ok) {
        setError(`Failed to load preview (${res.status})`)
        return
      }
      const json = (await res.json()) as PreviewResponse
      setData(json)
    })()
  }, [sessionId])

  if (!sessionId) return <div style={{ color: "#666" }}>Missing sessionId. Upload first, then click “Go to preview”.</div>
  if (error) return <div style={{ color: "#b00020" }}>{error}</div>
  if (!data) return <div style={{ color: "#666" }}>Loading preview…</div>

  const { columns, types, rows } = data.preview

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 12 }}>
        <div style={{ fontWeight: 650, marginBottom: 6 }}>Columns</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {columns.map((c) => (
            <span key={c} style={{ padding: "4px 8px", borderRadius: 999, background: "#f3f3f3", fontSize: 12 }}>
              <b>{c}</b> <span style={{ color: "#666" }}>({types[c] ?? "unknown"})</span>
            </span>
          ))}
        </div>
      </div>

      <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 12 }}>
        <div style={{ fontWeight: 650, marginBottom: 8 }}>Rows (preview)</div>

        <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #eee" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c} style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={idx}>
                  {columns.map((c) => (
                    <td key={c} style={{ padding: 8, borderBottom: "1px solid #f3f3f3", whiteSpace: "nowrap" }}>
                      {String(r[c] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
          Showing {rows.length} rows. Wide datasets scroll horizontally.
        </div>
      </div>
    </div>
  )
}

