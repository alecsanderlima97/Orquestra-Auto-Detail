// Agendamento pelo cliente: chamadas às Cloud Functions e leitura dos pedidos.
// Regras de negócio e validação ficam no servidor (functions/publicBooking.js).
import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, firebaseReady, functions as firebaseFunctions } from "../firebase/firebaseConfig";

const FRIENDLY_ERRORS = {
  "not-found": "Agendamento online indisponível para este link.",
  "resource-exhausted": "Muitos pedidos em pouco tempo. Tente novamente mais tarde.",
  unavailable: "Sem conexão com o servidor. Verifique a internet e tente novamente.",
  internal: "Não foi possível concluir agora. Tente novamente em instantes."
};

async function call(name, payload) {
  if (!firebaseReady || !firebaseFunctions) throw new Error("Serviço indisponível no momento.");
  try {
    const result = await httpsCallable(firebaseFunctions, name)(payload);
    return result.data;
  } catch (error) {
    const code = String(error?.code || "").replace(/^functions\//, "");
    const message = String(error?.message || "").replace(/^FirebaseError:\s*/i, "");
    throw new Error(code === "internal" || !message ? FRIENDLY_ERRORS[code] || FRIENDLY_ERRORS.internal : message);
  }
}

// --- Página pública ---------------------------------------------------------
export const getPublicBookingInfo = (slug) => call("getPublicBookingInfo", { slug });
export const getPublicAvailability = (slug, serviceId, date) => call("getPublicAvailability", { slug, serviceId, date });
export const createBookingRequest = (payload) => call("createBookingRequest", payload);

// --- App da empresa ---------------------------------------------------------
export const saveBookingConfig = (tenantId, config) => call("saveBookingConfig", { tenantId, config });

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
