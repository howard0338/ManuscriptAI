import { NextResponse } from "next/server";

/**
 * RAG API for scoped retrieval
 * - scope: 'intro' | 'methods' | 'results'
 * - Filter by metadata (Introduction/Background, Methods, Results)
 * - In production, wire to LlamaIndex + vector store with semantic segmentation (e.g. MarkdownElementNodeParser)
 */

export type RagScope = "intro" | "methods" | "results";

/** Metadata filter per scope for vector queries */
const SCOPE_METADATA_FILTER: Record<
  RagScope,
  { sections: string[]; description: string }
> = {
  intro: {
    sections: ["introduction", "background", "literature review"],
    description: "Retrieve only blocks tagged introduction / background / literature review",
  },
  methods: {
    sections: ["methods", "materials", "experimental", "procedures"],
    description: "Retrieve experimental steps and parameters (methods / materials / experimental)",
  },
  results: {
    sections: ["results", "figures", "tables", "discussion"],
    description: "Retrieve results and related figure/table descriptions",
  },
};

/**
 * Get system instruction for "currently writing {scope}" (prompt engineering)
 */
export function getScopePromptInstruction(scope: RagScope): string {
  const scopeLabel =
    scope === "intro"
      ? "Introduction / Background & literature"
      : scope === "methods"
        ? "Materials & Methods"
        : "Results";
  return `You are currently writing the **${scopeLabel}** section. Strictly use logic and data from the corresponding RAG passages; do not cite irrelevant sections.`;
}

/** Single retrieval chunk with source_id for GPT [[source_id]] citation */
export type RagChunkWithSource = {
  source_id: string;
  text: string;
  title?: string;
  author?: string;
};

/** Source info returned to frontend (for [[source_id]]) */
export type RagSourceDetail = {
  source_id: string;
  title?: string;
  author?: string;
  excerpt: string;
};

/**
 * Mock retrieval: return chunks with source_id. In production, query vector store by metadata and attach title/author.
 */
export function mockRetrieve(
  scope: RagScope,
  _ragSourceIds?: string[]
): RagChunkWithSource[] {
  const { sections } = SCOPE_METADATA_FILTER[scope];
  return [
    {
      source_id: `${scope}_1`,
      text: "Polymer-based nanomaterials have attracted significant attention due to tunable properties and applications in biomedicine and catalysis. Molecular weight and architecture control enable precise tailoring of mechanical and thermal behavior.",
      title: "Advances in Polymer Nanomaterials",
      author: "Smith et al.",
    },
    {
      source_id: `${scope}_2`,
      text: "Controlled radical polymerization (ATRP, RAFT) has expanded the toolkit for well-defined block copolymers with narrow dispersity, enabling precise macromolecular design.",
      title: "Controlled Radical Polymerization",
      author: "Johnson & Lee",
    },
    {
      source_id: `${scope}_3`,
      text: "Characterization of polymer nanostructures relies on scattering techniques and microscopy. SAXS provides morphology insights at nanometer to sub-micron length scales.",
      title: "Scattering Methods for Polymer Characterization",
      author: "Chen et al.",
    },
  ];
}

/** Build context string for GPT (each block tagged [source_id]) and sources list */
function buildContextAndSources(chunks: RagChunkWithSource[]): {
  context: string;
  sources: RagSourceDetail[];
} {
  const context = chunks
    .map(
      (c) =>
        `--- [${c.source_id}] ---\n${c.text}\n(cite as [[${c.source_id}]])`
    )
    .join("\n\n");
  const sources: RagSourceDetail[] = chunks.map((c) => ({
    source_id: c.source_id,
    title: c.title,
    author: c.author,
    excerpt: c.text.slice(0, 300) + (c.text.length > 300 ? "…" : ""),
  }));
  return { context, sources };
}

/** For other APIs: get retrieval result, prompt instruction and sources for a scope */
export function getRagContextForScope(
  scope: RagScope,
  ragSourceIds?: string[]
): {
  scope_instruction: string;
  context: string;
  chunks: RagChunkWithSource[];
  sources: RagSourceDetail[];
} {
  const scopeInstruction = getScopePromptInstruction(scope);
  const chunks = mockRetrieve(scope, ragSourceIds);
  const { context, sources } = buildContextAndSources(chunks);
  return { scope_instruction: scopeInstruction, context, chunks, sources };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { scope, rag_sources } = body as {
      scope: RagScope;
      rag_sources?: Array<{ id: string; type: string; name: string }>;
    };

    if (!scope || !["intro", "methods", "results"].includes(scope)) {
      return NextResponse.json(
        { error: "scope is required and must be one of: intro, methods, results" },
        { status: 400 }
      );
    }

    const filterSpec = SCOPE_METADATA_FILTER[scope as RagScope];
    const result = getRagContextForScope(
      scope as RagScope,
      rag_sources?.map((s) => s.id)
    );

    return NextResponse.json({
      scope,
      metadata_filter: filterSpec,
      scope_instruction: result.scope_instruction,
      chunks: result.chunks,
      sources: result.sources,
      context: result.context,
    });
  } catch (err) {
    console.error("RAG API error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
