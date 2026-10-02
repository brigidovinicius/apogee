export function shouldRequireManualReview(text: string) {
  return text.replace(/\s+/g, " ").trim().length < 80;
}

export async function parsePdf(bytes: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({ data: bytes }).promise;
  const pages: Array<{ page: number; text: string }> = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ").replace(/\s+/g, " ").trim();
    pages.push({ page: pageNumber, text });
  }
  const fullText = pages.map((page) => page.text).join("\n");
  return { pages, fullText, requiresManualReview: shouldRequireManualReview(fullText) };
}