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

export interface ValidationResult {
  valid: boolean
  error?: string
  columns?: string[]
  rowCount?: number
}

const MIN_FILE_SIZE_BYTES = 1
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024 // 2GB
const MIN_ROWS_REQUIRED = 1 // At least header + 1 row

/**
 * Validates a CSV file before upload.
 * Checks file size, format, and basic structure.
 * Returns validation result with actionable error messages for non-technical users.
 */
export async function validateCsvFile(file: File): Promise<ValidationResult> {
  // Check file size
  if (file.size < MIN_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: "The file is empty. Please select a file with data.",
    }
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    const fileSizeGB = (file.size / 1024 / 1024 / 1024).toFixed(2);
    return {
      valid: false,
      error: `The file is too large (${fileSizeGB}GB). Maximum size is 2GB. Please use a smaller file.`,
    }
  }

  // Check file extension
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return {
      valid: false,
      error: "The file must be a CSV file (.csv extension). Please select a CSV file.",
    }
  }

  // Check file type
  if (file.type && !file.type.includes("csv") && file.type !== "text/csv" && file.type !== "application/vnd.ms-excel") {
    return {
      valid: false,
      error: "The file type is not recognized as CSV. Please select a valid CSV file.",
    }
  }

  try {
    // Read and parse a sample of the file to validate structure
    const text = await file.text()
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)

    if (lines.length === 0) {
      return {
        valid: false,
        error: "The file appears to be empty or contains no valid data. Please check your file.",
      }
    }

    // Parse header
    const headerLine = lines[0]!
    const columns = splitCsvLine(headerLine)

    if (columns.length === 0) {
      return {
        valid: false,
        error: "The file has no column headers. Please ensure your CSV file has a header row.",
      }
    }

    if (columns.length > 100) {
      return {
        valid: false,
        error: `The file has too many columns (${columns.length}). Maximum is 100 columns. Please reduce the number of columns.`,
      }
    }

    // Check for at least one data row
    if (lines.length < MIN_ROWS_REQUIRED + 1) {
      return {
        valid: false,
        error: "The file must contain at least one row of data in addition to the header. Please add data rows to your CSV file.",
      }
    }

    // Validate that rows have consistent column count (sample first 10 rows)
    const sampleRows = lines.slice(1, Math.min(11, lines.length))
    for (let i = 0; i < sampleRows.length; i++) {
      const row = sampleRows[i]!
      const values = splitCsvLine(row)
      if (values.length !== columns.length) {
        return {
          valid: false,
          error: `Row ${i + 2} has ${values.length} columns but the header has ${columns.length} columns. All rows must have the same number of columns.`,
        }
      }
    }

    return {
      valid: true,
      columns,
      rowCount: lines.length - 1, // Exclude header
    }
  } catch (error: unknown) {
    return {
      valid: false,
      error: error instanceof Error
        ? `Unable to read the file: ${error.message}. Please check that the file is not corrupted.`
        : "Unable to read the file. Please check that the file is not corrupted or in use by another program.",
    }
  }
}

