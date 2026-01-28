import { NextResponse } from "next/server"
import crypto from "crypto"
import { DATA_DIR, ensureDir } from "@/lib/storage"
import path from "path"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const _body = await req.json().catch(() => ({}))
  const sessionId = crypto.randomUUID()
  await ensureDir(path.join(DATA_DIR, sessionId))
  return NextResponse.json({ sessionId })
}

