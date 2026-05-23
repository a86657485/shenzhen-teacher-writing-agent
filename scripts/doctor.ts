import fs from "node:fs";
import os from "node:os";
import path from "node:path";

type Check = {
  name: string;
  ok: boolean;
  detail: string;
};

function hasEnvKey(file: string, key: string) {
  if (!fs.existsSync(file)) return false;
  const content = fs.readFileSync(file, "utf8");
  const line = content
    .split(/\r?\n/)
    .find((item) => item.trim().startsWith(`${key}=`));
  if (!line) return false;
  const value = line.slice(line.indexOf("=") + 1).trim();
  return Boolean(value) && !value.includes("replace-with") && !value.includes("你的");
}

async function main() {
  const root = process.cwd();
  const checks: Check[] = [];
  const major = Number(process.versions.node.split(".")[0]);

  checks.push({
    name: "Node.js",
    ok: major >= 20,
    detail: `${process.version}（建议 20 或 22 LTS）`,
  });

  checks.push({
    name: ".env.local",
    ok: fs.existsSync(path.join(root, ".env.local")),
    detail: fs.existsSync(path.join(root, ".env.local"))
      ? "已存在"
      : "缺少，请复制 .env.example 为 .env.local",
  });

  checks.push({
    name: "DeepSeek API Key",
    ok: hasEnvKey(path.join(root, ".env.local"), "DEEPSEEK_API_KEY"),
    detail: "只检查是否填写，不会打印密钥",
  });

  checks.push({
    name: "范文 DOCX",
    ok: fs.readdirSync(root).some((entry) => entry.endsWith(".docx")),
    detail: "仓库根目录应包含 5 篇种子范文",
  });

  checks.push({
    name: "data 目录",
    ok: fs.existsSync(path.join(root, "data")) || true,
    detail: "缺少也没关系，首次入库会自动创建",
  });

  try {
    const Database = (await import("better-sqlite3")).default;
    const db = new Database(":memory:");
    db.exec("CREATE TABLE healthcheck (id INTEGER)");
    db.close();
    checks.push({
      name: "better-sqlite3",
      ok: true,
      detail: "原生 SQLite 模块可用",
    });
  } catch (error) {
    checks.push({
      name: "better-sqlite3",
      ok: false,
      detail: error instanceof Error ? error.message : "原生 SQLite 模块不可用",
    });
  }

  console.log(`\n深圳教师招聘作文智能体部署检查`);
  console.log(`系统：${os.platform()} ${os.release()} ${os.arch()}\n`);

  for (const check of checks) {
    console.log(`${check.ok ? "OK " : "ERR"} ${check.name}: ${check.detail}`);
  }

  const failed = checks.filter((check) => !check.ok);
  if (failed.length) {
    console.log("\n建议：");
    console.log("1. 确认已执行 pnpm install。");
    console.log("2. Windows 如遇 better-sqlite3 报错，执行：pnpm approve-builds --all && pnpm rebuild better-sqlite3");
    console.log("3. 如果仍失败，安装 Visual Studio Build Tools 2022，并勾选 Desktop development with C++。");
    console.log("4. 如 embedding 模型下载失败，可在 .env.local 设置 EMBEDDING_PROVIDER=hash。");
    process.exitCode = 1;
    return;
  }

  console.log("\n检查通过。可以继续执行 pnpm seed 和 pnpm dev:lan。");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
