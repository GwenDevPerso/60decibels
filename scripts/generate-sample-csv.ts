import fs from "fs/promises";
import path from "path";

const out = path.join(process.cwd(), "public", "sample-large.csv")

function rand(n: number) { return Math.floor(Math.random() * n) }

async function main() {
  const baseCols = ["id", "country", "segment", "amount", "score", "active", "comment"]
  const additionalCols = Array.from({ length: 100 - baseCols.length }, (_, i) => `col_${String(i + 8).padStart(3, "0")}`)
  const cols = [...baseCols, ...additionalCols]
  const rows = 250_000 // ~ tens of MB depending on comment length
  const countries = ["US", "GB", "IN", "BR", "KE", "ZA", "NG", "MX"]
  const segments = ["A", "B", "C", "D"]

  // Delete existing file if it exists
  try {
    await fs.unlink(out)
  } catch {
    // File doesn't exist, that's fine
  }

  let s = cols.join(",") + "\n"
  for (let i = 1; i <= rows; i++) {
    const comment = `note_${rand(1_000_000)}`
    const baseRow = [
      i,
      countries[rand(countries.length)],
      segments[rand(segments.length)],
      (Math.random() * 10000).toFixed(2),
      (Math.random() * 100).toFixed(1),
      Math.random() > 0.5 ? "true" : "false",
      comment
    ]
    const additionalRow = Array.from({ length: 100 - baseCols.length }, () => {
      return (Math.random() * 1000).toFixed(2)
    })
    s += [...baseRow, ...additionalRow].join(",") + "\n"
    if (i % 10_000 === 0) {
      // write in chunks to avoid huge memory spikes
      await fs.appendFile(out, s)
      s = ""
    }
  }
  if (s) await fs.appendFile(out, s)

  console.log("Wrote", out)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

