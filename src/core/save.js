// Progresso e preferências persistidos no IndexedDB (idb-keyval).
import { get, set } from 'idb-keyval';

const KEY = 'arena-bots:save:v1';
const DEFAULT = { matches: 0, wins: 0, kills: 0, bestKills: 0, preset: null, fpsLimit: 60 };

export async function loadSave() {
  try { return { ...DEFAULT, ...(await get(KEY)) }; } catch { return { ...DEFAULT }; }
}
export async function writeSave(data) {
  try { await set(KEY, data); } catch (e) { console.warn('Falha ao salvar progresso', e); }
}
