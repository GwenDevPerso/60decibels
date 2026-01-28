import styles from "./layout.module.css";

export default function RootLayout({children}: {children: React.ReactNode;}) {
  return (
    <html lang="en">
      <body className={styles.body}>
        <div className={styles.container}>
          <header className={styles.header}>
            <div className={styles.headerTitle}>Large Upload Take-home</div>
            <div className={styles.headerSubtitle}>Chunked uploads + data preview</div>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}

