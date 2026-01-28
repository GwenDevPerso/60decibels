export type UploadInitResponse = { sessionId: string }

export type PreviewResponse = {
  sessionId: string
  preview: {
    columns: string[]
    types: Record<string, string>
    rows: Array<Record<string, string>>
  }
}

