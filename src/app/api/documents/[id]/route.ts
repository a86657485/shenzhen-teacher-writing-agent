import { NextResponse } from "next/server";
import { deleteDocument, listChunks } from "@/lib/knowledge";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  return NextResponse.json({ chunks: listChunks(id) });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  deleteDocument(id);
  return NextResponse.json({ ok: true });
}
