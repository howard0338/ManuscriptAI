import OpenAI from "openai";
import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are a professional academic manuscript advisor, specialized in polymer science and biomedical materials. Guide the user in discussing manuscript structure and give expert advice based on their selected RAG library (e.g. Polymer Science).`;

function buildSystemMessage(ragContext?: string | null): string {
  if (ragContext?.trim()) {
    return `${SYSTEM_PROMPT}\n\nCurrent user RAG library: ${ragContext}. In your replies, tailor advice to this library's domain and style.`;
  }
  return SYSTEM_PROMPT;
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
    const { messages = [], ragContext } = body as {
      messages?: Array<{ role: "user" | "assistant" | "system"; content: string }>;
      ragContext?: string | null;
    };

    const openai = new OpenAI({ apiKey });
    const systemContent = buildSystemMessage(ragContext);

    const apiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemContent },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: apiMessages,
      max_tokens: 1024,
    });

    const reply = completion.choices[0]?.message?.content ?? "";
    return NextResponse.json({ message: reply });
  } catch (err) {
    console.error("Chat API error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
