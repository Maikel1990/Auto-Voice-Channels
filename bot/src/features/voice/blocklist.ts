import fs from 'fs';
import path from 'path';

const DATA_DIR = '/app/data';
const DATA_FILE = path.join(DATA_DIR, 'blocklist.json');
export const MAX_BLOCKED_PER_USER = 10;

type BlocklistData = Record<string, string[]>; // ownerId -> blockedUserIds[]

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readData(): BlocklistData {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeData(data: BlocklistData): void {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

/** Alle geblokkeerde gebruikers-ID's voor een eigenaar. */
export function getBlocked(ownerId: string): string[] {
  const data = readData();
  return data[ownerId] ?? [];
}

/** Voegt een gebruiker toe aan iemands blocklist. Retourneert een resultaat met eventuele foutmelding. */
export function addBlocked(
  ownerId: string,
  targetId: string,
): { ok: true } | { ok: false; message: string } {
  if (ownerId === targetId) {
    return { ok: false, message: 'Je kan jezelf niet blokkeren.' };
  }
  const data = readData();
  const current = data[ownerId] ?? [];
  if (current.includes(targetId)) {
    return { ok: false, message: 'Deze persoon staat al op je blocklist.' };
  }
  if (current.length >= MAX_BLOCKED_PER_USER) {
    return {
      ok: false,
      message: `Je kan maximaal ${MAX_BLOCKED_PER_USER} personen blokkeren. Verwijder er eerst een.`,
    };
  }
  data[ownerId] = [...current, targetId];
  writeData(data);
  return { ok: true };
}

/** Verwijdert een gebruiker van iemands blocklist. */
export function removeBlocked(
  ownerId: string,
  targetId: string,
): { ok: true } | { ok: false; message: string } {
  const data = readData();
  const current = data[ownerId] ?? [];
  if (!current.includes(targetId)) {
    return { ok: false, message: 'Deze persoon staat niet op je blocklist.' };
  }
  data[ownerId] = current.filter((id) => id !== targetId);
  writeData(data);
  return { ok: true };
}
