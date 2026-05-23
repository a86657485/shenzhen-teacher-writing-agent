# 深圳教师招聘作文智能体

一个本地运行的 Web 应用，用于深圳教师招聘主观题作文备考。支持手机和电脑浏览器访问，包含本机 SQLite 知识库、上传资料、URL 导入权威文章、向量检索和 DeepSeek V4 Pro 流式生成。

## 功能

- 对话式生成深圳教师招聘主观题作文
- 默认内置“深圳教师招聘高分作文写作引擎”
- 支持 `.docx`、`.pdf`、`.txt`、`.md` 上传入库
- 支持导入教育部、深圳市教育局等权威文章 URL
- 本地 SQLite 保存知识库，数据库文件不会提交到 Git
- 服务端调用 DeepSeek，浏览器端不会接触 API key
- 电脑和手机可在同一 Wi-Fi 下访问

## 本机首次部署

```bash
pnpm install
cp .env.example .env.local
```

打开 `.env.local`，填入你的 DeepSeek API key：

```bash
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_API_KEY=你的DeepSeekKey
DEEPSEEK_MODEL=deepseek-v4-pro
EMBEDDING_PROVIDER=transformers
EMBEDDING_MODEL=Xenova/paraphrase-multilingual-MiniLM-L12-v2
DATABASE_PATH=./data/knowledge.sqlite
```

如果安装时 pnpm 提示 build scripts 被拦截，执行：

```bash
pnpm approve-builds --all
pnpm rebuild better-sqlite3
```

## 导入范文知识库

仓库根目录中的 5 篇 `.docx` 是高分范文风格库。首次运行前导入：

```bash
pnpm seed
```

也可以在网页左侧点击“导入当前 5 篇范文”。

## 启动

电脑本机访问：

```bash
pnpm dev
```

同一 Wi-Fi 下手机访问：

```bash
pnpm dev:lan
```

查看电脑局域网 IP：

```bash
ipconfig getifaddr en0
```

然后在手机浏览器打开：

```text
http://你的电脑局域网IP:3000
```

## 生产模式

```bash
pnpm build
pnpm start
```

## 注意

- `.env.local` 已被 `.gitignore` 忽略，不要把 API key 提交到 GitHub。
- `data/knowledge.sqlite` 是本地知识库文件，也不会提交。
- 如本地多语种 embedding 模型下载失败，可在 `.env.local` 中临时改为：

```bash
EMBEDDING_PROVIDER=hash
```
