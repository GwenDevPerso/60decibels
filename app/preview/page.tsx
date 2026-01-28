import DataPreviewTable from "@/components/DataPreviewTable"

export default function PreviewPage() {
  return (
    <main>
      <h1 style={{ margin: "8px 0 4px" }}>Preview</h1>
      <p style={{ marginTop: 0, color: "#555" }}>
        Basic sanity-check view: column list + first rows.
      </p>
      <DataPreviewTable />
    </main>
  )
}

