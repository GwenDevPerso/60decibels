"use client"

import { useCallback, useRef, useState } from "react"
import type { UploadInitResponse } from "@/lib/types"

type Status = "idle" | "uploading" | "finalizing" | "done" | "error" | "canceled"

const DEFAULT_CHUNK_BYTES = 1024 * 1024 // 1MB

export function useChunkedUpload() {
  const [status, setStatus] = useState<Status>("idle")
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setStatus("idle")
    setProgress(0)
    setError(null)
    setSessionId(null)
  }, [])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setStatus("canceled")
  }, [])

  const start = useCallback(async (file: File) => {
    setError(null)
    setProgress(0)
    setStatus("uploading")

    const abort = new AbortController()
    abortRef.current = abort

    try {
      // init
      const initRes = await fetch("/api/upload/init", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filename: file.name, size: file.size }),
        signal: abort.signal,
      })
      if (!initRes.ok) throw new Error(`init failed (${initRes.status})`)
      const initJson = (await initRes.json()) as UploadInitResponse
      setSessionId(initJson.sessionId)
      localStorage.setItem("lastSessionId", initJson.sessionId)

      const chunkSize = DEFAULT_CHUNK_BYTES
      const totalChunks = Math.ceil(file.size / chunkSize)

      // sequential chunks (simple baseline)
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const startByte = chunkIndex * chunkSize
        const endByte = Math.min(startByte + chunkSize, file.size)
        const blob = file.slice(startByte, endByte)
        const buf = await blob.arrayBuffer()

        const chunkRes = await fetch("/api/upload/chunk", {
          method: "POST",
          headers: { "content-type": "application/octet-stream",
            "x-session-id": initJson.sessionId,
            "x-chunk-index": String(chunkIndex),
            "x-total-chunks": String(totalChunks),
          },
          body: buf,
          signal: abort.signal,
        })
        if (!chunkRes.ok) throw new Error(`chunk ${chunkIndex} failed (${chunkRes.status})`)

        // NOTE: baseline progress by chunks (not bytes) – candidates can improve
        setProgress((chunkIndex + 1) / totalChunks)
      }

      setStatus("finalizing")

      const finRes = await fetch("/api/upload/finalize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: initJson.sessionId }),
        signal: abort.signal,
      })
      if (!finRes.ok) throw new Error(`finalize failed (${finRes.status})`)

      setStatus("done")
    } catch (e: any) {
      if (e?.name === "AbortError") return
      setStatus("error")
      setError(e?.message ?? "Upload failed")
    }
  }, [])

  return { status, progress, error, start, cancel, reset, sessionId }
}

