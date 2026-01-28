import UploadWizard from "@/components/UploadWizard";
import pageStyles from "../page.module.css";

export default function UploadPage() {
  return (
    <main>
      <h1 className={pageStyles.title}>Upload</h1>
      <p className={pageStyles.description}>
        Upload a CSV using chunking (serverless request size constraints assumed).
      </p>
      <UploadWizard />
    </main>
  );
}

