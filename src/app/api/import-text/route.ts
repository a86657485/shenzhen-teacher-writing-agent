import { NextResponse } from "next/server";
import { z } from "zod";
import { ingestDocument } from "@/lib/knowledge";

export const runtime = "nodejs";

const BodySchema = z.object({
  title: z.string().min(1, "请填写标题。"),
  text: z.string().min(40, "正文太短，无法入库。"),
  sourceUrl: z.string().url().optional().or(z.literal("")),
  kind: z.string().default("手动粘贴资料"),
});

export async function POST(request: Request) {
  try {
    const body = BodySchema.parse(await request.json());
    const result = await ingestDocument({
      title: body.title,
      text: body.text,
      kind: body.kind,
      sourceType: "url",
      sourceUrl: body.sourceUrl || undefined,
      replaceExisting: true,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues.map((issue) => issue.message).join("；")
        : error instanceof Error
          ? error.message
          : "导入正文失败。";

    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
