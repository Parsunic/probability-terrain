const MIN_CHUNK_CHARS = 80;
const MAX_CHUNK_CHARS = 600;

/**
 * Splits raw notes into chunk-sized pieces of roughly paragraph length.
 * Short adjacent paragraphs are merged together; long paragraphs are
 * split on sentence boundaries.
 */
export function chunkText(raw: string): string[] {
  const paragraphs = raw
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0);

  const chunks: string[] = [];
  let buffer = "";

  for (const paragraph of paragraphs) {
    const candidate = buffer ? `${buffer} ${paragraph}` : paragraph;

    if (candidate.length <= MAX_CHUNK_CHARS) {
      buffer = candidate;
      if (buffer.length >= MIN_CHUNK_CHARS) {
        chunks.push(buffer);
        buffer = "";
      }
      continue;
    }

    if (buffer) {
      chunks.push(buffer);
      buffer = "";
    }

    if (paragraph.length <= MAX_CHUNK_CHARS) {
      buffer = paragraph;
      if (buffer.length >= MIN_CHUNK_CHARS) {
        chunks.push(buffer);
        buffer = "";
      }
      continue;
    }

    // Paragraph too long on its own — split on sentence boundaries.
    const sentences = paragraph.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) ?? [paragraph];
    let sentenceBuffer = "";
    for (const sentence of sentences) {
      const sentenceCandidate = sentenceBuffer ? `${sentenceBuffer} ${sentence.trim()}` : sentence.trim();
      if (sentenceCandidate.length > MAX_CHUNK_CHARS && sentenceBuffer) {
        chunks.push(sentenceBuffer);
        sentenceBuffer = sentence.trim();
      } else {
        sentenceBuffer = sentenceCandidate;
      }
    }
    if (sentenceBuffer) buffer = sentenceBuffer;
  }

  if (buffer) {
    // Merge a too-short trailing chunk into the previous one.
    if (buffer.length < MIN_CHUNK_CHARS && chunks.length > 0) {
      chunks[chunks.length - 1] += ` ${buffer}`;
    } else {
      chunks.push(buffer);
    }
  }

  return chunks;
}
