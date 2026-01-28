# Chunked Upload Implementation

## Overview

This document outlines the improvements and architectural decisions made for the chunked file upload system.

## Upload

### 1. Automatic Retry with Exponential Backoff

- Each chunk is automatically retried up to **5 times** on failure
- Exponential backoff delays: `1s → 2s → 4s → 8s → 16s` (max `30s`)
- Status transitions to `"retrying"` during retry attempts
- Provides resilience against transient network failures

### 2. Byte-Based Progress Tracking

- Progress calculation based on **bytes uploaded** (not just chunk count)
- Displays `bytes uploaded / total bytes` in the UI
- More accurate progress representation for files with varying chunk sizes

### 3. State Machine

A robust state machine ensures predictable upload behavior:

**States:**

- `idle` - Initial state, no upload in progress
- `initializing` - Upload session being initialized
- `uploading` - Actively uploading chunks
- `retrying` - Retrying failed chunks
- `finalizing` - Assembling uploaded chunks
- `done` - Upload completed successfully
- `error` - Upload failed
- `canceled` - Upload canceled by user

**Features:**

- Clear and predictable state transitions
- Prevents invalid state combinations
- Improves error handling and user feedback

### 4. Partial Failure Recovery

Resume capability for interrupted uploads:

- **New API endpoint**: `/api/upload/status` - Checks which chunks have already been uploaded
- **Automatic detection**: Automatically detects already-uploaded chunks on resume
- **Resume button**: Appears when an error occurs with failed chunks remaining
- **Smart skipping**: Already-uploaded chunks are skipped during resume, saving time and bandwidth

## Data Preview

### 1. Schema Issue Detection

Automatic detection and display of data quality issues:

- **Duplicate column names** - Detected and flagged as errors
- **Empty columns** - Columns with all missing values flagged as warnings
- **High missing value rate** - Columns with >50% missing values flagged as warnings
- **Mixed types** - Columns with inconsistent types (e.g., numbers mixed with strings) flagged as warnings
- **Visual indicators** - Color-coded alerts (red for errors, orange for warnings) with detailed messages

### 2. Responsive Table Layout

Adaptive column sizing based on dataset size:

- **Small datasets (≤10 columns)**:
    - Columns automatically fill available table width
    - No horizontal scroll needed
    - Uses `table-layout: auto` for flexible sizing

- **Large datasets (>10 columns)**:
    - Fixed column widths (150px for sticky column, 120px for others)
    - Horizontal scroll enabled
    - First column becomes sticky when scrolling horizontally
    - Uses `table-layout: fixed` for predictable layout

### 3. Sticky Column Support

For wide datasets requiring horizontal scroll:

- **Conditional activation** - Sticky column only enabled when there are more than 10 columns
- **Visual feedback** - Shadow effect on sticky column to indicate it's fixed
- **Proper z-indexing** - Ensures sticky column stays above scrolling content
- **Background color** - White background prevents content bleeding through

### 4. Column Limiting

Improved UX for datasets with many columns:

- **Default view** - Shows first 10 columns by default
- **Show all toggle** - Button to expand/collapse to show all columns
- **Visual indicator** - Displays "+X more" badge when columns are hidden
- **Column overview panel** - Lists all visible columns with their inferred types

### 5. Pagination

Efficient handling of large row sets:

- **20 rows per page** - Configurable via `ROWS_PER_PAGE` constant
- **Navigation controls** - Previous/Next buttons with disabled states
- **Row counter** - Shows "Showing X-Y of Z rows"
- **Auto-reset** - Returns to page 1 when data changes

### 6. Fixed Container Sizing

Prevents page-level horizontal scrolling:

- **Container constraints** - All containers have `width: 100%`, `maxWidth: "100%"`, and `overflow: hidden`
- **Scroll isolation** - Horizontal scroll only occurs within the table container
- **Consistent layout** - Page structure remains stable regardless of dataset size

### 7. Hydration Error Prevention

Fixes React hydration mismatches:

- **Client-side extraction** - `sessionId` extracted in `useEffect` after component mount
- **Loading state** - Shows consistent loading message during extraction
- **Hook order** - All hooks called before conditional returns to maintain consistent hook order

## Files Modified/Created

- `hooks/useChunkedUpload.ts` - Refactored with all improvements
- `components/UploadWizard.tsx` - Updated to display new information and states
- `app/api/upload/status/route.ts` - New API endpoint for checking upload status
- `components/DataPreviewTable.tsx` - Complete rewrite with schema detection, responsive layout, sticky columns, and pagination
- `lib/schema-detection.ts` - New utility module for detecting schema issues and calculating column statistics
