import { NextResponse } from "next/server";
import { z } from "zod";
import { ingestDocument } from "@/lib/knowledge";
import { fetchArticle } from "@/lib/url-import";

export const runtime = "nodejs";

const BodySchema = z.object({
  url: z.string().url(),
  kind: z.string().default("权威文章"),
});

export async function POST(request: Request) {
  try {
    const body = BodySchema.parse(await request.json());
    const article = await fetchArticle(body.url);
    const title = article.publishedAt ? `${article.title}（${article.publishedAt}）` : article.title;
    const result = await ingestDocument({
      title,
      text: article.text,
      kind: article.trusted ? body.kind : "网页资料",
      sourceType: "url",
      sourceUrl: article.url,
      replaceExisting: true,
    });

    return NextResponse.json({
      ok: true,
      result,
      article: {
        title,
        url: article.url,
        trusted: article.trusted,
        publishedAt: article.publishedAt,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "导入链接失败。" },
      { status: 500 },
    );
  }
}
