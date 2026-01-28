export function parseCsvPreview(csvText: string, maxRows: number) {
  const lines = csvText.split(/\r?\n/).filter((l) => l.length > 0)
  const headerLine = lines[0] ?? ""
  const columns = splitCsvLine(headerLine)

  const rows: Record<string, string>[] = []
  for (let i = 1; i < Math.min(lines.length, maxRows + 1); i++) {
    const vals = splitCsvLine(lines[i]!)
    const row: Record<string, string> = {}
    for (let c = 0; c < columns.length; c++) row[columns[c]!] = vals[c] ?? ""
    rows.push(row)
  }

  const types: Record<string, string> = {}
  for (const col of columns) {
    const sample = rows.map((r) => r[col]).filter((x) => x !== "").slice(0, 50)
    types[col] = inferType(sample)
  }

  return { columns, rows, types }
}

// Minimal CSV splitter (handles quotes). Good enough for take-home.
function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; continue }
    if (ch === '"') { inQuotes = !inQuotes; continue }
    if (ch === "," && !inQuotes) { out.push(cur); cur = ""; continue }
    cur += ch
  }
  out.push(cur)
  return out
}

function inferType(sample: string[]) {
  if (sample.length === 0) return "unknown"
  const isNumber = sample.every((v) => /^-?\d+(\.\d+)?$/.test(v.trim()))
  if (isNumber) return "number"
  const isBool = sample.every((v) => /^(true|false)$/i.test(v.trim()))
  if (isBool) return "boolean"
  return "string"
}

