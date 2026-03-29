import type { Env } from './types';
import { handleUpload } from './upload';
import { handleAdmin } from './admin';
import { handleDiagnosticUpload, handleDiagnosticAdmin, handleBBLUpload, handleDiagnosticPatch } from './diagnostic';
import { handleCron } from './cron';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // CORS headers for Electron app
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Content-Encoding, X-Admin-Key, X-Installation-Id',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    let response: Response;

    try {
      // Route requests
      if (pathname === '/v1/collect') {
        response = await handleUpload(request, env);
      } else if (pathname === '/v1/diagnostic') {
        response = await handleDiagnosticUpload(request, env);
      } else if (pathname.match(/^\/v1\/diagnostic\/[0-9a-f-]+\/bbl$/)) {
        const reportId = pathname.split('/')[3];
        response = await handleBBLUpload(request, env, reportId);
      } else if (pathname.match(/^\/v1\/diagnostic\/[0-9a-f-]+$/) && request.method === 'PATCH') {
        const reportId = pathname.split('/')[3];
        response = await handleDiagnosticPatch(request, env, reportId);
      } else if (pathname.startsWith('/admin/diagnostics')) {
        response = await handleDiagnosticAdmin(request, env, pathname);
      } else if (pathname.startsWith('/admin/')) {
        response = await handleAdmin(request, env, pathname);
      } else if (pathname === '/health') {
        response = Response.json({ status: 'ok', timestamp: new Date().toISOString() });
      } else {
        response = new Response('Not found', { status: 404 });
      }
    } catch (err) {
      console.error('Worker error:', err);
      response = new Response('Internal server error', { status: 500 });
    }

    // Add CORS headers to response
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders)) {
      headers.set(key, value);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleCron(env));
  },
} satisfies ExportedHandler<Env>;
