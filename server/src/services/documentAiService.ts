import { DocumentProcessorServiceClient } from "@google-cloud/documentai";

let docAiClient: DocumentProcessorServiceClient | null = null;
function getDocAiClient(): DocumentProcessorServiceClient {
  if (!docAiClient) {
    docAiClient = new DocumentProcessorServiceClient();
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

const SAMPLE_EMPLOYMENT_CONTRACT_PAGES: string[] = [
  `EXECUTIVE EMPLOYMENT AGREEMENT

This Executive Employment Agreement (the "Agreement") is entered into as of January 15, 2024, by and between Apex Global Technologies Inc., a Delaware corporation (the "Company"), and Sarah Jenkins ("Executive").

1. Position and Duties. Executive shall serve as Vice President of Engineering, reporting directly to the Chief Technology Officer. Executive shall devote substantially all professional time, attention, and effort to the performance of duties hereunder.

2. Term of Employment. The term of employment commences on February 1, 2024, and shall continue on an at-will basis until terminated in accordance with Section 5 of this Agreement.

3. Compensation and Benefits.
(a) Base Salary: The Company shall pay Executive an initial annual base salary of $240,000, payable in accordance with the Company's standard payroll practices.
(b) Annual Discretionary Bonus: Executive shall be eligible to receive an annual performance-based discretionary bonus with a target of 25% of annual base salary, subject to individual and corporate performance milestones.
(c) Equity Incentive: Subject to Board approval, Executive will be granted an option to purchase 50,000 shares of common stock, vesting over four (4) years with a one-year cliff.`,

  `4. Restrictive Covenants and Confidentiality.
(a) Confidential Information: Executive acknowledges access to proprietary trade secrets, customer data, and intellectual property of the Company. Executive agrees to maintain strict confidentiality both during and after employment.
(b) Non-Competition: During the term of employment and for a period of twelve (12) months following termination of employment for any reason, Executive shall not directly or indirectly engage in, perform services for, or invest in any competing enterprise within North America.
(c) Non-Solicitation of Customers and Employees: For eighteen (18) months following termination, Executive shall not solicit, recruit, or hire any current employee or induce any client or customer of the Company to terminate or reduce their business relationship.
(d) Inventions Assignment: All discoveries, software, and works of authorship created by Executive within the scope of employment are deemed "works made for hire" and assigned exclusively to the Company.`,

  `5. Termination and Severance.
(a) Notice of Resignation: Executive may terminate employment by providing at least sixty (60) days prior written notice to the Company. In the event of early resignation without sufficient notice, accrued bonuses and unvested equity shall be forfeited immediately.
(b) Termination for Cause: The Company may terminate employment immediately for Cause upon written notice. Cause includes material breach of this Agreement, fraud, embezzlement, or felony conviction.
(c) Termination Without Cause / Severance: If the Company terminates Executive without Cause, Executive shall be entitled to continuation of base salary for six (6) months, contingent upon execution of a binding release of claims.

6. Governing Law and Dispute Resolution.
This Agreement shall be construed, interpreted, and governed in accordance with the laws of the State of Delaware, without regard to conflict of laws principles. Any dispute arising under or relating to this Agreement shall be submitted to confidential binding arbitration administered by JAMS in Wilmington, Delaware.`
];

/**
 * Sends a file buffer to Google Document AI and returns OCR'd text,
 * split by page so citations can reference a page number.
 */
export async function runOcr(fileBuffer: Buffer, mimeType: string): Promise<OcrResult> {
  // MOCK MODE — replace with real Google Cloud call when GCP credentials are ready
  if (process.env.MOCK_MODE === "true") {
    console.log(`[certus] MOCK OCR: Processing uploaded file (${mimeType}, ${fileBuffer.length} bytes)`);

    // Check if buffer contains readable utf-8 text (e.g., text/plain, markdown, or text-based mock pdf)
    const rawString = fileBuffer.toString("utf-8");
    const isPrintableAscii = /^[\x09\x0A\x0D\x20-\x7E\xA0-\xFF\u2000-\u206F]*$/.test(rawString.slice(0, 500));

    if ((mimeType.startsWith("text/") || isPrintableAscii) && rawString.trim().length > 50 && !rawString.startsWith("%PDF")) {
      // Split by form-feed, double-dash page markers, or paragraphs
      const pageChunks = rawString.split(/\f|\n--- Page \d+ ---\n/).filter((s) => s.trim().length > 0);
      const pages: OcrPage[] = pageChunks.length > 0
        ? pageChunks.map((chunk, idx) => ({ pageNumber: idx + 1, text: chunk.trim() }))
        : [{ pageNumber: 1, text: rawString.trim() }];
      const fullText = pages.map((p) => p.text).join("\n\n");
      return { fullText, pages };
    }

    // Default realistic employment contract with 3 distinct pages
    const pages: OcrPage[] = SAMPLE_EMPLOYMENT_CONTRACT_PAGES.map((text, idx) => ({
      pageNumber: idx + 1,
      text: text.trim(),
    }));
    const fullText = pages.map((p) => p.text).join("\n\n");
    return { fullText, pages };
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
  });

  const document = result.document;
  const fullText = document?.text || "";

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
