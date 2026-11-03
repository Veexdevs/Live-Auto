import { loadRoomState, saveRoomState } from '../server/cloudStore.js';
import {
  normalizeLoadedState,
  ensureActiveState,
  formatRoomResponse,
  parseUsernameInput,
} from '../server/quizCore.js';

export const config = {
  maxDuration: 30,
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  try {
    const raw = await loadRoomState();
    const state = normalizeLoadedState(raw);
    let mutated = !raw;

    const queryUser = parseUsernameInput(req.query?.user || '');
    if (queryUser && state.tiktok.targetUsername !== queryUser) {
      state.config.tiktokUsername = queryUser;
      state.tiktok.targetUsername = queryUser;
      state.tiktok.autoConnect = true;
      mutated = true;
    }

    const ticked = await ensureActiveState(state, { allowAiFetch: true });
    if (ticked) mutated = true;

    if (mutated) {
      await saveRoomState(state);
    }

    const role = req.query?.role === 'studio' ? 'studio' : 'overlay';
    return res.status(200).json(formatRoomResponse(state, { role }));
  } catch (err) {
    console.error('[/api/state] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
