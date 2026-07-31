import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withApiLogging } from "@/lib/server/api-logging";

export const maxDuration = 60;

type ReferenceKind = "sop" | "transcript";

function isReferenceKind(value: unknown): value is ReferenceKind {
  return value === "sop" || value === "transcript";
}

// Extracts plain text from an uploaded reference file. SOPs/transcripts are
// realistically PDF or Word docs (this app even exports SOPs as PDF/DOCX
// elsewhere), so those get parsed server-side instead of forcing users to
// convert to .txt first. Anything else is read as raw UTF-8 text.
async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (name.endsWith(".pdf")) {
    const { extractText: extractPdfText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractPdfText(pdf, { mergePages: true });
    return text;
  }

  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  }

  if (name.endsWith(".doc")) {
    throw new Error("Legacy .doc files aren't supported — please save it as .docx or .pdf instead.");
  }

  const text = buffer.toString("utf-8");
  if (text.includes("\u0000")) {
    throw new Error("This file doesn't look like plain text. Please upload a .txt, .pdf, or .docx file.");
  }
  return text;
}

async function handleGET(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("script_reference_files")
    .select("kind, file_name, content, created_at");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ referenceFiles: data });
}

async function handlePUT(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const kind = formData.get("kind");
  const file = formData.get("file");

  if (!isReferenceKind(kind)) {
    return NextResponse.json({ error: "kind must be 'sop' or 'transcript'" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  let content: string;
  try {
    content = (await extractText(file)).trim();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't read that file." },
      { status: 400 }
    );
  }

  if (!content) {
    return NextResponse.json({ error: "That file doesn't contain any readable text." }, { status: 400 });
  }

  const { error } = await supabase
    .from("script_reference_files")
    .upsert(
      { user_id: user.id, kind, file_name: file.name, content },
      { onConflict: "user_id,kind" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, fileName: file.name, content });
}

async function handleDELETE(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const kind: unknown = body?.kind;

  if (!isReferenceKind(kind)) {
    return NextResponse.json({ error: "kind must be 'sop' or 'transcript'" }, { status: 400 });
  }

  const { error } = await supabase.from("script_reference_files").delete().eq("kind", kind);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export const GET = withApiLogging("/api/script-references", handleGET);
export const PUT = withApiLogging("/api/script-references", handlePUT);
export const DELETE = withApiLogging("/api/script-references", handleDELETE);
