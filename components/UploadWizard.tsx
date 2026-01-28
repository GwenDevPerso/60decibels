"use client";

import {useRouter} from "next/navigation";
import {useCallback, useMemo, useRef, useState} from "react";
import {useChunkedUpload} from "@/hooks/useChunkedUpload";
import {validateCsvFile, type ValidationResult} from "@/lib/csv";
import styles from "./UploadWizard.module.css";

type UploadPhase = "select" | "validate" | "upload" | "finalize" | "ready";

const PHASES: UploadPhase[] = ["select", "validate", "upload", "finalize", "ready"];

interface PhaseIndicatorProps {
  phase: UploadPhase;
  index: number;
  isActive: boolean;
  isCompleted: boolean;
  isLast: boolean;
  getPhaseLabel: (phase: UploadPhase) => string;
}

/**
 * Component that displays a single phase indicator in the upload progress stepper.
 * Shows the phase number, label, and visual state (active, completed, or pending).
 */
function PhaseIndicator({phase, index, isActive, isCompleted, isLast, getPhaseLabel}: PhaseIndicatorProps) {
  /**
   * Returns the CSS class name for the phase item based on its state.
   */
  const getItemClassName = (): string => {
    if (isActive) return `${styles.phaseItem} ${styles.phaseItemActive}`;
    if (isCompleted) return `${styles.phaseItem} ${styles.phaseItemCompleted}`;
    return `${styles.phaseItem} ${styles.phaseItemPending}`;
  };

  /**
   * Returns the CSS class name for the phase badge (number/checkmark) based on its state.
   */
  const getBadgeClassName = (): string => {
    if (isActive) return `${styles.phaseBadge} ${styles.phaseBadgeActive}`;
    if (isCompleted) return `${styles.phaseBadge} ${styles.phaseBadgeCompleted}`;
    return `${styles.phaseBadge} ${styles.phaseBadgePending}`;
  };

  /**
   * Returns the CSS class name for the connector line between phases based on completion state.
   */
  const getConnectorClassName = (): string => {
    if (isCompleted) return `${styles.phaseConnector} ${styles.phaseConnectorCompleted}`;
    return `${styles.phaseConnector} ${styles.phaseConnectorPending}`;
  };

  return (
    <div className={getItemClassName()}>
      <div className={getBadgeClassName()}>
        {isCompleted ? "✓" : index + 1}
      </div>
      <span>{getPhaseLabel(phase)}</span>
      {!isLast && <div className={getConnectorClassName()} />}
    </div>
  );
}

/**
 * Formats a number of bytes into a human-readable string (B, KB, MB, GB).
 * @param n - The number of bytes to format
 * @returns A formatted string with the appropriate unit
 */
function formatBytes(n: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let x = n;
  while (x >= 1024 && i < units.length - 1) {
    x /= 1024;
    i++;
  }
  return `${x.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Determines the current upload phase based on the upload status and validation state.
 * @param status - The current upload status from the chunked upload hook
 * @param isValidating - Whether the file is currently being validated
 * @returns The corresponding UploadPhase
 */
function getPhaseFromStatus(status: string, isValidating: boolean): UploadPhase {
  if (isValidating) return "validate";
  if (status === "idle" || status === "canceled") return "select";
  if (status === "initializing") return "validate";
  if (status === "uploading" || status === "retrying") return "upload";
  if (status === "finalizing") return "finalize";
  if (status === "done") return "ready";
  return "select";
}

/**
 * Returns a human-readable label for a given upload phase.
 * @param phase - The upload phase to get the label for
 * @returns A string label for the phase
 */
function getPhaseLabel(phase: UploadPhase): string {
  switch (phase) {
    case "select":
      return "Select File";
    case "validate":
      return "Validate";
    case "upload":
      return "Uploading";
    case "finalize":
      return "Finalizing";
    case "ready":
      return "Ready";
    default:
      return "Select File";
  }
}

/**
 * Returns a descriptive message explaining what's happening in the current phase.
 * Provides context-specific descriptions based on the phase and status.
 * @param phase - The current upload phase
 * @param status - The current upload status
 * @param error - Any error message (currently unused but kept for future use)
 * @returns A descriptive string message
 */
function getPhaseDescription(phase: UploadPhase, status: string, error: string | null): string {
  switch (phase) {
    case "select":
      return "Choose a CSV file to upload (up to 2GB)";
    case "validate":
      return "Checking file format and structure...";
    case "upload":
      if (status === "retrying") {
        return "Retrying failed chunks...";
      }
      return "Uploading your file in chunks. This may take a few moments.";
    case "finalize":
      return "Assembling your file. Almost done!";
    case "ready":
      return "Upload complete! Your file is ready to preview.";
    default:
      return "";
  }
}

/**
 * Transforms technical error messages into user-friendly, actionable messages.
 * Prioritizes validation errors over upload errors and provides specific guidance
 * for common error scenarios (file size, network issues, chunk failures, etc.).
 * @param error - The upload error message, if any
 * @param validationError - The validation error message, if any
 * @returns A user-friendly error message or null if no error
 */
function getErrorMessage(error: string | null, validationError: string | null): string | null {
  if (validationError) return validationError;
  if (!error) return null;

  // Make error messages more actionable for non-technical users
  if (error.includes("failed (")) {
    const match = error.match(/failed \((\d+)\)/);
    const statusCode = match?.[1];
    if (statusCode === "413") {
      return "The file is too large for the server. Please try a smaller file or contact support.";
    }
    if (statusCode === "500") {
      return "The server encountered an error. Please try again in a moment. If the problem persists, contact support.";
    }
    return `Upload failed with error code ${statusCode}. Please try again.`;
  }

  if (error.includes("chunk")) {
    return "Some parts of your file failed to upload. Click 'Retry' to try again, or contact support if the problem continues.";
  }

  if (error.includes("canceled")) {
    return "Upload was canceled. You can start a new upload or retry.";
  }

  if (error.includes("network") || error.includes("fetch")) {
    return "Network error. Please check your internet connection and try again.";
  }

  return `Upload failed: ${error}. Please try again or contact support if the problem continues.`;
}

/**
 * Main component for the file upload wizard.
 * Manages the complete upload workflow: file selection, validation, chunked upload,
 * progress tracking, and error handling. Provides a multi-phase UI with clear
 * visual feedback at each stage.
 */
export default function UploadWizard() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    status,
    progress,
    error,
    start,
    cancel,
    reset,
    sessionId,
    failedChunks,
  } = useChunkedUpload();

  const phase = getPhaseFromStatus(status, isValidating);

  /**
   * Determines if the upload can be started based on file selection and validation state.
   */
  const canStart = useMemo(() => {
    return !!file && validationResult?.valid && (status === "idle" || status === "error" || status === "canceled" || status === "done");
  }, [file, validationResult?.valid, status]);

  /**
   * Determines if the wizard is currently busy (uploading, finalizing, or validating).
   */
  const isBusy = useMemo(() => {
    return status === "uploading" || status === "finalizing" || isValidating;
  }, [status, isValidating]);

  /**
   * Determines if a retry operation is available after a failed upload.
   */
  const canRetry = useMemo(() => {
    return status === "error" && file !== null && sessionId !== null;
  }, [status, file, sessionId]);

  /**
   * Computes the user-friendly error message to display, prioritizing validation errors.
   */
  const displayError = useMemo(() => {
    return getErrorMessage(error, validationResult?.error ?? null);
  }, [error, validationResult?.error]);

  /**
   * Formats file information including name, size, and validation details (columns, rows).
   */
  const fileInfo = useMemo(() => {
    if (!file) return null;
    const validationInfo = validationResult?.valid
      ? ` • ${validationResult.columns?.length ?? 0} columns, ${validationResult.rowCount?.toLocaleString() ?? 0} rows`
      : "";
    return `${file.name} • ${formatBytes(file.size)}${validationInfo}`;
  }, [file, validationResult]);

  /**
   * Gets the index of the current phase in the phases array.
   */
  const currentPhaseIndex = useMemo(() => {
    return PHASES.indexOf(phase);
  }, [phase]);

  /**
   * Determines the CSS class name for the status display based on the current upload status.
   */
  const statusClassName = useMemo(() => {
    if (status === "error") return styles.statusErrorState;
    if (status === "done") return styles.statusDone;
    if (status === "uploading" || status === "retrying" || status === "finalizing") return styles.statusUploading;
    if (status === "canceled") return styles.statusCanceled;
    return styles.statusIdle;
  }, [status]);

  /**
   * Computes the CSS class name for the file input button based on busy state.
   */
  const fileButtonClassName = useMemo(() => {
    return `${styles.fileButton} ${isBusy ? styles.fileButtonDisabled : styles.fileButtonEnabled}`;
  }, [isBusy]);

  /**
   * Handles file selection from the input element.
   * Resets the upload state, validates the selected file, and updates the component state.
   */
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] ?? null;
    reset();
    setFile(selectedFile);
    setValidationResult(null);

    if (!selectedFile) {
      return;
    }

    setIsValidating(true);
    try {
      const result = await validateCsvFile(selectedFile);
      setValidationResult(result);
    } catch (err: unknown) {
      setValidationResult({
        valid: false,
        error: err instanceof Error ? err.message : "An unexpected error occurred during validation.",
      });
    } finally {
      setIsValidating(false);
    }
  }, [reset]);

  /**
   * Initiates the chunked upload process for the selected and validated file.
   */
  const handleStart = useCallback(async () => {
    if (!file || !validationResult?.valid) return;
    await start(file);
  }, [file, validationResult?.valid, start]);

  /**
   * Retries the upload process using the existing session ID to resume from where it failed.
   */
  const handleRetry = useCallback(async () => {
    if (!file || !sessionId) return;
    await start(file, sessionId);
  }, [file, sessionId, start]);

  /**
   * Resets the wizard to its initial state, clearing file selection, validation results,
   * and upload state. Also clears the file input element.
   */
  const handleReset = useCallback(() => {
    reset();
    setFile(null);
    setValidationResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [reset]);

  /**
   * Cancels the ongoing upload operation.
   */
  const handleCancel = useCallback(() => {
    cancel();
  }, [cancel]);

  /**
   * Navigates to the preview page with the current session ID.
   */
  const handleViewPreview = useCallback(() => {
    if (!sessionId) return;
    router.push(`/preview?sessionId=${encodeURIComponent(sessionId)}`);
  }, [sessionId, router]);

  return (
    <div className={styles.wizard}>
      {/* Phase indicators */}
      <div className={styles.section}>
        <div className={styles.label}>Upload Progress</div>
        <div className={styles.phaseContainer}>
          {PHASES.map((p, index) => {
            const isActive = index === currentPhaseIndex && status !== "done" && !(p === "select" && validationResult?.valid === true);
            const isCompleted = index < currentPhaseIndex || (status === "done" && index === currentPhaseIndex) || ((p === "select" || p === "validate") && validationResult?.valid === true);
            const isLast = index === PHASES.length - 1;

            return (
              <PhaseIndicator
                key={p}
                phase={p}
                index={index}
                isActive={isActive}
                isCompleted={isCompleted}
                isLast={isLast}
                getPhaseLabel={getPhaseLabel}
              />
            );
          })}
        </div>
      </div>

      {/* File selection */}
      <div className={styles.section}>
        <div className={styles.label}>File Selection</div>
        <div className={styles.fileInputWrapper}>
          <label className={fileButtonClassName}>
            {file ? "Change File" : "Choose File"}
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={isBusy}
              ref={fileInputRef}
              onChange={handleFileChange}
              className={styles.hiddenInput}
            />
          </label>
          {fileInfo ? (
            <div className={styles.fileInfo}>{fileInfo}</div>
          ) : (
            <div className={styles.fileHint}>Choose a CSV file (up to 2GB).</div>
          )}
        </div>
      </div>

      {/* Status display */}
      {(phase !== "select" || validationResult || displayError) && (
        <div className={`${styles.status} ${statusClassName}`}>
          <div className={styles.statusContent}>
            <div className={styles.statusIcon}>
              {status === "done" ? "✓" : status === "error" ? "✕" : status === "uploading" || status === "retrying" || status === "finalizing" ? "⟳" : "ℹ"}
            </div>
            <div className={styles.statusInfo}>
              <div className={styles.statusTitle}>{getPhaseLabel(phase)}</div>
              <div className={styles.statusDescription}>
                {getPhaseDescription(phase, status, error)}
              </div>
              {displayError && (
                <div className={styles.statusError}>{displayError}</div>
              )}
              {sessionId && (
                <div className={styles.statusSession}>Session: {sessionId.slice(0, 8)}…</div>
              )}
              {failedChunks.length > 0 && (
                <div className={`${styles.statusError} ${styles.statusErrorMargin}`}>
                  {failedChunks.length} chunk(s) failed. Click Retry to upload them again.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Progress bar */}
      {(phase === "upload" || phase === "finalize") && (
        <div className={styles.progress}>
          <div className={styles.progressHeader}>
            <div className={styles.progressLabel}>Upload Progress</div>
            <div className={styles.progressPercent}>{Math.round(progress * 100)}%</div>
          </div>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{width: `${Math.round(progress * 100)}%`}}
            />
          </div>
          <div className={styles.progressDetails}>
            {formatBytes(Math.round(progress * (file?.size ?? 0)))}
            {" / "}
            {formatBytes(file?.size ?? 0)}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className={styles.actions}>
        <button
          onClick={handleStart}
          disabled={!canStart}
          className={`${styles.button} ${styles.buttonPrimary}`}
        >
          Start Upload
        </button>

        {canRetry && (
          <button
            onClick={handleRetry}
            className={`${styles.button} ${styles.buttonRetry}`}
          >
            Retry Upload
          </button>
        )}

        <button
          onClick={handleCancel}
          disabled={!isBusy}
          className={`${styles.button} ${styles.buttonSecondary}`}
        >
          Cancel
        </button>

        <button
          onClick={handleReset}
          className={`${styles.button} ${styles.buttonTertiary}`}
        >
          Reset
        </button>

        {status === "done" && sessionId && (
          <button
            onClick={handleViewPreview}
            className={`${styles.button} ${styles.buttonSuccess}`}
          >
            View Preview
          </button>
        )}
      </div>
    </div>
  );
}
