import OpenAI from "openai";
import { appConfig, requireDeepSeekKey } from "./config";

export function getDeepSeekClient() {
  requireDeepSeekKey();
  return new OpenAI({
    apiKey: appConfig.deepseekApiKey,
    baseURL: appConfig.deepseekBaseUrl,
  });
}
