import { NextResponse } from "next/server"
import { writeChunk } from "@/lib/storage"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const sessionId = req.headers.get("x-session-id")
  const chunkIndexStr = req.headers.get("x-chunk-index")
  const totalChunksStr = req.headers.get("x-total-chunks") // kept for contract, not required

  if (!sessionId || !chunkIndexStr || !totalChunksStr) {
    return NextResponse.json({ error: "Missing headers" }, { status: 400 })
  }

  const chunkIndex = Number(chunkIndexStr)
  if (!Number.isFinite(chunkIndex) || chunkIndex < 0) {
    return NextResponse.json({ error: "Invalid chunk index" }, { status: 400 })
  }

  const buf = await req.arrayBuffer()
  await writeChunk(sessionId, chunkIndex, buf)

  return NextResponse.json({ ok: true })
}

