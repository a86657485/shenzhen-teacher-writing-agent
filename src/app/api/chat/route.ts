import { NextResponse } from "next/server";
import { z } from "zod";
import { getDeepSeekClient } from "@/lib/deepseek";
import { appConfig } from "@/lib/config";
import { buildUserPrompt, SYSTEM_PROMPT } from "@/lib/prompt";
import { searchKnowledge } from "@/lib/knowledge";

export const runtime = "nodejs";

const BodySchema = z.object({
  topic: z.string().min(2),
  role: z.string().default("深圳一线教师"),
  stage: z.string().default("小学"),
  subject: z.string().default("美术"),
  wordCount: z.string().default("900-1200字"),
  outputMode: z.string().default("完整：审题+框架+范文+素材"),
});

export async function POST(request: Request) {
  try {
    const body = BodySchema.parse(await request.json());
    const contexts = await searchKnowledge(`${body.topic}\n${body.stage}${body.subject}\n${body.outputMode}`, 8);
    const client = getDeepSeekClient();

    const completion = (await client.chat.completions.create({
      model: appConfig.deepseekModel,
      stream: true,
      max_tokens: 6000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: buildUserPrompt(body.topic, body, contexts),
        },
      ],
      extra_body: { thinking: { type: "disabled" } },
    } as any)) as unknown as AsyncIterable<any>;

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "sources",
              sources: contexts.map((context) => ({
                title: context.title,
                sourceUrl: context.sourceUrl,
                score: context.score,
              })),
            })}\n\n`,
          ),
        );

        try {
          for await (const chunk of completion) {
            const delta = chunk.choices[0]?.delta as { content?: string; reasoning_content?: string };
            const content = delta.content ?? "";
            if (content) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "delta", content })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
          controller.close();
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "error",
                error: error instanceof Error ? error.message : "生成失败。",
              })}\n\n`,
            ),
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "生成失败。" },
      { status: 500 },
    );
  }
}
