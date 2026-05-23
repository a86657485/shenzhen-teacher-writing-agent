import path from "node:path";

export const appConfig = {
  databasePath: path.resolve(process.cwd(), process.env.DATABASE_PATH ?? "./data/knowledge.sqlite"),
  deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
  deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? "",
  deepseekModel: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-pro",
  embeddingProvider: process.env.EMBEDDING_PROVIDER ?? "transformers",
  embeddingModel: process.env.EMBEDDING_MODEL ?? "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
};

export function requireDeepSeekKey() {
  if (!appConfig.deepseekApiKey) {
    throw new Error("DEEPSEEK_API_KEY is missing. Add it to .env.local.");
  }
}
