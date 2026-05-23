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

function isWeChatArticle(url: URL) {
  return url.hostname.includes("mp.weixin.qq.com");
}

function firstMeta(document: Document, selectors: string[]) {
  for (const selector of selectors) {
    const value = document.querySelector(selector)?.getAttribute("content")
      ?? document.querySelector(selector)?.getAttribute("datetime")
      ?? document.querySelector(selector)?.textContent;
    if (value?.trim()) return value.trim();
  }
  return "";
}

function cleanupExtractedText(text: string) {
  return normalizeText(
    text
      .replace(/微信扫一扫\s*关注该公众号/g, "")
      .replace(/继续滑动看下一个/g, "")
      .replace(/轻触阅读原文/g, "")
      .replace(/向上滑动看下一个/g, ""),
  );
}

function publishedAtFromWeChat(html: string) {
  const publishTime = html.match(/publish_time\s*=\s*["']([^"']+)["']/)?.[1];
  if (publishTime) return publishTime;

  const ct = html.match(/var\s+ct\s*=\s*["']?(\d{10})["']?/)?.[1];
  if (!ct) return "";

  const date = new Date(Number(ct) * 1000);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
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

function extractWeChatArticle(document: Document, html: string, target: URL) {
  const contentNode =
    document.querySelector("#js_content")
    ?? document.querySelector(".rich_media_content")
    ?? document.querySelector("[id='js_content']");
  const title =
    firstMeta(document, [
      "meta[property='og:title']",
      "meta[name='twitter:title']",
      "meta[name='title']",
      "#activity-name",
      ".rich_media_title",
    ])
    || document.title
    || "微信公众号文章";
  const author =
    firstMeta(document, [
      "meta[property='og:article:author']",
      "meta[name='author']",
      "#js_name",
      ".rich_media_meta_text",
    ]);
  const text = cleanupExtractedText(contentNode?.textContent ?? "");

  if (text.length < 120) {
    const bodyText = cleanupExtractedText(document.body?.textContent ?? "");
    const blocked = /环境异常|访问过于频繁|验证码|请在微信客户端打开|当前浏览器不支持/.test(bodyText);
    if (blocked) {
      throw new Error("微信公众号限制了服务器抓取。请在微信里打开文章，复制标题和正文后用“粘贴正文入库”。");
    }
  }

  return {
    title: author ? `${title}｜${author}` : title,
    text,
    publishedAt: publishedAtFromWeChat(html) || detectPublishedAt(document, html),
    trusted: false,
    url: target.toString(),
  };
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
      "user-agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0",
      accept: "text/html,application/xhtml+xml",
      "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`抓取失败：${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const dom = new JSDOM(html, { url: target.toString() });

  if (isWeChatArticle(target)) {
    const article = extractWeChatArticle(dom.window.document, html, target);
    if (article.text.length >= 120) {
      return article;
    }
  }

  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  const fallbackText = dom.window.document.body?.textContent ?? "";
  const text = cleanupExtractedText(article?.textContent ?? fallbackText);

  if (text.length < 120) {
    if (isWeChatArticle(target)) {
      throw new Error("未能从微信公众号链接提取到足够正文。请在微信里复制全文，然后使用“粘贴正文入库”。");
    }
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
