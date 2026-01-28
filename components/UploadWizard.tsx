"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { useChunkedUpload } from "@/hooks/useChunkedUpload"

function formatBytes(n: number) {
  const units = ["B", "KB", "MB", "GB"]
  let i = 0
  let x = n
  while (x >= 1024 && i < units.length - 1) {
    x /= 1024
    i++
  }
  return `${x.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export default function UploadWizard() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)

  const {
    status,
    progress,
    error,
    start,
    cancel,
    reset,
    sessionId,
  } = useChunkedUpload()

  const canStart = !!file && (status === "idle" || status === "error" || status === "canceled" || status === "done")
  const isBusy = status === "uploading" || status === "finalizing"

  const fileInfo = useMemo(() => {
    if (!file) return null
    return `${file.name} • ${formatBytes(file.size)}`
  }, [file])

  return (
    <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={isBusy}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <div style={{ color: "#444" }}>{fileInfo ?? "Choose a CSV (10–100MB is fine)."}</div>
      </div>

      <div style={{ height: 12 }} />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={() => file && start(file)}
          disabled={!canStart}
          style={{ padding: "8px 12px", borderRadius: 10 }}
        >
          Start upload
        </button>

        <button
          onClick={() => cancel()}
          disabled={!isBusy}
          style={{ padding: "8px 12px", borderRadius: 10 }}
        >
          Cancel
        </button>

        <button
          onClick={() => { reset(); setFile(null) }}
          style={{ padding: "8px 12px", borderRadius: 10 }}
        >
          Reset
        </button>

        <button
          onClick={() => router.push(`/preview?sessionId=${encodeURIComponent(sessionId ?? "")}`)}
          disabled={!sessionId || status !== "done"}
          style={{ padding: "8px 12px", borderRadius: 10 }}
        >
          Go to preview
        </button>
      </div>

      <div style={{ height: 14 }} />

      <div style={{ fontSize: 13, color: "#555" }}>
        <div>Status: <b>{status}</b>{sessionId ? ` (session ${sessionId.slice(0, 8)}…)` : ""}</div>
        <div>Progress: <b>{Math.round(progress * 100)}%</b></div>
      </div>

      <div style={{ height: 10 }} />

      <div style={{ background: "#f2f2f2", borderRadius: 999, height: 10, overflow: "hidden" }}>
        <div style={{ width: `${Math.round(progress * 100)}%`, height: "100%", background: "#111" }} />
      </div>

      {error && (
        <div style={{ marginTop: 12, color: "#b00020", fontSize: 13 }}>
          Error: {error}
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
        Note: This starter uses basic sequential chunk uploads. Candidates can improve retries/resume/UX states.
      </div>
    </div>
  )
}

