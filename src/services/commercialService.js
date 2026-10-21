import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, db, firebaseReady, functions as firebaseFunctions } from "../firebase/firebaseConfig";

export const ROLES = ["Proprietario", "Financeiro", "Consulta"];
export const SUBSCRIPTION_STATUSES = ["trial", "ativo", "vencido", "bloqueado", "cancelado"];
export const AI_CREDIT_PACKAGES = [
  { id: "ai-100", credits: 100, label: "Essencial" },
  { id: "ai-300", credits: 300, label: "Mais escolhido" },
  { id: "ai-1000", credits: 1000, label: "Performance" }
];

const ONLINE_WINDOW_MS = 5 * 60 * 1000;
let presenceTimer = null;

export const PLANS = {
  starter: {
    label: "Plano Inicial",
    monthlyPrice: "R$ 75",
    recommended: false,
    limits: { users: 1, vehicles: 65, appointments: 80, serviceOrders: 40, aiCredits: 0 },
    features: ["Agenda", "Clientes e veiculos", "Catalogo de servicos"]
  },
  medium: {
    label: "Plano Medio",
    monthlyPrice: "R$ 120",
    recommended: true,
    limits: { users: 3, vehicles: 200, appointments: 180, serviceOrders: 120, aiCredits: 15 },
    features: ["Tudo do Starter", "Financeiro completo", "Estoque", "Convites internos", "Prioridade no suporte", "Assistente IA inicial"]
  },
  premium: {
    label: "Plano Premium",
    monthlyPrice: "R$ 299",
    recommended: false,
    limits: { users: 6, vehicles: 500, appointments: 350, serviceOrders: 300, aiCredits: 100 },
    features: ["Tudo do Medium", "Multiunidade", "Prioridade no suporte", "Assistente IA avancado"]
  }
};

export function daysPastDue(nextBillingDate, now = new Date()) {
  if (!nextBillingDate) return 0;
  const due = new Date(`${nextBillingDate}T23:59:59`);
  if (Number.isNaN(due.getTime()) || now <= due) return 0;
  return Math.floor((now.getTime() - due.getTime()) / 86400000);
}

export function daysUntilDue(nextBillingDate, now = new Date()) {
  if (!nextBillingDate) return null;
  const due = new Date(`${nextBillingDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  return Math.ceil((dueDay.getTime() - today.getTime()) / 86400000);
}

function timestampToMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function timestampToIso(value) {
  const millis = timestampToMillis(value);
  return millis ? new Date(millis).toISOString() : "";
}

function addMonths(dateString, months = 1) {
  const base = dateString ? new Date(`${dateString}T12:00:00`) : new Date();
  if (Number.isNaN(base.getTime())) return "";
  base.setMonth(base.getMonth() + months);
  return base.toISOString().slice(0, 10);
}

function currentMonthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

export function getTenantBillingState(tenant, now = new Date()) {
  const status = tenant?.subscriptionStatus || "trial";
  const pastDueDays = daysPastDue(tenant?.nextBillingDate, now);
  const autoBlocked = ["trial", "ativo", "vencido"].includes(status) && pastDueDays >= 5;
  const blocked = status === "bloqueado" || status === "cancelado" || autoBlocked;
  const effectiveStatus = autoBlocked ? "bloqueado" : pastDueDays > 0 && status === "ativo" ? "vencido" : status;
  const daysUntilBlock = pastDueDays > 0 && pastDueDays < 5 ? 5 - pastDueDays : 0;

  return {
    autoBlocked,
    blocked,
    daysUntilBlock,
    effectiveStatus,
    pastDueDays,
    paid: status === "ativo" && pastDueDays === 0,
    warning: pastDueDays > 0 && !blocked
  };
}

export function getSubscriptionAccess(user) {
  const status = user?.subscriptionStatus || "trial";
  const pastDueDays = daysPastDue(user?.nextBillingDate);
  const dueInDays = daysUntilDue(user?.nextBillingDate);
  const autoBlocked = ["trial", "ativo", "vencido"].includes(status) && pastDueDays >= 5;
  const blocked = status === "bloqueado" || status === "cancelado" || autoBlocked;

  return {
    blocked,
    dueInDays,
    pastDueDays,
    plan: PLANS[user?.planId] || PLANS.medium,
    reason: autoBlocked ? "vencido_5_dias" : status,
    status: autoBlocked ? "bloqueado" : pastDueDays > 0 && status === "ativo" ? "vencido" : status,
    warning: (dueInDays !== null && dueInDays <= 3) || (pastDueDays > 0 && !autoBlocked)
  };
}

export function canWrite(role) {
  return role === "Proprietario" || role === "Proprietário" || role === "Financeiro";
}

export function canManageUsers(role) {
  return role === "Proprietario" || role === "Proprietário";
}

function tenantPath(tenantId) {
  return `tenants/${tenantId}`;
}

function normalizeInvite(snapshot) {
  if (!snapshot.exists()) return null;
  const invite = { code: snapshot.id, ...snapshot.data() };
  const expired = invite.expiresAt?.toMillis?.() && invite.expiresAt.toMillis() < Date.now();
  if (invite.status !== "Ativo" || expired) return null;
  return invite;
}

async function callSecureFunction(name, payload = {}) {
  if (!firebaseReady || !firebaseFunctions) throw new Error("Firebase nao configurado.");
  try {
    const result = await httpsCallable(firebaseFunctions, name)(payload);
    return result.data;
  } catch (error) {
    throw new Error(error?.message?.replace(/^FirebaseError:\s*/i, "") || "Operacao administrativa indisponivel.");
  }
}

export async function createCommercialInvite(payload = {}) {
  return callSecureFunction("adminCreateCommercialInvite", payload);
}

export async function createInternalInvite(tenantId, companyName, role = "Consulta") {
  return callSecureFunction("createTenantInvite", { tenantId, companyName, role });
}

export async function registerWithInvite({ companyName, email, name, password, inviteCode }) {
  if (!firebaseReady || !auth || !db) throw new Error("Configure um novo projeto Firebase antes do cadastro.");
  const code = inviteCode.trim().toUpperCase();
  const invite = normalizeInvite(await getDoc(doc(db, "invites", code)));
  if (!invite) throw new Error("Convite invalido, usado ou expirado.");

  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  return callSecureFunction("completeInviteRegistration", {
    code,
    companyName: companyName.trim(),
    email: credential.user.email || email.trim(),
    name: name.trim()
  });
}

export async function loginWithFirebase(email, password) {
  if (!firebaseReady || !auth || !db) throw new Error("Firebase nao configurado.");
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  if (credential.user.email === "orquestracs@gmail.com") {
    return { id: credential.user.uid, email: credential.user.email, name: "Suporte Tecnico", role: "dev" };
  }
  return loadUserMembership(credential.user.uid);
}

export async function loginWithGoogle() {
  if (!firebaseReady || !auth || !db) throw new Error("Firebase nao configurado.");
  const provider = new GoogleAuthProvider();
  const credential = await signInWithPopup(auth, provider);
  if (credential.user.email === "orquestracs@gmail.com") {
    return { id: credential.user.uid, email: credential.user.email, name: "Suporte Tecnico", role: "dev" };
  }
  return loadUserMembership(credential.user.uid);
}

export async function loadUserMembership(userId) {
  const memberships = await getDocs(collection(db, `userTenants/${userId}/memberships`));
  const first = memberships.docs[0];
  if (!first) throw new Error("Usuario sem empresa vinculada.");
  const tenantId = first.id;
  const membership = first.data();
  const tenantSnapshot = await getDoc(doc(db, tenantPath(tenantId)));
  const tenant = tenantSnapshot.exists() ? tenantSnapshot.data() : {};
  const billing = getTenantBillingState(tenant);

  if (billing.autoBlocked && tenant.subscriptionStatus !== "bloqueado") {
    updateDoc(doc(db, tenantPath(tenantId)), {
      subscriptionStatus: "bloqueado",
      updatedAt: serverTimestamp()
    }).catch(() => undefined);
  }

  return {
    id: userId,
    tenantId,
    companyName: tenant.name || membership.companyName || "Empresa",
    role: membership.role || "Consulta",
    planId: tenant.planId || membership.planId || "medium",
    subscriptionStatus: billing.effectiveStatus || tenant.subscriptionStatus || membership.subscriptionStatus || "trial",
    nextBillingDate: tenant.nextBillingDate || "",
    externalCustomerId: tenant.externalId || tenant.externalCustomerId || `orquestra_auto_detail_${tenantId}`
  };
}

async function updatePresence(membership, isFirstAccess = false) {
  if (!firebaseReady || !db || !membership?.id || !membership?.tenantId || membership.role === "dev") return;
  const payload = {
    lastSeenAt: serverTimestamp(),
    online: true,
    updatedAt: serverTimestamp()
  };

  if (isFirstAccess) payload.lastAccessAt = serverTimestamp();

  await Promise.all([
    updateDoc(doc(db, `${tenantPath(membership.tenantId)}/users/${membership.id}`), payload).catch(() => undefined),
    updateDoc(doc(db, tenantPath(membership.tenantId)), {
      lastAccessAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }).catch(() => undefined)
  ]);
}

function startPresence(membership) {
  if (presenceTimer) clearInterval(presenceTimer);
  updatePresence(membership, true).catch(() => undefined);
  presenceTimer = setInterval(() => updatePresence(membership).catch(() => undefined), 60000);
}

export function listenAuth(callback) {
  if (!firebaseReady || !auth) {
    callback(null);
    return () => undefined;
  }
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      if (presenceTimer) clearInterval(presenceTimer);
      presenceTimer = null;
      return callback(null);
    }
    try {
      if (firebaseUser.email === "orquestracs@gmail.com") {
        callback({ id: firebaseUser.uid, email: firebaseUser.email, name: "Suporte Tecnico", role: "dev" });
        return;
      }
      const membership = await loadUserMembership(firebaseUser.uid);
      startPresence(membership);
      callback(membership);
    } catch {
      callback(null);
    }
  });
}

export async function logoutCommercialUser() {
  try {
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");
    if (currentUser?.id && currentUser?.tenantId) {
      await updateDoc(doc(db, `${tenantPath(currentUser.tenantId)}/users/${currentUser.id}`), {
        online: false,
        lastSeenAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  } catch {
    // Logout deve continuar mesmo se a presenca nao puder ser atualizada.
  }
  if (presenceTimer) clearInterval(presenceTimer);
  presenceTimer = null;
  if (auth) await signOut(auth);
}

export async function listPlatformTenants() {
  if (!firebaseReady || !db) return [];
  const snapshot = await getDocs(query(collection(db, "tenants"), orderBy("name")));
  const tenants = await Promise.all(snapshot.docs.map(async (item) => {
    const tenant = { id: item.id, ...item.data() };
    const usersSnapshot = await getDocs(collection(db, `${tenantPath(item.id)}/users`)).catch(() => ({ docs: [] }));
    const aiUsage = await getTenantAiUsage(item.id, tenant.planId);
    const appSnapshot = await getTenantAppSnapshot(item.id);
    const paymentsSnapshot = await getDocs(collection(db, `${tenantPath(item.id)}/payments`)).catch(() => ({ docs: [] }));
    const aiCredits = await getTenantAiCredits(item.id).catch(() => ({ balance: 0, bonus: 0, included: PLANS[tenant.planId]?.limits?.aiCredits || 0, used: 0 }));
    const adjustmentsSnapshot = await getDocs(collection(db, `${tenantPath(item.id)}/aiCreditAdjustments`)).catch(() => ({ docs: [] }));
    const users = usersSnapshot.docs.map((userDoc) => ({ id: userDoc.id, ...userDoc.data() }));
    const payments = paymentsSnapshot.docs
      .map((paymentDoc) => ({ id: paymentDoc.id, ...paymentDoc.data() }))
      .sort((a, b) => timestampToMillis(b.paidAt || b.createdAt) - timestampToMillis(a.paidAt || a.createdAt));
    const aiCreditAdjustments = adjustmentsSnapshot.docs
      .map((adjustmentDoc) => ({ id: adjustmentDoc.id, ...adjustmentDoc.data() }))
      .sort((a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt));
    const lastSeenAt = Math.max(...users.map((user) => timestampToMillis(user.lastSeenAt)), 0);
    const lastAccessAt = Math.max(timestampToMillis(tenant.lastAccessAt), ...users.map((user) => Math.max(timestampToMillis(user.lastAccessAt), timestampToMillis(user.lastSeenAt))), 0);
    const onlineUsers = users.filter((user) => {
      const seenAt = timestampToMillis(user.lastSeenAt);
      return user.online && seenAt && Date.now() - seenAt <= ONLINE_WINDOW_MS;
    });

    return {
      ...tenant,
      billing: getTenantBillingState(tenant),
      lastAccessAt: lastAccessAt ? new Date(lastAccessAt).toISOString() : "",
      lastSeenAt: lastSeenAt ? new Date(lastSeenAt).toISOString() : "",
      online: onlineUsers.length > 0,
      onlineUsers: onlineUsers.length,
      aiUsage,
      appSnapshot,
      aiCredits,
      aiCreditAdjustments,
      payments,
      users
    };
  }));

  return tenants;
}

export async function updateTenantSubscription(tenantId, updates) {
  return callSecureFunction("adminUpdateTenant", { tenantId, updates });
}

export async function getTenantAppSnapshot(tenantId) {
  if (!firebaseReady || !db || !tenantId) {
    return { counts: {}, auditLogs: [], updatedAt: "" };
  }

  const snapshot = await getDoc(doc(db, `${tenantPath(tenantId)}/appData/main`)).catch(() => null);
  if (!snapshot?.exists?.()) {
    return { counts: {}, auditLogs: [], updatedAt: "" };
  }

  const data = snapshot.data();
  const countCollection = (key) => {
    const items = Array.isArray(data[key]) ? data[key] : [];
    const deleted = items.filter((item) => item?.deletedAt).length;
    return { active: items.length - deleted, deleted, total: items.length };
  };

  return {
    counts: {
      clientes: countCollection("clientes"),
      agendamentos: countCollection("agendamentos"),
      servicos: countCollection("servicos"),
      estoque: countCollection("estoque"),
      financeiro: countCollection("financeiro")
    },
    auditLogs: Array.isArray(data.auditLogs) ? data.auditLogs.slice(0, 12) : [],
    updatedAt: timestampToIso(data.updatedAt)
  };
}

export async function getTenantAiCredits(tenantId) {
  if (!tenantId) return { balance: 0, bonus: 0, included: 0, renewalMonth: currentMonthKey(), status: "empty", used: 0 };
  return callSecureFunction("getTenantAiCredits", { tenantId });
}

export async function getTenantAiUsage(tenantId, planId = "medium") {
  const wallet = await getTenantAiCredits(tenantId);
  const limit = Number(wallet.included ?? PLANS[planId]?.limits?.aiCredits ?? 0);
  return { ...wallet, limit, monthKey: wallet.renewalMonth || currentMonthKey(), remaining: wallet.balance ?? 0, used: wallet.used ?? 0 };
}

export async function askAiAssistantSecure(payload) {
  return callSecureFunction("askAiAssistant", payload);
}

export async function addTenantAiCredits(tenantId, credits, reason) {
  return callSecureFunction("adminAddAiCredits", { tenantId, credits, reason });
}

export async function syncPortalSnapshot() {
  return callSecureFunction("adminSyncPortal");
}

export function buildAiCreditsPurchaseUrl({ packageId, credits, externalCustomerId, returnUrl }) {
  const validPackage = AI_CREDIT_PACKAGES.find((item) => item.id === packageId && item.credits === Number(credits));
  if (!validPackage) throw new Error("Pacote de créditos inválido.");
  const baseUrl = import.meta.env.VITE_ORQUESTRA_PORTAL_PAYMENTS_URL || "https://portal.orquestracs.com/pagamentos";
  const url = new URL(baseUrl);
  url.searchParams.set("sourceSystem", "orquestra_auto_detail");
  url.searchParams.set("product", "ai_credits");
  url.searchParams.set("packageId", packageId);
  url.searchParams.set("credits", String(validPackage.credits));
  url.searchParams.set("externalCustomerId", String(externalCustomerId || ""));
  url.searchParams.set("returnUrl", returnUrl || `${window.location.origin}/planos`);
  return url.toString();
}

export async function markTenantPaid(tenant, payment = {}) {
  return callSecureFunction("adminRecordPayment", {
    tenantId: tenant.id,
    payment: {
      amount: Number(payment.amount || tenant.monthlyAmount || 0),
      method: payment.method || tenant.paymentMethod || "PIX",
      note: payment.note || "",
      paidAt: payment.paidAt || new Date().toISOString().slice(0, 10),
      referenceMonth: payment.referenceMonth || currentMonthKey(),
      nextBillingDate: payment.nextBillingDate || addMonths(tenant.nextBillingDate || tenant.startDate, 1)
    }
  });
}

export async function archiveTenant(tenantId) {
  return callSecureFunction("adminArchiveTenant", { tenantId });
}

export async function restoreTenant(tenantId) {
  return callSecureFunction("adminRestoreTenant", { tenantId });
}

export async function listTenantUsers(tenantId) {
  const snapshot = await getDocs(collection(db, `${tenantPath(tenantId)}/users`));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function updateTenantUserRole(tenantId, userId, role) {
  return callSecureFunction("updateTenantUserRole", { tenantId, userId, role });
}

export async function listTenantInvites(tenantId) {
  const snapshot = await getDocs(query(collection(db, "invites"), where("tenantId", "==", tenantId)));
  return snapshot.docs.map((item) => ({ code: item.id, ...item.data() }));
}

export async function cancelInvite(code) {
  await updateDoc(doc(db, "invites", code), { status: "Cancelado", updatedAt: serverTimestamp() });
}
