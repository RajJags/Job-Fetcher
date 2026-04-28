import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { NextResponse } from "next/server";
import { aiExtractProfile } from "@/lib/resume/ai-extract";
import { extractCandidateProfile } from "@/lib/resume/extract";

async function extractText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name   = file.name.toLowerCase();

  if (name.endsWith(".pdf")) {
    const parsed = await pdfParse(buffer);
    return parsed.text;
  }
  if (name.endsWith(".docx")) {
    const parsed = await mammoth.extractRawText({ buffer });
    return parsed.value;
  }
  if (name.endsWith(".txt")) {
    return buffer.toString("utf8");
  }
  throw new Error("Unsupported file format. Upload PDF, DOCX, or TXT.");
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Resume file is required." }, { status: 400 });
    }

    const text = await extractText(file);

    // Use AI extraction when ANTHROPIC_API_KEY is set; otherwise fall back to regex
    let profile;
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        profile = await aiExtractProfile(text, file.name);
      } catch (aiErr) {
        console.warn(
          "[parse-resume] AI extraction failed, using regex fallback:",
          aiErr instanceof Error ? aiErr.message : String(aiErr)
        );
        profile = extractCandidateProfile(text, file.name);
      }
    } else {
      profile = extractCandidateProfile(text, file.name);
    }

    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to parse resume." },
      { status: 500 }
    );
  }
}
