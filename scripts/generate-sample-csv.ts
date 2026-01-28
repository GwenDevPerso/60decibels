import fs from "fs/promises"
import path from "path"

const out = path.join(process.cwd(), "public", "sample-large.csv")

function rand(n: number) { return Math.floor(Math.random() * n) }

async function main() {
  const cols = ["id", "country", "segment", "amount", "score", "active", "comment"]
  const rows = 250_000 // ~ tens of MB depending on comment length
  const countries = ["US", "GB", "IN", "BR", "KE", "ZA", "NG", "MX"]
  const segments = ["A", "B", "C", "D"]

  let s = cols.join(",") + "\n"
  for (let i = 1; i <= rows; i++) {
    const comment = `note_${rand(1_000_000)}`
    s += [
      i,
      countries[rand(countries.length)],
      segments[rand(segments.length)],
      (Math.random() * 10000).toFixed(2),
      (Math.random() * 100).toFixed(1),
      Math.random() > 0.5 ? "true" : "false",
      comment
    ].join(",") + "\n"
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

