import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Silence workspace-root warning when nested inside a monorepo
  outputFileTracingRoot: path.join(__dirname, '..'),
};

export default nextConfig;
