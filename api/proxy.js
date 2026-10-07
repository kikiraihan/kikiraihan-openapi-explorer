// Vercel Serverless Function: menyediakan /proxy saat di-deploy ke Vercel
// (di Vercel tidak ada server.js / vite dev server). /proxy di-rewrite ke /api/proxy lewat vercel.json.
import { handleProxy } from '../proxy.js';

export default function handler(req, res) {
  return handleProxy(req, res);
}
