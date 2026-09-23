import { Types } from "mongoose";
import { Chunk } from "../models";
import { embedText } from "./geminiService";
import { OcrPage } from "./documentAiService";

const CHUNK_SIZE_CHARS = 1800; // ~roughly 450-500 tokens
const CHUNK_OVERLAP_CHARS = 300;

interface RawChunk {
  text: string;
  pageNumber: number;
}

function chunkPage(page: OcrPage): RawChunk[] {
  const chunks: RawChunk[] = [];
  const text = page.text;
  if (text.length <= CHUNK_SIZE_CHARS) {
    return [{ text, pageNumber: page.pageNumber }];
  }
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE_CHARS, text.length);
    chunks.push({ text: text.slice(start, end), pageNumber: page.pageNumber });
    if (end === text.length) break;
    start = end - CHUNK_OVERLAP_CHARS;
  }
  return chunks;
}

/** Chunks every page, embeds each chunk, and stores it for vector search with batching. */
export async function chunkAndEmbedDocument(
  documentId: Types.ObjectId,
  pages: OcrPage[]
): Promise<number> {
  const rawChunks = pages.flatMap(chunkPage).filter((c) => c.text.trim().length > 0);
  if (rawChunks.length === 0) return 0;

  // Parallel embedding generation
  const chunkDocs = await Promise.all(
    rawChunks.map(async (chunk) => {
      const embedding = await embedText(chunk.text);
      return {
        documentId,
        pageNumber: chunk.pageNumber,
        text: chunk.text,
        embedding,
      };
    })
  );

  // Bulk insertion for high efficiency
  const inserted = await Chunk.insertMany(chunkDocs);
  return inserted.length;
}


/**
 * Retrieves top-k relevant chunks for a question using MongoDB Atlas
 * Vector Search. Requires a vector index named "embedding_index" on the
 * "embedding" field of the "chunks" collection (see README for the
 * index definition JSON).
 */
export async function retrieveRelevantChunks(
  documentId: Types.ObjectId,
  question: string,
  topK = 5
): Promise<{ text: string; pageNumber: number }[]> {
  // MOCK MODE — replace with real MongoDB Atlas Vector Search when Atlas index is ready
  if (process.env.MOCK_MODE === "true") {
    console.log(`[certus] MOCK VECTOR SEARCH: In-memory chunk retrieval for doc ${documentId}`);
    const chunks = await Chunk.find({ documentId }).lean();
    if (!chunks.length) return [];

    const qTokens = question
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2);

    const scored = chunks.map((c) => {
      const textLower = c.text.toLowerCase();
      let score = 0;
      for (const t of qTokens) {
        if (textLower.includes(t)) score += 1;
      }
      return { chunk: c, score };
    });

    // Sort chunks by keyword relevance score descending
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map((s) => ({
      text: s.chunk.text,
      pageNumber: s.chunk.pageNumber,
    }));
  }

  // Real MongoDB Atlas Vector Search
  const queryEmbedding = await embedText(question);

  const results = await Chunk.aggregate([
    {
      $vectorSearch: {
        index: "embedding_index",
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: 100,
        limit: topK,
        filter: { documentId },
      },
    },
    { $project: { text: 1, pageNumber: 1, _id: 0 } },
  ]);

  return results;
}
