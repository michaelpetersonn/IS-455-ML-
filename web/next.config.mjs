import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 is a native module — keep it server-side only
  serverExternalPackages: ['better-sqlite3'],
  // Silence workspace-root warning when nested inside a monorepo
  outputFileTracingRoot: path.join(__dirname, '..'),
};

export default nextConfig;
