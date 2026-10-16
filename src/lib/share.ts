export async function exportIcs(icsContent: string, filename: string): Promise<void> {
  const file = new File([icsContent], filename, { type: "text/calendar" });

  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[]; title?: string }) => Promise<void>;
  };

  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename });
      return;
    } catch (err) {
      // user cancelled the share sheet — not an error, fall through to download
      if ((err as Error).name === "AbortError") return;
      // any other share failure falls back to a plain download below
    }
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
