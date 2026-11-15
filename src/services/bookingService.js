// Agendamento pelo cliente: chamadas à API (api/booking.js) e leitura dos pedidos.
// Regras de negócio e validação ficam no servidor (functions/publicBooking.js).
import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { auth, db, firebaseReady } from "../firebase/firebaseConfig";

const GENERIC_ERROR = "Não foi possível concluir agora. Tente novamente em instantes.";

// Chama a API da Vercel (api/booking.js). Ações de gestão enviam o token de login do Firebase.
async function call(action, payload = {}, { withAuth = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (withAuth) {
    const token = await auth?.currentUser?.getIdToken?.();
    if (!token) throw new Error("Faça login novamente para continuar.");
    headers.Authorization = `Bearer ${token}`;
  }
  let response;
  try {
    response = await fetch("/api/booking", { method: "POST", headers, body: JSON.stringify({ ...payload, action }) });
  } catch {
    throw new Error("Sem conexão com o servidor. Verifique a internet e tente novamente.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || GENERIC_ERROR);
  return data;
}

// --- Página pública ---------------------------------------------------------
export const getPublicBookingInfo = (slug) => call("info", { slug });
export const getPublicAvailability = (slug, serviceId, date) => call("availability", { slug, serviceId, date });
export const createBookingRequest = (payload) => call("request", payload);

// --- App da empresa ---------------------------------------------------------
export const saveBookingConfig = (tenantId, config) => call("saveConfig", { tenantId, config }, { withAuth: true });

export async function getBookingConfig(tenantId) {
  if (!firebaseReady || !db || !tenantId) return null;
  const snapshot = await getDoc(doc(db, `tenants/${tenantId}/bookingConfig/main`));
  return snapshot.exists() ? snapshot.data() : null;
}

/** Pedidos pendentes em tempo real. Retorna a função para parar de ouvir. */
export function listenPendingRequests(tenantId, onChange, onError) {
  if (!firebaseReady || !db || !tenantId) {
    onChange([]);
    return () => undefined;
  }
  const q = query(
    collection(db, `tenants/${tenantId}/bookingRequests`),
    where("status", "==", "pendente")
  );
  return onSnapshot(
    q,
    // Ordena no cliente para não exigir índice composto no Firestore.
    (snapshot) => onChange(
      snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
    ),
    (error) => onError?.(error)
  );
}

export async function resolveBookingRequest(tenantId, requestId, userId, { status, agendamentoId = null, rejectReason = "" }) {
  const updates = { status, handledBy: userId, handledAt: serverTimestamp() };
  if (agendamentoId != null) updates.agendamentoId = agendamentoId;
  if (rejectReason) updates.rejectReason = String(rejectReason).slice(0, 200);
  await updateDoc(doc(db, `tenants/${tenantId}/bookingRequests/${requestId}`), updates);
}

/** Endereço público do link de agendamento. */
export function publicBookingUrl(slug) {
  return `${window.location.origin}/agendar/${slug}`;
}
