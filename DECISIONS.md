# Chunked Upload Implementation

## Overview

This document outlines the improvements and architectural decisions made for the chunked file upload system.

## Upload Wizard Component

### Overview

The `UploadWizard` component implements a complete, user-friendly file upload workflow that addresses all requirements from the take-home exercise. It provides clear phase-based progress tracking, actionable error messages, and robust state management.

### 1. Multi-Phase Progress Indicator

**Implementation:**

- **5 distinct phases**: `select` → `validate` → `upload` → `finalize` → `ready`
- **Visual stepper component** (`PhaseIndicator`) with:
    - Numbered badges (1-5) that turn into checkmarks when completed
    - Color-coded states: active (blue), completed (green), pending (gray)
    - Connector lines between phases showing completion status
- **Phase determination logic** (`getPhaseFromStatus`) that maps upload status to UI phases
- **Dynamic phase labels** (`getPhaseLabel`) for user-friendly phase names

**Why:**

- Addresses TAKEHOME requirement: "Design a clear, user-trustworthy upload workflow" with "explicit phases"
- Provides visual feedback that users can trust
- Makes it clear what stage the upload is in at all times

### 2. User-Friendly Status Display

**Implementation:**

- **Status panel** with color-coded states:
    - Idle (gray) - Initial state
    - Uploading (blue) - Active upload
    - Done (green) - Success
    - Error (red) - Failure
    - Canceled (gray) - User cancellation
- **Contextual descriptions** (`getPhaseDescription`) that explain what's happening:
    - "Checking file format and structure..." during validation
    - "Uploading your file in chunks. This may take a few moments." during upload
    - "Retrying failed chunks..." during retry
    - "Assembling your file. Almost done!" during finalization
- **Visual icons** (✓, ✕, ⟳, ℹ) for quick status recognition
- **Session ID display** (truncated) for debugging support

**Why:**

- Addresses TAKEHOME requirement: "Clearly explain what's happening at each stage"
- Assumes users are non-technical (as specified)
- Provides actionable context, not just status codes

### 3. Actionable Error Messages

**Implementation:**

- **Error transformation** (`getErrorMessage`) that converts technical errors into user-friendly messages:
    - HTTP status codes → specific guidance (413 = file too large, 500 = server error)
    - Chunk failures → "Some parts of your file failed to upload. Click 'Retry'..."
    - Network errors → "Network error. Please check your internet connection..."
    - Canceled uploads → "Upload was canceled. You can start a new upload or retry."
- **Error prioritization**: Validation errors take precedence over upload errors
- **Support contact guidance** included in error messages

**Why:**

- Addresses TAKEHOME requirement: "Handle errors with actionable messaging"
- Assumes users are non-technical
- Provides clear next steps, not just error codes

### 4. File Information Display

**Implementation:**

- **File details** shown after selection:
    - File name
    - File size (formatted: B, KB, MB, GB)
    - Validation results: column count and row count (when valid)
- **Formatting utility** (`formatBytes`) for human-readable file sizes
- **Dynamic display**: Shows hint text when no file selected, file info when selected

**Why:**

- Provides immediate feedback after file selection
- Shows validation results before upload starts
- Helps users verify they selected the correct file

### 5. Progress Tracking

**Implementation:**

- **Byte-based progress bar** (not just chunk count)
- **Dual display**:
    - Percentage (0-100%)
    - Bytes uploaded / Total bytes (e.g., "1.5 MB / 10 MB")
- **Visual progress bar** with smooth transitions
- **Progress only shown** during upload and finalization phases

**Why:**

- Addresses TAKEHOME requirement: "Communicate progress users can trust"
- More accurate than chunk-based progress (especially for last chunk)
- Provides both percentage and absolute values for clarity

### 6. Action Buttons with Smart States

**Implementation:**

- **Start Upload**: Enabled only when file is selected and validated
- **Retry Upload**: Appears only when upload failed and session ID exists
- **Cancel**: Enabled only when upload is in progress
- **Reset**: Always available to start fresh
- **View Preview**: Appears only when upload is complete

**Why:**

- Prevents invalid actions (e.g., starting upload without file)
- Provides clear retry path after failures
- Supports cancellation as specified in TAKEHOME optional extensions

### 7. React 19 & Next.js Optimizations

**Implementation:**

- **`useCallback`** for all event handlers to prevent unnecessary re-renders:
    - `handleFileChange`, `handleStart`, `handleRetry`, `handleReset`, `handleCancel`, `handleViewPreview`
- **`useMemo`** for expensive computations:
    - `canStart`, `isBusy`, `canRetry`, `displayError`, `fileInfo`, `currentPhaseIndex`, `statusClassName`, `fileButtonClassName`
- **Constant extraction**: `PHASES` array extracted outside component to avoid recreation
- **CSS Modules only**: Removed all global CSS classes, using only CSS modules for consistency

**Why:**

- Follows React 19 best practices for performance
- Prevents unnecessary re-renders of child components
- Maintains consistent styling approach (CSS modules throughout)

### 8. Comprehensive Documentation

**Implementation:**

- **JSDoc comments** for all functions:
    - Component-level documentation
    - Function purpose and parameters
    - Return value descriptions
    - Usage context
- **English-only comments** as per project standards
- **Clear function naming** that describes purpose

**Why:**

- Improves code maintainability
- Helps other developers understand the component
- Follows TypeScript/React documentation best practices

### 9. CSS Architecture

**Implementation:**

- **CSS Modules** exclusively (no global classes)
- **Semantic class names**: `.statusDescription`, `.fileButtonEnabled`, `.fileButtonDisabled`
- **State-based styling**: Classes change based on component state
- **Consistent naming**: Follows BEM-like conventions

**Why:**

- Prevents CSS conflicts
- Better encapsulation
- Easier to maintain and refactor

## Upload Hook Improvements

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

## Comparison with TAKEHOME Requirements

### ✅ Completed Requirements

**1. Improve the upload experience (UX)**

- ✅ Clear, user-trustworthy upload workflow with explicit phases (Select → Validate → Upload → Finalize → Ready)
- ✅ Progress users can trust (byte-based, not chunk-based)
- ✅ Clear explanations at each stage (contextual descriptions)
- ✅ Actionable error messaging (transformed technical errors)
- ✅ Sensible retry support (retry button appears on failure)
- ✅ No premature "success" (only shows success after finalization completes)
- ✅ Assumes non-technical users (all messages are user-friendly)

**2. Improve client-side robustness**

- ✅ Clear state transitions (state machine in `useChunkedUpload`)
- ✅ Avoids "boolean soup" (uses status enum instead of multiple booleans)
- ✅ Partial failure handling (failed chunks tracked, retry available)
- ✅ Cancellation support (cancel button, abort signals)
- ✅ Safe retry assumptions (resume with session ID)

**3. Improve the data preview surface**

- ✅ Handles wide datasets (20-100 columns) - see Data Preview section
- ✅ Readable for non-technical users - see Data Preview section
- ✅ Surfaces schema issues early - see Data Preview section
- ✅ Prioritizes clarity over completeness - see Data Preview section

**4. Document decisions**

- ✅ This DECISIONS.md file covers what changed and why
- ✅ Tradeoffs documented throughout
- ✅ Backend "asks" documented where relevant

### 🎯 Optional Extensions Implemented

- ✅ **Resumable uploads** - Implemented via session ID and localStorage
- ✅ **Chunk-level retry with backoff** - Exponential backoff (1s → 2s → 4s → 8s → 16s)
- ✅ **Cancel or pause uploads** - Cancel button with abort signal support
- ✅ **Improved progress accuracy** - Byte-based progress (not chunk-based)

### 📝 What Was Intentionally Not Done

**Accessibility improvements:**

- While the component is functional, comprehensive ARIA labels and keyboard navigation could be enhanced
- Screen reader support could be improved with more descriptive labels
- **Tradeoff**: Focused on core UX and robustness first, accessibility can be added incrementally

**Advanced error recovery:**

- No automatic retry of entire upload on failure (requires user action)
- No partial upload preview before completion
- **Tradeoff**: Keeps UX simple and predictable, avoids confusing states

**Upload queue:**

- Only one file can be uploaded at a time
- **Tradeoff**: Simpler state management, matches typical use case

## Files Modified/Created

- `hooks/useChunkedUpload.ts` - Refactored with automatic retry, byte-based progress, state machine, and resume capability
- `components/UploadWizard.tsx` - Complete rewrite with phase indicators, status display, error handling, React 19 optimizations, and comprehensive documentation
- `components/UploadWizard.module.css` - CSS modules with state-based styling, removed global classes
- `app/api/upload/status/route.ts` - New API endpoint for checking upload status
- `components/DataPreviewTable.tsx` - Complete rewrite with schema detection, responsive layout, sticky columns, and pagination
- `lib/schema-detection.ts` - New utility module for detecting schema issues and calculating column statistics
