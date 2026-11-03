import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

let memoryState = null;
let lastLoadedAt = 0;
let supabaseUnreachable = false;

function hasSupabaseConfig() {
  return Boolean(
    !supabaseUnreachable &&
      process.env.SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function supabaseFetchRoom(roomId = 'default') {
  const url = `${process.env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/quiz_rooms?id=eq.${encodeURIComponent(
    roomId
  )}&select=state_json,updated_at`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) {
    throw new Error(`Supabase GET ${res.status}`);
  }
  const rows = await res.json();
  return rows?.[0]?.state_json || null;
}

async function supabaseUpsertRoom(roomId = 'default', stateObj) {
  const url = `${process.env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/quiz_rooms`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      id: roomId,
      state_json: stateObj,
      updated_at: new Date().toISOString(),
    }),
    signal: AbortSignal.timeout(4500),
  });
  if (!res.ok) {
    throw new Error(`Supabase UPSERT ${res.status}`);
  }
}

function readLocalFile() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch {
    // ignore read errors on read-only serverless fs
  }
  return null;
}

function writeLocalFile(stateObj) {
  try {
    if (process.env.VERCEL) return; // Vercel filesystem is read-only outside /tmp
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(stateObj, null, 2), 'utf8');
  } catch {
    // ignore local write errors
  }
}

export async function loadRoomState({ forceFresh = false } = {}) {
  const now = Date.now();
  if (!forceFresh && memoryState && now - lastLoadedAt < 250) {
    return memoryState;
  }

  if (hasSupabaseConfig()) {
    try {
      const remote = await supabaseFetchRoom('default');
      if (remote && typeof remote === 'object' && Object.keys(remote).length > 0) {
        memoryState = remote;
        lastLoadedAt = now;
        return memoryState;
      }
    } catch (err) {
      const code = err?.cause?.code || err?.code || '';
      if (
        code === 'ECONNRESET' ||
        code === 'ENOTFOUND' ||
        code === 'ECONNREFUSED' ||
        String(err?.message || '').includes('fetch failed')
      ) {
        supabaseUnreachable = true;
      }
    }
  }

  if (!memoryState) {
    const local = readLocalFile();
    if (local) {
      memoryState = local;
    }
  }

  lastLoadedAt = now;
  return memoryState;
}

export async function saveRoomState(stateObj) {
  memoryState = stateObj;
  lastLoadedAt = Date.now();

  if (hasSupabaseConfig()) {
    try {
      await supabaseUpsertRoom('default', stateObj);
      return;
    } catch (err) {
      const code = err?.cause?.code || err?.code || '';
      if (
        code === 'ECONNRESET' ||
        code === 'ENOTFOUND' ||
        code === 'ECONNREFUSED' ||
        String(err?.message || '').includes('fetch failed')
      ) {
        supabaseUnreachable = true;
      }
    }
  }

  writeLocalFile(stateObj);
}
