import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withApiLogging } from "@/lib/server/api-logging";
import { serverError } from "@/lib/server/api-error";

export const maxDuration = 60;

type ReferenceKind = "sop" | "transcript";

function isReferenceKind(value: unknown): value is ReferenceKind {
  return value === "sop" || value === "transcript";
}

// Guards the PDF/DOCX parse below from being handed an oversized or
// unexpected file type -- both checks run before extractText() so a bad
// upload never reaches the (comparatively expensive) parser.
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = [".txt", ".md", ".csv", ".pdf", ".docx"];

// SOP stays a single reference (enforced by a partial unique index in the
// DB), but a creator's formula is rarely captured by one transcript --
// this bounds how many can pile up per user rather than leaving it
// unlimited (keeps the combined-transcripts prompt payload sane too).
const MAX_TRANSCRIPTS_PER_USER = 10;

function hasAllowedExtension(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

// Extension is just a UI hint from the client and is trivially spoofed (a
// script renamed to report.pdf still has the extension "pdf"), so the actual
// bytes have to start with the format's real magic number before we hand
// them to the parser.
const PDF_MAGIC = Buffer.from("%PDF-", "ascii");
const DOCX_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // ZIP local file header (docx is a zip)

function hasValidMagicBytes(name: string, buffer: Buffer): boolean {
  if (name.endsWith(".pdf")) {
    return buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC);
  }
  if (name.endsWith(".docx")) {
    return buffer.subarray(0, DOCX_MAGIC.length).equals(DOCX_MAGIC);
  }
  // .txt/.md/.csv have no magic number to check -- the null-byte heuristic
  // below is what catches non-text content for those.
  return true;
}

// Extracts plain text from an uploaded reference file. SOPs/transcripts are
// realistically PDF or Word docs (this app even exports SOPs as PDF/DOCX
// elsewhere), so those get parsed server-side instead of forcing users to
// convert to .txt first. Anything else is read as raw UTF-8 text.
async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (!hasValidMagicBytes(name, buffer)) {
    throw new Error("That file's contents don't match its extension. Please upload a genuine .txt, .pdf, or .docx file.");
  }

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
    throw new Error("Legacy .doc files aren't supported. Please save it as .docx or .pdf instead.");
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
    .select("id, kind, file_name, content, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    return serverError("script-references GET", error);
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

  // Reject an oversized body by its declared Content-Length before
  // request.formData() buffers the whole thing into memory -- the
  // file.size check below runs too late to prevent that buffering, it only
  // stops an oversized file from reaching the parser afterward.
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "File is too large (max 10MB)." }, { status: 413 });
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

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "File is too large (max 10MB)." }, { status: 400 });
  }

  if (!hasAllowedExtension(file.name)) {
    return NextResponse.json(
      { error: `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}` },
      { status: 400 }
    );
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

  if (kind === "sop") {
    // Only one SOP per user -- upsert against the partial unique index that
    // enforces that, so a re-upload replaces rather than piles up.
    const { data, error } = await supabase
      .from("script_reference_files")
      .upsert(
        { user_id: user.id, kind, file_name: file.name, content },
        { onConflict: "user_id,kind" }
      )
      .select("id")
      .single();

    if (error) {
      return serverError("script-references PUT", error);
    }

    return NextResponse.json({ success: true, id: data.id, fileName: file.name, content });
  }

  // Transcripts append instead of replacing -- a formula is usually
  // reverse-engineered from several of a creator's videos at once, not one.
  const { count, error: countError } = await supabase
    .from("script_reference_files")
    .select("id", { count: "exact", head: true })
    .eq("kind", "transcript");

  if (countError) {
    return serverError("script-references PUT (count)", countError);
  }
  if ((count ?? 0) >= MAX_TRANSCRIPTS_PER_USER) {
    return NextResponse.json(
      { error: `You can upload up to ${MAX_TRANSCRIPTS_PER_USER} transcripts. Remove one before adding another.` },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("script_reference_files")
    .insert({ user_id: user.id, kind, file_name: file.name, content })
    .select("id")
    .single();

  if (error) {
    return serverError("script-references PUT", error);
  }

  return NextResponse.json({ success: true, id: data.id, fileName: file.name, content });
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
  const id: unknown = body?.id;

  if (!isReferenceKind(kind)) {
    return NextResponse.json({ error: "kind must be 'sop' or 'transcript'" }, { status: 400 });
  }

  // Transcripts can have several rows, so a delete without an id would be
  // ambiguous -- SOP is still singular, so falling back to kind-only there
  // keeps the simple "clear my SOP" call working.
  let query = supabase.from("script_reference_files").delete().eq("kind", kind);
  if (kind === "transcript" || typeof id === "string") {
    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "id is required to delete a transcript" }, { status: 400 });
    }
    query = query.eq("id", id);
  }

  const { error } = await query;

  if (error) {
    return serverError("script-references DELETE", error);
  }

  return NextResponse.json({ success: true });
}

export const GET = withApiLogging("/api/script-references", handleGET);
export const PUT = withApiLogging("/api/script-references", handlePUT);
export const DELETE = withApiLogging("/api/script-references", handleDELETE);
