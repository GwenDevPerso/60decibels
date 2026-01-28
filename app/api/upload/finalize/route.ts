import { NextResponse } from "next/server"
import { listChunks, readChunk, writeAssembled } from "@/lib/storage"
import { parseCsvPreview } from "@/lib/csv"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { sessionId?: string } | null
  const sessionId = body?.sessionId
  if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 })

  const files = await listChunks(sessionId)
  if (files.length === 0) return NextResponse.json({ error: "No chunks found" }, { status: 400 })

  const parts: Buffer[] = []
  for (const f of files) {
    parts.push(await readChunk(sessionId, f))
  }
  const assembled = Buffer.concat(parts)
  await writeAssembled(sessionId, assembled)

  // Preview first ~200 lines (cheap)
  const text = assembled.toString("utf8")
  const preview = parseCsvPreview(text, 100)

  return NextResponse.json({ sessionId, preview })
}

// Convenience: allow GET /finalize?sessionId=... to fetch preview after done
export async function GET(req: Request) {
  const url = new URL(req.url)
  const sessionId = url.searchParams.get("sessionId")
  if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 })

  // This GET just delegates to the assembled file path if it exists, but for simplicity,
  // we rebuild from chunks here too.
  const files = await listChunks(sessionId).catch(() => [])
  if (files.length === 0) return NextResponse.json({ error: "No chunks found" }, { status: 400 })

  const parts: Buffer[] = []
  for (const f of files) parts.push(await readChunk(sessionId, f))
  const assembled = Buffer.concat(parts)

  const text = assembled.toString("utf8")
  const preview = parseCsvPreview(text, 100)

  return NextResponse.json({ sessionId, preview })
}

