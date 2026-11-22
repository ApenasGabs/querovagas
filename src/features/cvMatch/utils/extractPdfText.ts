export const MAX_RESUME_FILE_BYTES = 5 * 1024 * 1024;
export const MIN_RESUME_CHARS = 200;
export const MAX_RESUME_CHARS = 30_000;

export type ResumeFileError = "invalid_type" | "file_too_large" | "empty_file";

export const RESUME_FILE_ERROR_MESSAGES: Record<ResumeFileError, string> = {
  invalid_type: "Envie o currículo em formato PDF.",
  file_too_large: "O PDF precisa ter no máximo 5 MB.",
  empty_file: "O arquivo está vazio.",
};

export const validateResumeFile = (file: File): ResumeFileError | null => {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return "invalid_type";
  if (file.size === 0) return "empty_file";
  if (file.size > MAX_RESUME_FILE_BYTES) return "file_too_large";
  return null;
};

/** Normaliza espaços/linhas preservando quebras de parágrafo. */
export const normalizeResumeText = (text: string): string =>
  text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v\u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/**
 * Extrai o texto do PDF inteiramente no navegador (o arquivo nunca é enviado ao servidor).
 * O pdfjs é carregado sob demanda para não pesar o bundle inicial.
 */
export const extractPdfText = async (file: File): Promise<string> => {
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });

  try {
    const doc = await loadingTask.promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ("str" in item ? `${item.str}${item.hasEOL ? "\n" : " "}` : ""))
        .join("");
      pages.push(pageText);
      page.cleanup();
    }
    await doc.cleanup();
    return normalizeResumeText(pages.join("\n\n"));
  } finally {
    await loadingTask.destroy();
  }
};
