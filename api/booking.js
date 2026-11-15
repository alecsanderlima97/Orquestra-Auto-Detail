/* global process, Buffer */
// API do agendamento pelo cliente (Vercel Functions).
// Substitui as Cloud Functions, que exigem o plano Blaze do Firebase.
// Credencial: FIREBASE_SERVICE_ACCOUNT (JSON da conta de serviço, só nas variáveis da Vercel).
import { createRequire } from 'node:module';
import admin from 'firebase-admin';

const require = createRequire(import.meta.url);
const { BookingError, createBookingCore } = require('../functions/bookingCore.js');

const STATUS = {
  'invalid-argument': 400,
  unauthenticated: 401,
  'permission-denied': 403,
  'not-found': 404,
  'already-exists': 409,
  'failed-precondition': 409,
  'resource-exhausted': 429
};
const MAX_BODY_BYTES = 8 * 1024;

let core = null;

function getCore() {
  if (core) return core;
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT || '';
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT ausente.');
    // Aceita o JSON puro ou em base64.
    const json = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(json)) });
  }
  core = createBookingCore({
    db: admin.firestore(),
    FieldValue: admin.firestore.FieldValue,
    Timestamp: admin.firestore.Timestamp
  });
  return core;
}

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || String(req.headers['x-real-ip'] || '') || 'desconhecido';
}

async function authenticatedActor(req) {
  const header = String(req.headers.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email || '' };
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }
  const length = Number(req.headers['content-length'] || 0);
  if (length > MAX_BODY_BYTES) return res.status(413).json({ error: 'Pedido grande demais.' });

  const body = typeof req.body === 'object' && req.body ? req.body : {};
  try {
    const booking = getCore();
    switch (body.action) {
      case 'info':
        return res.status(200).json(await booking.getInfo(body));
      case 'availability':
        return res.status(200).json(await booking.getAvailability(body));
      case 'request': {
        const result = await booking.createRequest(body, { ip: clientIp(req) });
        return res.status(200).json({ ok: true, protocol: result.protocol });
      }
      case 'saveConfig':
        return res.status(200).json(await booking.saveConfig(body, await authenticatedActor(req)));
      default:
        return res.status(400).json({ error: 'Ação inválida.' });
    }
  } catch (error) {
    if (error instanceof BookingError) {
      return res.status(STATUS[error.code] || 400).json({ error: error.message, code: error.code });
    }
    // Detalhe só no log do servidor; o cliente recebe mensagem genérica.
    console.error('[booking]', body.action, error?.message || error);
    return res.status(500).json({ error: 'Não foi possível concluir agora. Tente novamente em instantes.' });
  }
}
