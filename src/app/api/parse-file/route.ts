// /api/parse-file — extract text from uploaded files (PDF, etc.)
// Supports PDFs via pdf-parse, and plain text files directly.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const name = file.name.toLowerCase();
    const buf = Buffer.from(await file.arrayBuffer());
    let text = "";

    if (name.endsWith(".pdf")) {
      // PDF text extraction (server-side, pdf-parse)
      const mod = await import("pdf-parse");
      const pdfParse = (mod as any).default || mod;
      const data = await pdfParse(buf);
      text = data.text;
    } else {
      // plain text files (txt, md, csv, json, code, etc.)
      text = buf.toString("utf-8");
    }

    // Truncate to keep context manageable
    text = text.replace(/\s{3,}/g, "\n\n").trim().slice(0, 15000);

    if (!text) return NextResponse.json({ error: "Could not extract text" }, { status: 422 });

    return NextResponse.json({ name: file.name, text, length: text.length });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Parse failed" },
      { status: 500 }
    );
  }
}
