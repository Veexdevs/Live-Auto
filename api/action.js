import { loadRoomState, saveRoomState } from '../server/cloudStore.js';
import {
  normalizeLoadedState,
  ensureActiveState,
  applyRoomAction,
  formatRoomResponse,
} from '../server/quizCore.js';

export const config = {
  maxDuration: 30,
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const raw = await loadRoomState({ forceFresh: true });
    const state = normalizeLoadedState(raw);

    await applyRoomAction(state, req.body || {});
    await ensureActiveState(state, { allowAiFetch: true });
    await saveRoomState(state);

    const role = req.query?.role === 'overlay' ? 'overlay' : 'studio';
    return res.status(200).json({
      ok: true,
      ...formatRoomResponse(state, { role }),
    });
  } catch (err) {
    console.error('[/api/action] Error:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Internal error' });
  }
}
