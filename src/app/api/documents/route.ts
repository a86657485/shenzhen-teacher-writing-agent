import { NextResponse } from "next/server";
import { extractTextFromFile } from "@/lib/extract";
import { ingestDocument, listDocuments } from "@/lib/knowledge";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ documents: listDocuments() });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const kind = String(formData.get("kind") ?? "资料");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "请选择要上传的文件。" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const extracted = await extractTextFromFile(buffer, file.name);
    const result = await ingestDocument({
      title: extracted.title,
      text: extracted.text,
      kind,
      sourceType: "upload",
      fileName: file.name,
      replaceExisting: true,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "上传失败。" },
      { status: 500 },
    );
  }
}
