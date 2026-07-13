import { NextRequest, NextResponse } from "next/server";

// Shape of the incoming request body.
interface BendRequestBody {
  sourceNiche?: string;
  targetNiche?: string;
  transcripts?: string[];
}

// Shape of the SOP object we ask the model to produce.
interface NicheBendSOP {
  hookFormula: string;
  structure: string[];
  pacing: string;
  dos: string[];
  donts: string[];
}

// Shape of the full JSON result we ask the model to produce.
interface NicheBendResult {
  analysis: string;
  sop: NicheBendSOP;
  scriptIdeas: string[];
  scripts: string[];
}

// Cloudflare Workers AI chat response shape (subset we rely on).
// `response` is typed loosely because Cloudflare returns it either as a
// JSON-encoded string or as an already-parsed object depending on the run.
interface CloudflareAIResponse {
  success: boolean;
  errors?: { code: number; message: string }[];
  result?: {
    response?: string | Record<string, unknown>;
  };
}

// The model occasionally emits raw control characters (literal newlines,
// tabs, etc.) inside JSON string values — e.g. multi-line scripts — which
// violates the JSON spec and makes JSON.parse throw. Escape any control
// character found while inside a string literal before parsing.
function sanitizeJsonControlCharacters(text: string): string {
  let result = "";
  let inString = false;
  let escaped = false;

  for (const char of text) {
    if (inString) {
      if (escaped) {
        result += char;
        escaped = false;
        continue;
      }
      if (char === "\\") {
        result += char;
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = false;
        result += char;
        continue;
      }
      const code = char.charCodeAt(0);
      if (code < 0x20) {
        switch (char) {
          case "\n":
            result += "\\n";
            break;
          case "\r":
            result += "\\r";
            break;
          case "\t":
            result += "\\t";
            break;
          default:
            result += `\\u${code.toString(16).padStart(4, "0")}`;
        }
        continue;
      }
      result += char;
    } else {
      if (char === '"') {
        inString = true;
      }
      result += char;
    }
  }

  return result;
}

// Outcome of a single Cloudflare call + parse attempt.
type BendAttempt =
  | { ok: true; result: NicheBendResult }
  | { ok: false; error: string };

// The 8B model occasionally free-forms malformed JSON (unescaped control
// characters, stray commas). A single retry clears most of these transient
// failures without materially affecting latency.
const MAX_ATTEMPTS = 3;

async function requestNicheBend(
  accountId: string,
  apiToken: string,
  prompt: string
): Promise<BendAttempt> {
  const cfResponse = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: "You are Clypa's niche bending AI.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        // The requested JSON payload (SOP + 3 scripts) is large; the
        // model's default max_tokens truncates it mid-output otherwise.
        max_tokens: 8192,
      }),
    }
  );

  if (!cfResponse.ok) {
    return { ok: false, error: "Cloudflare AI request failed." };
  }

  const cfData = (await cfResponse.json()) as CloudflareAIResponse;

  if (!cfData.success || !cfData.result?.response) {
    return { ok: false, error: "Cloudflare AI request failed." };
  }

  // Cloudflare's response shape for `result.response` is inconsistent:
  // it may come back as an already-parsed JSON object, or as a string
  // (possibly wrapped in markdown fences / surrounding text). Handle both.
  const rawResponse = cfData.result.response;

  if (typeof rawResponse === "string") {
    const jsonMatch = rawResponse.trim().match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return {
        ok: false,
        error: "Cloudflare AI returned an unparseable response.",
      };
    }

    try {
      const result = JSON.parse(
        sanitizeJsonControlCharacters(jsonMatch[0])
      ) as NicheBendResult;
      return { ok: true, result };
    } catch {
      return { ok: false, error: "Cloudflare AI returned invalid JSON." };
    }
  }

  if (typeof rawResponse === "object" && rawResponse !== null) {
    return { ok: true, result: rawResponse as unknown as NicheBendResult };
  }

  return {
    ok: false,
    error: "Cloudflare AI returned an unparseable response.",
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as BendRequestBody;
    const { sourceNiche, targetNiche, transcripts } = body;

    // Validate required fields.
    if (!sourceNiche || !targetNiche) {
      return NextResponse.json(
        { error: "Source niche and target niche are required." },
        { status: 400 }
      );
    }

    // Validate Cloudflare credentials are configured.
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !apiToken) {
      return NextResponse.json(
        { error: "Cloudflare credentials are not configured." },
        { status: 500 }
      );
    }

    // Build the prompt sent to the model.
    const transcriptsBlock =
      transcripts && transcripts.length > 0
        ? transcripts.join("\n\n")
        : "None provided.";

    const prompt = `You are Clypa, an AI specializing in TikTok niche bending.

Your task is to analyze a proven viral faceless niche and transform its winning structure into another niche while preserving what makes it go viral.

Source niche:
${sourceNiche}

Target niche:
${targetNiche}

Reference transcripts:
${transcriptsBlock}

Generate:
- Why this niche works
- A complete SOP
- Hook formulas
- Content structure
- Pacing recommendations
- Do's and Don'ts
- Five content ideas
- Three ready-to-film scripts

Return ONLY valid JSON using this structure:

{
  "analysis": "...",
  "sop": {
    "hookFormula": "...",
    "structure": [],
    "pacing": "...",
    "dos": [],
    "donts": []
  },
  "scriptIdeas": [],
  "scripts": []
}`;

    // Call Cloudflare Workers AI, retrying on transient malformed output.
    let lastError = "Cloudflare AI request failed.";
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const attemptResult = await requestNicheBend(accountId, apiToken, prompt);

      if (attemptResult.ok) {
        return NextResponse.json(attemptResult.result);
      }

      lastError = attemptResult.error;
    }

    return NextResponse.json({ error: lastError }, { status: 502 });
  } catch (error) {
    console.error("Niche bend route error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
