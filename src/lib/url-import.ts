import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { normalizeText } from "./chunk";

const TRUSTED_HOST_KEYWORDS = [
  "moe.gov.cn",
  "szeb.sz.gov.cn",
  "edu.gd.gov.cn",
  "xinhuanet.com",
  "people.com.cn",
  "jyb.cn",
  "sztqb.sznews.com",
  "sznews.com",
];

function firstMeta(document: Document, selectors: string[]) {
  for (const selector of selectors) {
    const value = document.querySelector(selector)?.getAttribute("content")
      ?? document.querySelector(selector)?.getAttribute("datetime")
      ?? document.querySelector(selector)?.textContent;
    if (value?.trim()) return value.trim();
  }
  return "";
}

function detectPublishedAt(document: Document, html: string) {
  const meta = firstMeta(document, [
    "meta[property='article:published_time']",
    "meta[name='publishdate']",
    "meta[name='PubDate']",
    "meta[name='date']",
    "meta[name='publishTime']",
    "time[datetime]",
  ]);
  if (meta) return meta;

  const match = html.match(/20\d{2}[-年/.]\d{1,2}[-月/.]\d{1,2}/);
  return match?.[0]?.replace(/[年月/.]/g, "-").replace(/日/g, "") ?? "";
}

export function isTrustedSource(url: string) {
  try {
    const host = new URL(url).hostname;
    return TRUSTED_HOST_KEYWORDS.some((keyword) => host.endsWith(keyword) || host.includes(keyword));
  } catch {
    return false;
  }
}

export async function fetchArticle(url: string) {
  const target = new URL(url);
  if (!["http:", "https:"].includes(target.protocol)) {
    throw new Error("只支持 http 或 https 链接。");
  }

  const response = await fetch(target, {
    headers: {
      "user-agent": "Mozilla/5.0 ShenzhenTeacherWritingAgent/0.1",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`抓取失败：${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const dom = new JSDOM(html, { url: target.toString() });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  const fallbackText = dom.window.document.body?.textContent ?? "";
  const text = normalizeText(article?.textContent ?? fallbackText);

  if (text.length < 120) {
    throw new Error("未能从该网页提取到足够正文内容。");
  }

  return {
    title: article?.title || dom.window.document.title || target.hostname,
    text,
    publishedAt: detectPublishedAt(dom.window.document, html),
    trusted: isTrustedSource(target.toString()),
    url: target.toString(),
  };
}
