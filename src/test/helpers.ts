import { allStores } from '../db';

export async function resetAll(): Promise<void> {
    for (const s of Object.values(allStores)) await s.clear();
    localStorage.clear();
}

export function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
    const status = init.status ?? (init.ok === false ? 500 : 200);
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
