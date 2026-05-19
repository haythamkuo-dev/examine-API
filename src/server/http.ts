import { targetEnvironmentHeaderName } from '../core/targetEnvironment';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
  'Access-Control-Allow-Headers': `Content-Type,${targetEnvironmentHeaderName}`,
};

export const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...(init.headers || {}),
    },
  });

export const badRequest = (message: string) => json({ ok: false, message }, { status: 400 });

export const notFound = () => json({ ok: false, message: 'Not found' }, { status: 404 });

export const readJson = async <T>(request: Request): Promise<T> => {
  return (await request.json()) as T;
};
