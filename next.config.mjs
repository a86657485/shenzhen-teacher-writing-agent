/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["better-sqlite3", "@xenova/transformers", "pdf-parse"],
};

export default nextConfig;
