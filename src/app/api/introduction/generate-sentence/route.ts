import OpenAI from "openai";
import { NextResponse } from "next/server";
import { getRagContextForScope } from "../../rag/route";

const SYSTEM_GENERATE = `You are an academic writer. Given the context (sentences before and after), generate exactly ONE new sentence in English that:
1. Reflects the viewpoint or theme of the provided source (literature excerpt or document).
2. Fits logically between the context before and after.
3. Is suitable for a journal Introduction. No numbering or citation markers unless the user request asks for [[source_id]].`;

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
    const {
      sourceId,
      sourceName,
      contextBefore,
      contextAfter,
      rag_sources,
    } = body as {
      sourceId: string;
      sourceName: string;
      contextBefore?: string;
      contextAfter?: string;
      rag_sources?: Array<{ id: string; type: string; name: string }>;
    };

    if (!sourceName?.trim()) {
      return NextResponse.json(
        { error: "sourceName is required" },
        { status: 400 }
      );
    }

    let sourceViewpoint = `Document/source: "${sourceName}".`;
    const rag = getRagContextForScope(
      "intro",
      rag_sources?.map((s) => s.id) ?? [sourceId]
    );
    if (rag.chunks.length > 0) {
      const first = rag.chunks[0];
      sourceViewpoint = `Source: "${first.title ?? sourceName}" (${first.author ?? ""}). Excerpt: ${first.text.slice(0, 400)}.`;
    }

    const before = (contextBefore ?? "").trim();
    const after = (contextAfter ?? "").trim();
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_GENERATE },
        {
          role: "user",
          content: `Generate one sentence for an Introduction.\n\nSource to reflect:\n${sourceViewpoint}\n\nContext before (previous sentence): ${before || "(none)"}\n\nContext after (next sentence): ${after || "(none)"}\n\nOutput only the single sentence, nothing else.`,
        },
      ],
      max_tokens: 150,
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const firstLine = raw.trim().split(/\n/)[0]?.trim() ?? "";
    const sentence = firstLine || raw.trim();

    return NextResponse.json({ sentence });
  } catch (err) {
    console.error("Generate-sentence API error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
