import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
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
import { auth, db, firebaseReady } from "../firebase/firebaseConfig";

export const ROLES = ["Proprietario", "Financeiro", "Consulta"];
export const SUBSCRIPTION_STATUSES = ["trial", "ativo", "vencido", "bloqueado", "cancelado"];

const ONLINE_WINDOW_MS = 5 * 60 * 1000;
let presenceTimer = null;

export const PLANS = {
  starter: {
    label: "Plano Inicial",
    monthlyPrice: "R$ 75",
    limits: { users: 1, vehicles: 70, appointments: 150, aiCredits: 0 },
    features: ["Agenda", "Clientes e veiculos", "Catalogo de servicos"]
  },
  medium: {
    label: "Plano Medio",
    monthlyPrice: "R$ 120",
    limits: { users: 3, vehicles: 300, appointments: 350, aiCredits: 15 },
    features: ["Tudo do Starter", "Financeiro completo", "Estoque", "Convites internos", "Prioridade no suporte", "Assistente IA inicial"]
  },
  premium: {
    label: "Plano Premium",
    monthlyPrice: "R$ 299",
    limits: { users: 8, vehicles: 500, appointments: 800, aiCredits: 100 },
    features: ["Tudo do Medium", "Multiunidade", "Prioridade no suporte", "Assistente IA avancado"]
  }
};

export function daysPastDue(nextBillingDate, now = new Date()) {
  if (!nextBillingDate) return 0;
  const due = new Date(`${nextBillingDate}T23:59:59`);
  if (Number.isNaN(due.getTime()) || now <= due) return 0;
  return Math.floor((now.getTime() - due.getTime()) / 86400000);
}

function timestampToMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
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
  const autoBlocked = ["ativo", "vencido"].includes(status) && pastDueDays >= 5;
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
  const autoBlocked = ["ativo", "vencido"].includes(status) && pastDueDays >= 5;
  const blocked = status === "bloqueado" || status === "cancelado" || autoBlocked;

  return {
    blocked,
    pastDueDays,
    plan: PLANS[user?.planId] || PLANS.medium,
    reason: autoBlocked ? "vencido_5_dias" : status,
    status: autoBlocked ? "bloqueado" : pastDueDays > 0 && status === "ativo" ? "vencido" : status,
    warning: pastDueDays > 0 && !autoBlocked
  };
}

export function canWrite(role) {
  return role === "Proprietario" || role === "Proprietário" || role === "Financeiro";
}

export function canManageUsers(role) {
  return role === "Proprietario" || role === "Proprietário";
}

function createCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
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

export async function createCommercialInvite(planId = "medium", subscriptionStatus = "trial", nextBillingDate = "") {
  if (!firebaseReady || !db) throw new Error("Configure um novo projeto Firebase no .env antes de gerar convites.");
  const code = createCode();
  const invite = {
    code,
    inviteType: "commercial",
    planId,
    role: "Proprietario",
    status: "Ativo",
    subscriptionStatus,
    billingDay: 15,
    nextBillingDate,
    expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    createdAt: serverTimestamp()
  };
  await setDoc(doc(db, "invites", code), invite);
  return invite;
}

export async function createInternalInvite(tenantId, companyName, role = "Consulta") {
  if (!firebaseReady || !db) throw new Error("Firebase nao configurado.");
  const code = createCode();
  const invite = {
    code,
    inviteType: "user",
    tenantId,
    companyName,
    role,
    status: "Ativo",
    expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    createdAt: serverTimestamp()
  };
  await setDoc(doc(db, "invites", code), invite);
  return invite;
}

export async function registerWithInvite({ companyName, email, name, password, inviteCode }) {
  if (!firebaseReady || !auth || !db) throw new Error("Configure um novo projeto Firebase antes do cadastro.");
  const code = inviteCode.trim().toUpperCase();
  const invite = normalizeInvite(await getDoc(doc(db, "invites", code)));
  if (!invite) throw new Error("Convite invalido, usado ou expirado.");

  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const userId = credential.user.uid;
  const tenantId = invite.tenantId || crypto.randomUUID();
  const finalCompanyName = invite.companyName || companyName.trim();
  const membership = {
    id: userId,
    email: email.trim(),
    name: name.trim(),
    role: invite.role,
    tenantId,
    companyName: finalCompanyName,
    planId: invite.planId || "medium",
    subscriptionStatus: invite.subscriptionStatus || "trial",
    nextBillingDate: invite.nextBillingDate || ""
  };

  if (invite.inviteType === "commercial") {
    await setDoc(doc(db, tenantPath(tenantId)), {
      name: finalCompanyName,
      planId: membership.planId,
      subscriptionStatus: membership.subscriptionStatus,
      billingDay: invite.billingDay || 15,
      startDate: new Date().toISOString().slice(0, 10),
      nextBillingDate: membership.nextBillingDate,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  await setDoc(doc(db, `${tenantPath(tenantId)}/users/${userId}`), {
    email: membership.email,
    name: membership.name,
    role: membership.role,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  await setDoc(doc(db, `userTenants/${userId}/memberships/${tenantId}`), {
    companyName: finalCompanyName,
    role: membership.role,
    planId: membership.planId,
    subscriptionStatus: membership.subscriptionStatus,
    createdAt: serverTimestamp()
  });
  await updateDoc(doc(db, "invites", code), { status: "Usado", usedAt: serverTimestamp(), usedBy: userId });
  return membership;
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
  return {
    id: userId,
    tenantId,
    companyName: tenant.name || membership.companyName || "Empresa",
    role: membership.role || "Consulta",
    planId: tenant.planId || membership.planId || "medium",
    subscriptionStatus: tenant.subscriptionStatus || membership.subscriptionStatus || "trial",
    nextBillingDate: tenant.nextBillingDate || ""
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
  if (!firebaseReady || !auth) return () => undefined;
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
    const users = usersSnapshot.docs.map((userDoc) => ({ id: userDoc.id, ...userDoc.data() }));
    const lastSeenAt = Math.max(...users.map((user) => timestampToMillis(user.lastSeenAt)), 0);
    const lastAccessAt = Math.max(timestampToMillis(tenant.lastAccessAt), ...users.map((user) => timestampToMillis(user.lastAccessAt)), 0);
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
      users
    };
  }));

  return tenants.filter((tenant) => !tenant.archived);
}

export async function updateTenantSubscription(tenantId, updates) {
  await updateDoc(doc(db, tenantPath(tenantId)), { ...updates, updatedAt: serverTimestamp() });
}

export async function getTenantAiUsage(tenantId, planId = "medium") {
  if (!firebaseReady || !db || !tenantId) {
    return { limit: 0, monthKey: currentMonthKey(), remaining: 0, used: 0 };
  }

  const monthKey = currentMonthKey();
  const limit = PLANS[planId]?.limits?.aiCredits || 0;
  const snapshot = await getDoc(doc(db, `${tenantPath(tenantId)}/aiUsage/${monthKey}`)).catch(() => null);
  const used = snapshot?.exists?.() ? Number(snapshot.data().used || 0) : 0;

  return {
    limit,
    monthKey,
    remaining: Math.max(limit - used, 0),
    used
  };
}

export async function registerTenantAiUsage(tenantId, planId = "medium") {
  if (!firebaseReady || !db || !tenantId) {
    return { limit: 0, monthKey: currentMonthKey(), remaining: 0, used: 0 };
  }

  const monthKey = currentMonthKey();
  const limit = PLANS[planId]?.limits?.aiCredits || 0;

  await setDoc(doc(db, `${tenantPath(tenantId)}/aiUsage/${monthKey}`), {
    limit,
    monthKey,
    planId,
    updatedAt: serverTimestamp(),
    used: increment(1)
  }, { merge: true });

  return getTenantAiUsage(tenantId, planId);
}

export async function markTenantPaid(tenant) {
  const nextBillingDate = addMonths(tenant.nextBillingDate || tenant.startDate, 1);
  await updateTenantSubscription(tenant.id, {
    subscriptionStatus: "ativo",
    billingDay: Number(tenant.billingDay || 15),
    nextBillingDate
  });
}

export async function archiveTenant(tenantId) {
  await updateTenantSubscription(tenantId, {
    archived: true,
    subscriptionStatus: "cancelado"
  });
}

export async function listTenantUsers(tenantId) {
  const snapshot = await getDocs(collection(db, `${tenantPath(tenantId)}/users`));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function updateTenantUserRole(tenantId, userId, role) {
  await updateDoc(doc(db, `${tenantPath(tenantId)}/users/${userId}`), { role, updatedAt: serverTimestamp() });
}

export async function listTenantInvites(tenantId) {
  const snapshot = await getDocs(query(collection(db, "invites"), where("tenantId", "==", tenantId)));
  return snapshot.docs.map((item) => ({ code: item.id, ...item.data() }));
}

export async function cancelInvite(code) {
  await updateDoc(doc(db, "invites", code), { status: "Cancelado", updatedAt: serverTimestamp() });
}
