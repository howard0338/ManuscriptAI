import OpenAI from "openai";
import { NextResponse } from "next/server";
import { getRagContextForScope } from "../rag/route";
import type { RagSourceDetail } from "../rag/route";

const SYSTEM_INTRO = `You are an expert academic writer. Based on the user's manuscript title and the selected RAG library domain, write the Introduction section.
Output exactly four paragraphs in English, 2–4 sentences each, suitable for an academic journal. Separate paragraphs with blank lines; no numbering or headings.`;

const CITATION_RULE = `
[Important] You must draw information from the RAG Context below. Whenever you use content from a Context block, cite it at the end of that sentence with [[source_id]], where source_id is the label before that block (e.g. [[intro_1]], [[intro_2]]). Cite at most one or two sources per sentence. Do not invent data or references not present in the Context.`;

function getIntroRagContext(ragSources?: Array<{ id: string; type: string; name: string }>) {
  const ids = ragSources?.map((s) => s.id);
  return getRagContextForScope("intro", ids);
}

/** Parse all [[source_id]] from GPT response text */
function parseSourceIds(text: string): string[] {
  const ids: string[] = [];
  const regex = /\[\[([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m[1] && !ids.includes(m[1])) ids.push(m[1]);
  }
  return ids;
}

function buildIntroSystemPrompt(
  ragContext?: string | null,
  scopeInstruction?: string,
  ragContextText?: string
): string {
  let prompt = SYSTEM_INTRO;
  prompt += CITATION_RULE;
  if (ragContext?.trim()) {
    prompt += `\n\nCurrent RAG library: ${ragContext}. Use this field's terminology and writing style.`;
  }
  if (scopeInstruction?.trim()) {
    prompt += `\n\n${scopeInstruction}`;
  }
  if (ragContextText?.trim()) {
    prompt += `\n\nReference content from scoped retrieval (Introduction/Background). Write from this and cite with [[source_id]] at the end of each sentence:\n---\n${ragContextText}\n---`;
  }
  return prompt;
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { title, ragContext, rag_sources } = body as {
      title: string;
      ragContext?: string | null;
      rag_sources?: Array<{ id: string; type: string; name: string }>;
    };

    if (!title?.trim()) {
      return NextResponse.json(
        { error: "title is required" },
        { status: 400 }
      );
    }

    const introRag = getIntroRagContext(rag_sources);
    const { scope_instruction: scopeInstruction, context: ragContextText, sources: ragSources } = introRag;

    const openai = new OpenAI({ apiKey });
    const systemContent = buildIntroSystemPrompt(
      ragContext,
      scopeInstruction,
      ragContextText
    );

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemContent },
        {
          role: "user",
          content: `Write a 4-paragraph Introduction for this manuscript title (cite RAG sources with [[source_id]] at the end of sentences):\n\n"${title.trim()}"`,
        },
      ],
      max_tokens: 1024,
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const paragraphs = raw
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean)
      .slice(0, 4);

    while (paragraphs.length < 4) {
      paragraphs.push("");
    }

    const citedIds = new Set<string>();
    paragraphs.forEach((p) => parseSourceIds(p).forEach((id) => citedIds.add(id)));
    const sources: RagSourceDetail[] = ragSources.filter((s) =>
      citedIds.has(s.source_id)
    );

    return NextResponse.json({ paragraphs, sources });
  } catch (err) {
    console.error("Introduction API error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
