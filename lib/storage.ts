import fs from "fs/promises"
import path from "path"

export const DATA_DIR = path.join(process.cwd(), ".data")

export async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true })
}

export async function writeChunk(sessionId: string, chunkIndex: number, bytes: ArrayBuffer) {
  const dir = path.join(DATA_DIR, sessionId)
  await ensureDir(dir)
  const name = `chunk-${String(chunkIndex).padStart(6, "0")}.bin`
  await fs.writeFile(path.join(dir, name), Buffer.from(bytes))
}

export async function listChunks(sessionId: string) {
  const dir = path.join(DATA_DIR, sessionId)
  const files = await fs.readdir(dir)
  return files.filter((f) => f.startsWith("chunk-") && f.endsWith(".bin")).sort()
}

export async function readChunk(sessionId: string, filename: string) {
  const filePath = path.join(DATA_DIR, sessionId, filename)
  return await fs.readFile(filePath)
}

export async function writeAssembled(sessionId: string, bytes: Buffer) {
  const dir = path.join(DATA_DIR, sessionId)
  await ensureDir(dir)
  const out = path.join(dir, "assembled.csv")
  await fs.writeFile(out, bytes)
  return out
}

