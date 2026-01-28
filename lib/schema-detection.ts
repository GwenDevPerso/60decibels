/**
 * Schema issue severity levels
 */
export type SchemaIssueSeverity = "warning" | "error"

/**
 * Represents a detected schema issue
 */
export interface SchemaIssue {
  column: string
  severity: SchemaIssueSeverity
  message: string
  details?: string
}

/**
 * Detects schema issues in the preview data
 * 
 * Checks for:
 * - Mixed types within columns
 * - High percentage of missing values
 * - Completely empty columns
 * - Duplicate column names
 * 
 * @param columns - Array of column names
 * @param types - Inferred types for each column
 * @param rows - Preview rows data
 * @returns Array of detected schema issues
 */
export function detectSchemaIssues(
  columns: string[],
  types: Record<string, string>,
  rows: Array<Record<string, string>>
): SchemaIssue[] {
  const issues: SchemaIssue[] = []

  if (rows.length === 0) {
    return issues
  }

  // Check for duplicate column names
  const columnCounts = new Map<string, number>()
  columns.forEach((col) => {
    columnCounts.set(col, (columnCounts.get(col) ?? 0) + 1)
  })
  columnCounts.forEach((count, col) => {
    if (count > 1) {
      issues.push({
        column: col,
        severity: "error",
        message: `Duplicate column name (appears ${count} times)`,
      })
    }
  })

  // Analyze each column
  columns.forEach((column) => {
    const columnValues = rows.map((row) => row[column] ?? "").filter((val) => val !== "")
    const nonEmptyCount = columnValues.length
    const totalCount = rows.length
    const emptyPercentage = ((totalCount - nonEmptyCount) / totalCount) * 100

    // Check for completely empty columns
    if (nonEmptyCount === 0) {
      issues.push({
        column,
        severity: "warning",
        message: "Column is completely empty",
        details: "All values are missing",
      })
      return
    }

    // Check for high percentage of missing values (>50%)
    if (emptyPercentage > 50) {
      issues.push({
        column,
        severity: "warning",
        message: `High percentage of missing values (${Math.round(emptyPercentage)}%)`,
        details: `${nonEmptyCount} of ${totalCount} values are filled`,
      })
    }

    // Check for mixed types (if we have enough data)
    if (nonEmptyCount >= 5) {
      const inferredType = types[column] ?? "unknown"
      const typeConsistency = checkTypeConsistency(columnValues, inferredType)

      if (!typeConsistency.isConsistent) {
        issues.push({
          column,
          severity: "warning",
          message: `Mixed types detected (inferred as ${inferredType})`,
          details: typeConsistency.details,
        })
      }
    }
  })

  return issues
}

/**
 * Checks if values in a column are consistent with the inferred type
 * 
 * @param values - Array of non-empty string values
 * @param inferredType - The inferred type for this column
 * @returns Object indicating consistency and details
 */
function checkTypeConsistency(values: string[], inferredType: string): { isConsistent: boolean; details?: string } {
  if (inferredType === "unknown") {
    return { isConsistent: true }
  }

  let consistentCount = 0
  const typeChecks: Record<string, (v: string) => boolean> = {
    number: (v) => /^-?\d+(\.\d+)?$/.test(v.trim()),
    boolean: (v) => /^(true|false)$/i.test(v.trim()),
    string: () => true, // Strings are always consistent
  }

  const checker = typeChecks[inferredType]
  if (!checker) {
    return { isConsistent: true }
  }

  values.forEach((val) => {
    if (checker(val)) {
      consistentCount++
    }
  })

  const consistencyPercentage = (consistentCount / values.length) * 100

  // If less than 80% of values match the inferred type, consider it inconsistent
  if (consistencyPercentage < 80) {
    return {
      isConsistent: false,
      details: `Only ${Math.round(consistencyPercentage)}% of values match ${inferredType} type`,
    }
  }

  return { isConsistent: true }
}

/**
 * Calculates column statistics for summary view
 * 
 * @param column - Column name
 * @param rows - Preview rows data
 * @param type - Inferred type for the column
 * @returns Statistics object
 */
export function getColumnStats(
  column: string,
  rows: Array<Record<string, string>>,
  type: string
): {
  filledCount: number
  emptyCount: number
  fillPercentage: number
  sampleValues: string[]
} {
  const values = rows.map((row) => row[column] ?? "")
  const nonEmptyValues = values.filter((v) => v !== "")
  const filledCount = nonEmptyValues.length
  const emptyCount = rows.length - filledCount
  const fillPercentage = rows.length > 0 ? (filledCount / rows.length) * 100 : 0

  // Get up to 3 sample values
  const sampleValues = nonEmptyValues.slice(0, 3)

  return {
    filledCount,
    emptyCount,
    fillPercentage: Math.round(fillPercentage),
    sampleValues,
  }
}
