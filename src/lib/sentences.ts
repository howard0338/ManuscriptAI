/**
 * Split paragraph array into atomic sentences by period (keep period at end of each sentence).
 */
export function paragraphsToSentences(paragraphs: string[]): string[] {
  return paragraphs.flatMap((p) =>
    p
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

/**
 * Join sentence array back into a single paragraph (compatible with introductionParagraphs).
 */
export function sentencesToParagraphs(sentences: string[]): string[] {
  if (sentences.length === 0) return [];
  return [sentences.join(" ")];
}
