import { PDFParse } from "pdf-parse";
import { DocumentProcessorServiceClient } from "@google-cloud/documentai";

let docAiClient: DocumentProcessorServiceClient | null = null;
function getDocAiClient(): DocumentProcessorServiceClient {
  if (!docAiClient) {
    docAiClient = new DocumentProcessorServiceClient({ apiEndpoint: `${process.env.GCP_LOCATION || "us"}-documentai.googleapis.com` });
  }
  return docAiClient;
}

export interface OcrPage {
  pageNumber: number;
  text: string;
}

export interface OcrResult {
  fullText: string;
  pages: OcrPage[];
}


/**
 * Sends a file buffer to Google Document AI and returns OCR'd text,
 * split by page so citations can reference a page number.
 */
export async function runOcr(fileBuffer: Buffer, mimeType: string): Promise<OcrResult> {
  // MOCK MODE — replace with real Google Cloud call when GCP credentials are ready
  if (process.env.MOCK_MODE === "true") {
    const parser = new PDFParse({ data: new Uint8Array(fileBuffer) });
    try {
      const result = await parser.getText();
      const pages = result.pages.map(page => ({ pageNumber: page.num, text: page.text.trim() }));
      if (!pages.some(page => page.text)) throw new Error("No readable PDF text. Scanned PDFs require live Document AI OCR.");
      return { pages, fullText: pages.map(page => page.text).join("\n\n") };
    } finally { await parser.destroy(); }
  }

  // Real Google Cloud Document AI call
  const projectId = process.env.GCP_PROJECT_ID;
  const location = process.env.GCP_LOCATION || "us";
  const processorId = process.env.DOCAI_PROCESSOR_ID;

  if (!projectId || !processorId) {
    throw new Error(
      "GCP_PROJECT_ID and DOCAI_PROCESSOR_ID must be set to run OCR"
    );
  }

  const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

  const client = getDocAiClient();
  const [result] = await client.processDocument({
    name,
    rawDocument: {
      content: fileBuffer.toString("base64"),
      mimeType,
    },
  }, { timeout: 60_000 });

  const document = result.document;
  const fullText = document?.text || "";
  if (!fullText.trim()) throw new Error("OCR returned no readable text");

  const pages: OcrPage[] = (document?.pages || []).map((page, idx) => {
    const segments = page.layout?.textAnchor?.textSegments || [];
    let pageText = "";
    for (const seg of segments) {
      const start = Number(seg.startIndex || 0);
      const end = Number(seg.endIndex || 0);
      pageText += fullText.slice(start, end);
    }
    return { pageNumber: idx + 1, text: pageText || fullText };
  });

  return { fullText, pages: pages.length ? pages : [{ pageNumber: 1, text: fullText }] };
}
