import { generateId } from './db';
import { ensureReferralRequestTables } from './referral-tables';

export const REFERRAL_SHEET_ID = '1vCRClg8BR3K_yWH3Y-TUiiqsYwsqtOCjaBg_lm1ZKRg';
export const REFERRAL_SHEET_GID = '0';
export const REFERRAL_SHEET_URL = `https://docs.google.com/spreadsheets/d/${REFERRAL_SHEET_ID}/edit?gid=${REFERRAL_SHEET_GID}#gid=${REFERRAL_SHEET_GID}`;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(cur);
      cur = '';
    } else if (c === '\n') {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
    } else if (c !== '\r') {
      cur += c;
    }
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => String(cell).trim() !== ''));
}

function normHeader(h: string): string {
  return String(h || '')
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanPhone(value?: string | null): string {
  return String(value || '').replace(/[^\d+]/g, '').trim();
}

function colIndex(headers: string[], aliases: string[]): number {
  const norms = headers.map(normHeader);
  for (const alias of aliases) {
    const i = norms.indexOf(normHeader(alias));
    if (i >= 0) return i;
  }
  for (const alias of aliases) {
    const a = normHeader(alias);
    const i = norms.findIndex((h) => h.includes(a) || a.includes(h));
    if (i >= 0) return i;
  }
  return -1;
}

export async function syncReferralSheet(db: D1Database): Promise<{ imported: number; skipped: number; total_rows: number }> {
  await ensureReferralRequestTables(db);
  try {
    await db.prepare(`ALTER TABLE referral_requests ADD COLUMN sheet_key TEXT`).run();
  } catch {
    // already exists
  }

  const csvUrl = `https://docs.google.com/spreadsheets/d/${REFERRAL_SHEET_ID}/export?format=csv&gid=${REFERRAL_SHEET_GID}`;
  const res = await fetch(csvUrl, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`Could not read Google Sheet (HTTP ${res.status}). Share the sheet as Anyone with the link → Viewer.`);
  }
  const text = await res.text();
  if (text.includes('<HTML') || text.includes('<html') || text.includes('Sign in')) {
    throw new Error('Google Sheet is not publicly readable. Share → Anyone with the link → Viewer.');
  }

  const table = parseCsv(text);
  if (table.length < 2) return { imported: 0, skipped: 0, total_rows: 0 };

  const headers = table[0];
  const nameIdx = colIndex(headers, ["friend's name", 'friend name', 'name']);
  const waIdx = colIndex(headers, ["friend's whatsapp number", 'whatsapp', 'phone']);
  const modelIdx = colIndex(headers, ["friend's phone model", 'phone model', 'model']);
  const notesIdx = colIndex(headers, ['anything else we should know?', 'anything else', 'notes']);

  if (nameIdx < 0 || waIdx < 0) {
    throw new Error('Sheet headers must include Friend’s name and Friend’s WhatsApp number.');
  }

  let imported = 0;
  let skipped = 0;

  for (const row of table.slice(1)) {
    const friendName = String(row[nameIdx] || '').trim();
    const friendWhatsapp = cleanPhone(row[waIdx]);
    if (!friendName || friendWhatsapp.length < 8) {
      skipped++;
      continue;
    }
    const sheetKey = friendWhatsapp;
    const existing = await db
      .prepare(`SELECT id FROM referral_requests WHERE friend_whatsapp = ? OR sheet_key = ?`)
      .bind(friendWhatsapp, sheetKey)
      .first<{ id: string }>();
    if (existing) {
      skipped++;
      continue;
    }

    const now = new Date().toISOString();
    const id = await generateId(db, 'referral_requests', 'REF', 1001);
    await db
      .prepare(
        `INSERT INTO referral_requests (id, friend_name, friend_whatsapp, friend_phone_model, notes, referrer_name, referrer_phone, referrer_email, source, status, converted_customer_id, ip_address, created_at, updated_at, sheet_key)
         VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, ?, 'New', NULL, NULL, ?, ?, ?)`
      )
      .bind(
        id,
        friendName,
        friendWhatsapp,
        modelIdx >= 0 ? String(row[modelIdx] || '').trim() || null : null,
        notesIdx >= 0 ? String(row[notesIdx] || '').trim() || null : null,
        'google-sheet',
        now,
        now,
        sheetKey
      )
      .run();
    imported++;
  }

  return { imported, skipped, total_rows: table.length - 1 };
}
