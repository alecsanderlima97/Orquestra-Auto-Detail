import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
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

export const ROLES = ["Proprietário", "Financeiro", "Consulta"];
export const SUBSCRIPTION_STATUSES = ["trial", "ativo", "vencido", "bloqueado", "cancelado"];

export const PLANS = {
  starter: { label: "Starter", monthlyPrice: "R$ 97", limits: { users: 2, vehicles: 200, appointments: 150, aiCredits: 0 }, features: ["Agenda", "Clientes e veiculos", "Catalogo de servicos", "Backup local"] },
  medium: { label: "Medium", monthlyPrice: "R$ 197", limits: { users: 5, vehicles: 1000, appointments: 800, aiCredits: 30 }, features: ["Tudo do Starter", "Financeiro completo", "Estoque", "Convites internos", "Assistente IA inicial"] },
  profissional: { label: "Profissional", monthlyPrice: "R$ 197", limits: { users: 5, vehicles: 1000, appointments: 800, aiCredits: 30 }, features: ["Tudo do Starter", "Financeiro completo", "Estoque", "Convites internos", "Assistente IA inicial"] },
  premium: { label: "Premium", monthlyPrice: "R$ 397", limits: { users: 12, vehicles: 5000, appointments: 3000, aiCredits: 120 }, features: ["Tudo do Medium", "Multiunidade", "Prioridade no suporte", "Assistente IA avancado"] }
};

export function daysPastDue(nextBillingDate, now = new Date()) {
  if (!nextBillingDate) return 0;
  const due = new Date(`${nextBillingDate}T23:59:59`);
  if (Number.isNaN(due.getTime()) || now <= due) return 0;
  return Math.floor((now.getTime() - due.getTime()) / 86400000);
}

export function getSubscriptionAccess(user) {
  const status = user?.subscriptionStatus || "trial";
  const pastDueDays = daysPastDue(user?.nextBillingDate);
  const autoBlocked = status === "vencido" && pastDueDays >= 5;
  const blocked = status === "bloqueado" || status === "cancelado" || autoBlocked;

  return {
    blocked,
    pastDueDays,
    plan: PLANS[user?.planId] || PLANS.medium,
    reason: autoBlocked ? "vencido_5_dias" : status,
    status,
    warning: status === "vencido" && !autoBlocked
  };
}

export function canWrite(role) {
  return role === "Proprietário" || role === "Financeiro";
}

export function canManageUsers(role) {
  return role === "Proprietário";
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

export async function createCommercialInvite(planId = "profissional", subscriptionStatus = "trial", nextBillingDate = "") {
  if (!firebaseReady || !db) throw new Error("Configure um novo projeto Firebase no .env antes de gerar convites.");
  const code = createCode();
  const invite = {
    code,
    inviteType: "commercial",
    planId,
    role: "Proprietário",
    status: "Ativo",
    subscriptionStatus,
    nextBillingDate,
    expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    createdAt: serverTimestamp()
  };
  await setDoc(doc(db, "invites", code), invite);
  return invite;
}

export async function createInternalInvite(tenantId, companyName, role = "Consulta") {
  if (!firebaseReady || !db) throw new Error("Firebase não configurado.");
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
  if (!invite) throw new Error("Convite inválido, usado ou expirado.");

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
    planId: invite.planId || "profissional",
    subscriptionStatus: invite.subscriptionStatus || "trial",
    nextBillingDate: invite.nextBillingDate || ""
  };

  if (invite.inviteType === "commercial") {
    await setDoc(doc(db, tenantPath(tenantId)), {
      name: finalCompanyName,
      planId: membership.planId,
      subscriptionStatus: membership.subscriptionStatus,
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
  if (!firebaseReady || !auth || !db) throw new Error("Firebase não configurado.");
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  if (credential.user.email === "orquestracs@gmail.com") {
    return { id: credential.user.uid, email: credential.user.email, name: "Suporte Técnico", role: "dev" };
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
  if (!first) throw new Error("Usuário sem empresa vinculada.");
  const tenantId = first.id;
  const membership = first.data();
  const tenantSnapshot = await getDoc(doc(db, tenantPath(tenantId)));
  const tenant = tenantSnapshot.exists() ? tenantSnapshot.data() : {};
  return {
    id: userId,
    tenantId,
    companyName: membership.companyName || tenant.name || "Empresa",
    role: membership.role || "Consulta",
    planId: tenant.planId || membership.planId || "profissional",
    subscriptionStatus: tenant.subscriptionStatus || membership.subscriptionStatus || "trial",
    nextBillingDate: tenant.nextBillingDate || ""
  };
}

export function listenAuth(callback) {
  if (!firebaseReady || !auth) return () => undefined;
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) return callback(null);
    try {
      if (firebaseUser.email === "orquestracs@gmail.com") {
        callback({ id: firebaseUser.uid, email: firebaseUser.email, name: "Suporte Técnico", role: "dev" });
        return;
      }
      callback(await loadUserMembership(firebaseUser.uid));
    } catch {
      callback(null);
    }
  });
}

export async function logoutCommercialUser() {
  if (auth) await signOut(auth);
}

export async function listPlatformTenants() {
  if (!firebaseReady || !db) return [];
  const snapshot = await getDocs(query(collection(db, "tenants"), orderBy("name")));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function updateTenantSubscription(tenantId, updates) {
  await updateDoc(doc(db, tenantPath(tenantId)), { ...updates, updatedAt: serverTimestamp() });
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
