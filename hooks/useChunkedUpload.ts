"use client";

import type {UploadInitResponse} from "@/lib/types";
import {useCallback, useRef, useState} from "react";

type UploadStatus =
  | "idle"
  | "initializing"
  | "uploading"
  | "retrying"
  | "finalizing"
  | "done"
  | "error"
  | "canceled";

interface ChunkState {
  index: number;
  uploaded: boolean;
  bytes: number;
  retryCount: number;
}

interface UploadState {
  status: UploadStatus;
  progress: number;
  error: string | null;
  sessionId: string | null;
  uploadedBytes: number;
  totalBytes: number;
  failedChunks: number[];
  currentChunk: number | null;
}

interface StoredUploadState {
  sessionId: string;
  fileSize: number;
  uploadedChunks: number[];
}

const DEFAULT_CHUNK_BYTES = 1024 * 1024; // 1MB
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;
const STORAGE_KEY_PREFIX = "upload_state_";

/**
 * Waits for a specified delay in milliseconds.
 * Used to implement exponential backoff during retries.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculates the exponential backoff delay for a given retry.
 * The delay doubles for each attempt (1s, 2s, 4s, 8s, 16s) up to a maximum of 30s.
 */
function calculateBackoffDelay(retryCount: number): number {
  const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount);
  return Math.min(delay, MAX_RETRY_DELAY_MS);
}

/**
 * Generates the localStorage key to store the upload state for a session.
 */
function getStorageKey(sessionId: string): string {
  return `${STORAGE_KEY_PREFIX}${sessionId}`;
}

/**
 * Loads the upload state stored in localStorage for a given session.
 * Returns null if no state is found or in case of parsing error.
 */
function loadUploadState(sessionId: string): StoredUploadState | null {
  try {
    const stored = localStorage.getItem(getStorageKey(sessionId));
    if (!stored) return null;
    return JSON.parse(stored) as StoredUploadState;
  } catch {
    return null;
  }
}

/**
 * Saves the upload state in localStorage to allow for later resume.
 * Silently ignores storage errors (quota exceeded, etc.).
 */
function saveUploadState(state: StoredUploadState): void {
  try {
    localStorage.setItem(getStorageKey(state.sessionId), JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Updates the list of uploaded chunks in the localStorage state.
 * Adds the chunkIndex to the list if it is not already present and sorts the list.
 */
function updateUploadedChunks(sessionId: string, chunkIndex: number): void {
  const state = loadUploadState(sessionId);
  if (!state) return;

  if (!state.uploadedChunks.includes(chunkIndex)) {
    state.uploadedChunks.push(chunkIndex);
    state.uploadedChunks.sort((a, b) => a - b);
    saveUploadState(state);
  }
}

/**
 * Deletes the upload state from localStorage for a given session.
 * Called after a successful upload or when resetting.
 */
function clearUploadState(sessionId: string): void {
  try {
    localStorage.removeItem(getStorageKey(sessionId));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Uploads a chunk with automatic retry and exponential backoff.
 * Retries up to MAX_RETRIES times in case of failure, with increasing delays.
 * Calls onRetry for each retry attempt to update the UI.
 * Updates localStorage with the uploaded chunk in case of success.
 */
async function uploadChunkWithRetry(
  sessionId: string,
  chunkIndex: number,
  totalChunks: number,
  blob: Blob,
  abortSignal: AbortSignal,
  onRetry: (chunkIndex: number, retryCount: number) => void
): Promise<void> {
  let retryCount = 0;

  while (retryCount <= MAX_RETRIES) {
    if (abortSignal.aborted) {
      throw new Error("Upload canceled");
    }

    try {
      const buf = await blob.arrayBuffer();

      const chunkRes = await fetch("/api/upload/chunk", {
        method: "POST",
        headers: {
          "content-type": "application/octet-stream",
          "x-session-id": sessionId,
          "x-chunk-index": String(chunkIndex),
          "x-total-chunks": String(totalChunks),
        },
        body: buf,
        signal: abortSignal,
      });

      if (!chunkRes.ok) {
        throw new Error(`chunk ${chunkIndex} failed (${chunkRes.status})`);
      }

      updateUploadedChunks(sessionId, chunkIndex);
      return;
    } catch (error: unknown) {
      if (abortSignal.aborted) {
        throw new Error("Upload canceled");
      }

      if (retryCount >= MAX_RETRIES) {
        throw error;
      }

      retryCount++;
      onRetry(chunkIndex, retryCount);

      const delay = calculateBackoffDelay(retryCount - 1);
      await sleep(delay);
    }
  }
}

/**
 * Hook React to manage chunked file uploads with automatic retry,
 * byte-based progress tracking, robust state machine, and partial upload resume.
 * 
 * Features:
 * - Sequential chunk upload with automatic retry (exponential backoff)
 * - Progress calculated in bytes (not just chunk count)
 * - Robust state machine with clear transitions (idle, initializing, uploading, retrying, finalizing, done, error, canceled)
 * - Partial upload resume via localStorage (detection of already uploaded chunks)
 * - Partial failure handling with possibility to resume
 */
export function useChunkedUpload() {
  const [state, setState] = useState<UploadState>({
    status: "idle",
    progress: 0,
    error: null,
    sessionId: null,
    uploadedBytes: 0,
    totalBytes: 0,
    failedChunks: [],
    currentChunk: null,
  });

  const abortRef = useRef<AbortController | null>(null);
  const chunkStatesRef = useRef<Map<number, ChunkState>>(new Map());

  /**
   * Update the progress of the upload by calculating the ratio of uploaded bytes / total bytes.
   * The progress is based on the actual bytes, not just the number of chunks,
   * which gives a more precise representation, especially for the last chunk.
   */
  const updateProgress = useCallback((uploadedBytes: number, totalBytes: number) => {
    const progress = totalBytes > 0 ? uploadedBytes / totalBytes : 0;
    setState((prev) => ({
      ...prev,
      progress,
      uploadedBytes,
      totalBytes,
    }));
  }, []);

  /**
   * Reset the upload state completely.
   * Cancel the ongoing upload, clear the refs, delete the localStorage state
   * and reset all states to their initial values.
   */
  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    chunkStatesRef.current.clear();
    if (state.sessionId) {
      clearUploadState(state.sessionId);
    }
    setState({
      status: "idle",
      progress: 0,
      error: null,
      sessionId: null,
      uploadedBytes: 0,
      totalBytes: 0,
      failedChunks: [],
      currentChunk: null,
    });
  }, [state.sessionId]);

  /**
   * Cancel the ongoing upload by aborting the abort signal.
   * Change the status to "canceled" but keep the state for possible resume.
   */
  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState((prev) => ({...prev, status: "canceled"}));
  }, []);

  /**
   * Start or resume a file upload.
   * 
   * If resumeSessionId is provided, load the state from localStorage and resume
   * the upload by skipping the already uploaded chunks.
   * 
   * Otherwise, initialize a new upload session via the /api/upload/init API.
   * 
   * Process:
   * 1. Initialization (new session or resume)
   * 2. Calculate the already uploaded chunks (for resume)
   * 3. Sequential upload of missing chunks with automatic retry
   * 4. Finalization via /api/upload/finalize
   * 5. Cleanup of the localStorage state
   * 
   * Handle partial failures by keeping the state for possible resume.
   */
  const start = useCallback(async (file: File, resumeSessionId?: string) => {
    setState((prev) => ({
      ...prev,
      error: null,
      progress: 0,
      status: "initializing",
      uploadedBytes: 0,
      totalBytes: file.size,
      failedChunks: [],
      currentChunk: null,
    }));

    const abort = new AbortController();
    abortRef.current = abort;
    chunkStatesRef.current.clear();

    try {
      let sessionId: string;
      let uploadedChunkIndices: number[] = [];

      if (resumeSessionId) {
        sessionId = resumeSessionId;
        const storedState = loadUploadState(sessionId);
        if (storedState && storedState.fileSize === file.size) {
          uploadedChunkIndices = storedState.uploadedChunks;
        }
        setState((prev) => ({...prev, sessionId}));
      } else {
        const initRes = await fetch("/api/upload/init", {
          method: "POST",
          headers: {"content-type": "application/json"},
          body: JSON.stringify({filename: file.name, size: file.size}),
          signal: abort.signal,
        });
        if (!initRes.ok) throw new Error(`init failed (${initRes.status})`);
        const initJson = (await initRes.json()) as UploadInitResponse;
        sessionId = initJson.sessionId;

        const initialState: StoredUploadState = {
          sessionId,
          fileSize: file.size,
          uploadedChunks: [],
        };
        saveUploadState(initialState);

        setState((prev) => ({...prev, sessionId}));
        localStorage.setItem("lastSessionId", sessionId);
      }

      const chunkSize = DEFAULT_CHUNK_BYTES;
      const totalChunks = Math.ceil(file.size / chunkSize);
      const uploadedSet = new Set(uploadedChunkIndices);

      let totalUploadedBytes = 0;
      for (const idx of uploadedChunkIndices) {
        const startByte = idx * chunkSize;
        const endByte = Math.min(startByte + chunkSize, file.size);
        totalUploadedBytes += endByte - startByte;
      }

      updateProgress(totalUploadedBytes, file.size);

      setState((prev) => ({
        ...prev,
        status: "uploading",
        uploadedBytes: totalUploadedBytes,
      }));

      const failedChunks: number[] = [];

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        if (abort.signal.aborted) {
          throw new Error("Upload canceled");
        }

        if (uploadedSet.has(chunkIndex)) {
          continue;
        }

        setState((prev) => ({
          ...prev,
          currentChunk: chunkIndex,
        }));

        const startByte = chunkIndex * chunkSize;
        const endByte = Math.min(startByte + chunkSize, file.size);
        const blob = file.slice(startByte, endByte);
        const chunkBytes = endByte - startByte;

        try {
          await uploadChunkWithRetry(
            sessionId,
            chunkIndex,
            totalChunks,
            blob,
            abort.signal,
            (idx, retryCount) => {
              setState((prev) => ({
                ...prev,
                status: "retrying",
                currentChunk: idx,
              }));
            }
          );

          totalUploadedBytes += chunkBytes;
          updateProgress(totalUploadedBytes, file.size);

          setState((prev) => ({
            ...prev,
            status: "uploading",
          }));

          chunkStatesRef.current.set(chunkIndex, {
            index: chunkIndex,
            uploaded: true,
            bytes: chunkBytes,
            retryCount: 0,
          });
        } catch (error: unknown) {
          failedChunks.push(chunkIndex);
          chunkStatesRef.current.set(chunkIndex, {
            index: chunkIndex,
            uploaded: false,
            bytes: chunkBytes,
            retryCount: MAX_RETRIES,
          });

          if (abort.signal.aborted) {
            throw new Error("Upload canceled");
          }

          throw error;
        }
      }

      if (failedChunks.length > 0) {
        setState((prev) => ({
          ...prev,
          status: "error",
          error: `Failed to upload ${failedChunks.length} chunk(s): ${failedChunks.join(", ")}`,
          failedChunks,
        }));
        return;
      }

      setState((prev) => ({
        ...prev,
        status: "finalizing",
        currentChunk: null,
      }));

      const finRes = await fetch("/api/upload/finalize", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({sessionId}),
        signal: abort.signal,
      });
      if (!finRes.ok) throw new Error(`finalize failed (${finRes.status})`);

      clearUploadState(sessionId);

      setState((prev) => ({
        ...prev,
        status: "done",
        progress: 1,
        uploadedBytes: file.size,
      }));
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      if (error instanceof Error && error.message === "Upload canceled") {
        return;
      }
      setState((prev) => ({
        ...prev,
        status: "error",
        error: error instanceof Error ? error.message : "Upload failed",
      }));
    }
  }, [updateProgress]);

  return {
    status: state.status,
    progress: state.progress,
    error: state.error,
    sessionId: state.sessionId,
    uploadedBytes: state.uploadedBytes,
    totalBytes: state.totalBytes,
    failedChunks: state.failedChunks,
    currentChunk: state.currentChunk,
    start,
    cancel,
    reset,
  };
}
