import DataPreviewTable from "@/components/DataPreviewTable";
import styles from "./preview.module.css";
import pageStyles from "../page.module.css";

export default function PreviewPage() {
  return (
    <main className={styles.main}>
      <h1 className={pageStyles.title}>Preview</h1>
      <p className={pageStyles.description}>
        Basic sanity-check view: column list + first rows.
      </p>
      <DataPreviewTable />
    </main>
  );
}

