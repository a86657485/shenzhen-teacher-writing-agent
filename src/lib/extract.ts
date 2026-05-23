import mammoth from "mammoth";
import pdfParse from "pdf-parse";

export type ExtractedText = {
  title: string;
  text: string;
};

export async function extractTextFromFile(buffer: Buffer, fileName: string): Promise<ExtractedText> {
  const extension = fileName.split(".").pop()?.toLowerCase();
  const title = fileName.replace(/\.[^.]+$/, "");

  if (extension === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return { title, text: result.value };
  }

  if (extension === "pdf") {
    const result = await pdfParse(buffer);
    return { title, text: result.text };
  }

  if (extension === "txt" || extension === "md" || extension === "markdown") {
    return { title, text: new TextDecoder("utf-8").decode(buffer) };
  }

  throw new Error("仅支持 .docx、.pdf、.txt、.md 文件。");
}
