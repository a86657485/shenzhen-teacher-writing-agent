"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpenCheck,
  Database,
  FileText,
  GraduationCap,
  LinkIcon,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Send,
  Settings2,
  Trash2,
  Upload,
} from "lucide-react";

type DocumentItem = {
  id: string;
  title: string;
  kind: string;
  source_type: string;
  source_url: string | null;
  file_name: string | null;
  created_at: string;
  char_count: number;
  chunk_count: number;
};

type SourceItem = {
  title: string;
  sourceUrl: string | null;
  score: number;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceItem[];
};

const stages = ["小学", "初中", "高中", "幼儿园"];
const subjects = ["美术", "语文", "数学", "英语", "科学", "体育", "音乐", "信息科技", "道德与法治", "综合实践"];
const wordCounts = ["900-1200字", "800字左右", "1000字左右", "1200字左右"];
const outputModes = ["完整：审题+框架+范文+素材", "只写完整范文", "只要审题和框架", "范文+可背诵句式"];

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function newId() {
  return Math.random().toString(36).slice(2);
}

export default function Home() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [activeMobileTab, setActiveMobileTab] = useState<"chat" | "library">("chat");
  const [url, setUrl] = useState("");
  const [topic, setTopic] = useState("");
  const [stage, setStage] = useState("小学");
  const [subject, setSubject] = useState("美术");
  const [role, setRole] = useState("深圳一线教师");
  const [wordCount, setWordCount] = useState("900-1200字");
  const [outputMode, setOutputMode] = useState("完整：审题+框架+范文+素材");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "请上传范文、导入权威文章，或直接输入作文题目。我会结合深圳教师招聘写作引擎、知识库资料和你的教师身份设置生成范文。",
    },
  ]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const stats = useMemo(() => {
    const chunks = documents.reduce((sum, item) => sum + item.chunk_count, 0);
    const chars = documents.reduce((sum, item) => sum + item.char_count, 0);
    return { chunks, chars };
  }, [documents]);

  async function loadDocuments() {
    setLoadingDocs(true);
    try {
      const response = await fetch("/api/documents");
      const data = await response.json();
      setDocuments(data.documents ?? []);
    } finally {
      setLoadingDocs(false);
    }
  }

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function seedDocs() {
    setBusy(true);
    setNotice("正在导入当前目录的 5 篇范文，首次向量化可能需要一点时间...");
    try {
      const response = await fetch("/api/seed", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "导入失败");
      setNotice(`已导入 ${data.imported?.length ?? 0} 篇范文。`);
      await loadDocuments();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "导入失败。");
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("kind", "上传资料");
    setBusy(true);
    setNotice(`正在上传并向量化：${file.name}`);
    try {
      const response = await fetch("/api/documents", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "上传失败");
      setNotice(`已入库：${file.name}`);
      await loadDocuments();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "上传失败。");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function importUrl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    setNotice("正在抓取网页正文并写入知识库...");
    try {
      const response = await fetch("/api/import-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "导入失败");
      setNotice(data.article?.trusted ? "权威文章已导入知识库。" : "网页已导入，但来源不在内置权威站点列表。");
      setUrl("");
      await loadDocuments();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "导入失败。");
    } finally {
      setBusy(false);
    }
  }

  async function deleteDoc(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/documents/${id}`, { method: "DELETE" });
      await loadDocuments();
      setNotice("资料已删除。");
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = topic.trim();
    if (!trimmed || busy) return;

    const assistantId = newId();
    setMessages((current) => [
      ...current,
      { id: newId(), role: "user", content: trimmed },
      { id: assistantId, role: "assistant", content: "正在检索知识库并生成..." },
    ]);
    setTopic("");
    setBusy(true);
    setNotice("DeepSeek V4 Pro 正在生成，资料来源会先返回。");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic: trimmed, role, stage, subject, wordCount, outputMode }),
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "生成失败。");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let content = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const eventText of events) {
          const line = eventText.split("\n").find((item) => item.startsWith("data: "));
          if (!line) continue;
          const payload = JSON.parse(line.slice(6));

          if (payload.type === "sources") {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? { ...message, content: "", sources: payload.sources as SourceItem[] }
                  : message,
              ),
            );
          }

          if (payload.type === "delta") {
            content += payload.content;
            setMessages((current) =>
              current.map((message) => (message.id === assistantId ? { ...message, content } : message)),
            );
          }

          if (payload.type === "error") {
            throw new Error(payload.error);
          }
        }
      }

      setNotice("生成完成。");
    } catch (error) {
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? { ...message, content: error instanceof Error ? error.message : "生成失败。" }
            : message,
        ),
      );
      setNotice(error instanceof Error ? error.message : "生成失败。");
    } finally {
      setBusy(false);
    }
  }

  const library = (
    <aside className="panel library-panel">
      <div className="panel-title">
        <div>
          <p className="eyebrow">Local Knowledge</p>
          <h2>资料库</h2>
        </div>
        <button className="icon-button" onClick={loadDocuments} disabled={loadingDocs} title="刷新资料库">
          <RefreshCw size={18} className={loadingDocs ? "spin" : ""} />
        </button>
      </div>

      <div className="stats-grid">
        <div>
          <span>{documents.length}</span>
          <p>资料</p>
        </div>
        <div>
          <span>{stats.chunks}</span>
          <p>片段</p>
        </div>
        <div>
          <span>{formatNumber(stats.chars)}</span>
          <p>字符</p>
        </div>
      </div>

      <button className="primary ghost" onClick={seedDocs} disabled={busy}>
        {busy ? <Loader2 size={17} className="spin" /> : <BookOpenCheck size={17} />}
        导入当前 5 篇范文
      </button>

      <div className="upload-box" onClick={() => fileInputRef.current?.click()}>
        <Upload size={22} />
        <div>
          <strong>上传资料</strong>
          <p>支持 docx、pdf、txt、md</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx,.pdf,.txt,.md,.markdown"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) uploadFile(file);
          }}
        />
      </div>

      <form className="url-form" onSubmit={importUrl}>
        <label htmlFor="url">导入权威文章 URL</label>
        <div className="input-row">
          <LinkIcon size={17} />
          <input
            id="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://www.moe.gov.cn/..."
          />
          <button type="submit" disabled={busy || !url.trim()} title="导入链接">
            导入
          </button>
        </div>
      </form>

      <div className="doc-list">
        {documents.map((item) => (
          <article className="doc-card" key={item.id}>
            <div className="doc-icon">
              <FileText size={17} />
            </div>
            <div className="doc-main">
              <h3>{item.title}</h3>
              <p>
                {item.kind} · {item.chunk_count} 片段 · {formatNumber(item.char_count)} 字
              </p>
              {item.source_url ? <a href={item.source_url} target="_blank">查看来源</a> : null}
            </div>
            <button className="delete-button" onClick={() => deleteDoc(item.id)} title="删除资料">
              <Trash2 size={16} />
            </button>
          </article>
        ))}
      </div>
    </aside>
  );

  const settings = (
    <section className="panel settings-panel">
      <div className="panel-title compact">
        <Settings2 size={18} />
        <h2>写作设置</h2>
      </div>

      <label>
        教师身份
        <input value={role} onChange={(event) => setRole(event.target.value)} />
      </label>

      <div className="two-col">
        <label>
          学段
          <select value={stage} onChange={(event) => setStage(event.target.value)}>
            {stages.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          学科
          <select value={subject} onChange={(event) => setSubject(event.target.value)}>
            {subjects.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>

      <label>
        目标字数
        <select value={wordCount} onChange={(event) => setWordCount(event.target.value)}>
          {wordCounts.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>

      <label>
        输出模式
        <select value={outputMode} onChange={(event) => setOutputMode(event.target.value)}>
          {outputModes.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
    </section>
  );

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark">
          <GraduationCap size={24} />
        </div>
        <div>
          <p className="eyebrow">Shenzhen Teacher Writing Agent</p>
          <h1>深圳教师招聘作文智能体</h1>
        </div>
      </header>

      <nav className="mobile-tabs" aria-label="移动端视图切换">
        <button className={activeMobileTab === "chat" ? "active" : ""} onClick={() => setActiveMobileTab("chat")}>
          <MessageSquareText size={17} />
          对话
        </button>
        <button
          className={activeMobileTab === "library" ? "active" : ""}
          onClick={() => setActiveMobileTab("library")}
        >
          <Database size={17} />
          资料
        </button>
      </nav>

      <div className="workspace">
        <div className={`left-rail ${activeMobileTab === "library" ? "mobile-visible" : ""}`}>
          {library}
          {settings}
        </div>

        <section className={`chat-panel ${activeMobileTab === "chat" ? "mobile-visible" : ""}`}>
          <div className="chat-header">
            <div>
              <p className="eyebrow">DeepSeek V4 Pro</p>
              <h2>作文对话</h2>
            </div>
            <div className="profile-pill">
              {stage} · {subject}
            </div>
          </div>

          <div className="messages">
            {messages.map((message) => (
              <article className={`message ${message.role}`} key={message.id}>
                <div className="message-role">{message.role === "user" ? "题目" : "智能体"}</div>
                {message.sources?.length ? (
                  <div className="sources">
                    {message.sources.map((source, index) => (
                      <span key={`${source.title}-${index}`}>
                        {source.title} · {(source.score * 100).toFixed(0)}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="message-content">{message.content}</div>
              </article>
            ))}
            <div ref={chatEndRef} />
          </div>

          <form className="composer" onSubmit={sendMessage}>
            <textarea
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="输入题目，例如：请围绕“教育强国背景下教师何为”写一篇深圳教师招聘主观题作文。"
              rows={4}
            />
            <button type="submit" disabled={busy || !topic.trim()}>
              {busy ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
              生成
            </button>
          </form>
        </section>
      </div>

      <div className={`status-bar ${notice ? "show" : ""}`}>{notice}</div>
    </main>
  );
}
