const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const dayjs = require('dayjs');
const crypto = require('crypto');
const {
    addBonus,
    isPaidStatus,
    monthKey,
    normalizeWallet,
    packageCredits,
    planIncludedCredits,
    refundCredit,
    reserveCredit,
    validateAdjustment,
    validSignature
} = require('./aiCredits');
const {
    CONTRACT_VERSION,
    SOURCE_SYSTEM,
    buildPortalClient,
    buildPortalPayload,
    isConnectorUrlAllowed
} = require('./portalSync');
require('dayjs/locale/pt-br');

// Inicializa o Firebase Admin
admin.initializeApp();
dayjs.locale('pt-br');

const db = admin.firestore();

// CONFIGURAÇÃO DA API DE WHATSAPP
// A API_KEY será lida com segurança dos Secrets do Firebase
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'http://orquestracs.com:8080'; 
const WHATSAPP_INSTANCE = process.env.WHATSAPP_INSTANCE || 'Orquestra_Auto_Detail';

/**
 * Função para disparar a mensagem via Gateway
 * Agora preparada para receber configurações dinâmicas no futuro
 */
async function sendWhatsApp(to, message, config = {}) {
    const url = config.url || WHATSAPP_API_URL;
    const key = config.key || process.env.WHATSAPP_API_KEY;
    const instance = config.instance || WHATSAPP_INSTANCE;

    try {
        const cleanNumber = to.replace(/\D/g, '');
        console.log(`[WhatsApp] Enviando para ${cleanNumber} via ${instance}...`);
        
        const response = await axios.post(`${url}/message/sendText/${instance}`, {
            number: cleanNumber,
            text: message,
            linkPreview: true
        }, {
            headers: { 'apikey': key },
            timeout: 10000 // 10 segundos de timeout
        });
        
        console.log(`[WhatsApp] Sucesso ao enviar para ${cleanNumber}`);
        return response.data;
    } catch (error) {
        console.error(`[WhatsApp] Erro ao enviar para ${to}:`, error.response?.data || error.message);
        return null;
    }
}

/**
 * Função de TESTE MANUAL (HTTP)
 * Acesse a URL gerada no deploy para disparar os testes
 */
exports.testWhatsAppNow = functions.https.onRequest(async (req, res) => {
    try {
        const amanhã = dayjs().add(1, 'day').format('DD/MM/YYYY');
        console.log(`[TESTE] Executando disparo manual para: ${amanhã}`);

        const snapshot = await db.collection('agendamentos')
            .where('dataStr', '==', amanhã)
            .get();

        if (snapshot.empty) {
            return res.status(200).send(`Nenhum agendamento encontrado para amanhã (${amanhã}). Crie um agendamento no Firestore para testar.`);
        }

        let enviados = 0;
        for (const doc of snapshot.docs) {
            const data = doc.data();
            const msg = `🧪 *TESTE DE AUTOMAÇÃO* 🧪\n\nOlá, *${data.cliente}*! Este é um teste do seu novo sistema de lembretes automáticos para amanhã às ${data.horario}.`;
            const success = await sendWhatsApp(data.telefone, msg);
            if (success) enviados++;
        }

        res.status(200).send(`Teste concluído! Agendamentos de amanhã: ${snapshot.size}. Mensagens enviadas: ${enviados}. Verifique os logs e o WhatsApp.`);
    } catch (error) {
        res.status(500).send(`Erro no teste: ${error.message}`);
    }
});

/**
 * Automação 1: Lembrete de Agendamento (24h antes)
 * Roda todos os dias às 18:00
 */
exports.scheduledAppointmentReminders = functions
    .runWith({ secrets: ['WHATSAPP_API_KEY'] })
    .pubsub
    .schedule('0 18 * * *') // Todo dia às 18:00
    .timeZone('America/Sao_Paulo')
    .onRun(async (context) => {
        const amanha = dayjs().add(1, 'day').format('DD/MM/YYYY');
        console.log(`Buscando agendamentos para: ${amanha}`);

        const snapshot = await db.collection('agendamentos')
            .where('dataStr', '==', amanha)
            .where('status', 'not-in', ['Cancelado', 'Concluído'])
            .get();

        if (snapshot.empty) {
            console.log('Nenhum agendamento encontrado para amanhã.');
            return null;
        }

        const promises = snapshot.docs.map(async (doc) => {
            const data = doc.data();
            if (data.lembreteAutomotivoEnviado) return; // Evita duplicidade

            const msg = `Olá, *${data.cliente}*! 🚗✨\n\nPassando para confirmar seu serviço de *${data.servico}* agendado para amanhã, dia *${data.dataStr}* às *${data.horario}*.\n\nPodemos confirmar? Aguardamos você!`;

            const success = await sendWhatsApp(data.telefone, msg);
            if (success) {
                await doc.ref.update({ lembreteAutomotivoEnviado: true });
            }
        });

        await Promise.all(promises);
        console.log('Processamento de lembretes concluído.');
        return null;
    });

/**
 * Automação 2: Lembrete de Aniversário
 * Roda todos os dias às 09:00
 */
exports.scheduledBirthdayWishes = functions
    .runWith({ secrets: ['WHATSAPP_API_KEY'] })
    .pubsub
    .schedule('0 9 * * *') // Todo dia às 09:00
    .timeZone('America/Sao_Paulo')
    .onRun(async (context) => {
        const hojeMesDia = dayjs().format('MM-DD');
        console.log(`Buscando aniversariantes do dia: ${hojeMesDia}`);

        const snapshot = await db.collection('clientes').get();

        const aniversariantes = snapshot.docs.filter(doc => {
            const data = doc.data();
            if (!data.dataAniversario) return false;
            return data.dataAniversario.endsWith(hojeMesDia);
        });

        if (aniversariantes.length === 0) {
            console.log('Nenhum aniversariante hoje.');
            return null;
        }

        const promises = aniversariantes.map(async (doc) => {
            const data = doc.data();
            const msg = `Parabéns, *${data.nome}*! 🎂🎉\n*FELIZ ANIVERSÁRIO!* 🥳🎊\n\nMuita saúde, paz, harmonia, sucesso e incontáveis realizações!!! Esperamos que no próximo ano, possamos mais uma vez celebrar muitas conquistas.\n\n— *Orquestra Auto Detail* 🚗✨`;

            await sendWhatsApp(data.telefone, msg);
        });

        await Promise.all(promises);
        console.log('Processamento de aniversários concluído.');
        return null;
    });

// Central Admin Orquestra.cs -------------------------------------------------
const PLATFORM_ADMIN_EMAIL = 'orquestracs@gmail.com';
const ADMIN_ALLOWED_FIELDS = [
    'name', 'responsibleName', 'accessEmail', 'phone', 'documentType',
    'documentNumber', 'legalName', 'tradeName', 'postalCode', 'addressStreet',
    'addressNumber', 'addressComplement', 'addressDistrict', 'addressCity',
    'addressState', 'googleMapsUrl', 'planId', 'monthlyAmount', 'billingDay',
    'toleranceDays', 'startDate', 'nextBillingDate', 'paymentMethod',
    'subscriptionStatus', 'internalNotes', 'adminUserLimit', 'collaboratorLimit',
    'aiCreditLimit', 'dataVersion'
];
const PLAN_USER_LIMITS = { starter: 1, medium: 3, premium: 8 };

function requireAuthenticated(context) {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Faça login para continuar.');
    }
}

function requirePlatformAdmin(context) {
    requireAuthenticated(context);
    if (String(context.auth.token.email || '').toLowerCase() !== PLATFORM_ADMIN_EMAIL) {
        throw new functions.https.HttpsError('permission-denied', 'Acesso exclusivo da administração Orquestra.cs.');
    }
}

function requiredString(value, field, max = 160) {
    const text = String(value || '').trim();
    if (!text) throw new functions.https.HttpsError('invalid-argument', `${field} é obrigatório.`);
    return text.slice(0, max);
}

function optionalString(value, max = 500) {
    return String(value || '').trim().slice(0, max);
}

function inviteCode() {
    return `${Math.random().toString(36).slice(2, 6)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

function pickAdminUpdates(input = {}) {
    const result = {};
    for (const field of ADMIN_ALLOWED_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(input, field)) result[field] = input[field];
    }
    if (result.name !== undefined) result.name = requiredString(result.name, 'Nome do cliente');
    if (result.planId !== undefined && !PLAN_USER_LIMITS[result.planId]) {
        throw new functions.https.HttpsError('invalid-argument', 'Plano inválido.');
    }
    if (result.subscriptionStatus !== undefined && !['trial', 'ativo', 'vencido', 'bloqueado', 'cancelado'].includes(result.subscriptionStatus)) {
        throw new functions.https.HttpsError('invalid-argument', 'Status de assinatura inválido.');
    }
    for (const field of ['monthlyAmount', 'billingDay', 'toleranceDays', 'adminUserLimit', 'collaboratorLimit', 'aiCreditLimit', 'dataVersion']) {
        if (result[field] !== undefined) result[field] = Math.max(0, Number(result[field]) || 0);
    }
    for (const field of Object.keys(result)) {
        if (typeof result[field] === 'string') result[field] = optionalString(result[field]);
    }
    return result;
}

async function writeAudit(tenantId, context, action, details = {}) {
    await db.collection('tenants').doc(tenantId).collection('audit').add({
        action,
        actorEmail: context.auth.token.email || '',
        actorUid: context.auth.uid,
        details,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
}

exports.adminCreateCommercialInvite = functions.https.onCall(async (data, context) => {
    requirePlatformAdmin(context);
    const tenantDraft = pickAdminUpdates(data?.tenant || {});
    const code = inviteCode();
    const planId = tenantDraft.planId || data?.planId || 'medium';
    const subscriptionStatus = tenantDraft.subscriptionStatus || data?.subscriptionStatus || 'trial';
    if (!PLAN_USER_LIMITS[planId]) throw new functions.https.HttpsError('invalid-argument', 'Plano inválido.');

    const invite = {
        code,
        inviteType: 'commercial',
        planId,
        role: 'Proprietario',
        status: 'Ativo',
        subscriptionStatus,
        billingDay: Number(tenantDraft.billingDay || 15),
        nextBillingDate: tenantDraft.nextBillingDate || '',
        companyName: requiredString(tenantDraft.name || data?.companyName, 'Nome do cliente'),
        tenantDraft,
        expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
        createdBy: context.auth.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    await db.collection('invites').doc(code).set(invite);
    return { code };
});

exports.createTenantInvite = functions.https.onCall(async (data, context) => {
    requireAuthenticated(context);
    const tenantId = requiredString(data?.tenantId, 'Empresa');
    const role = ['Proprietario', 'Financeiro', 'Consulta'].includes(data?.role) ? data.role : 'Consulta';
    const tenantRef = db.collection('tenants').doc(tenantId);
    const [tenantDoc, memberDoc, usersSnapshot, invitesSnapshot] = await Promise.all([
        tenantRef.get(),
        tenantRef.collection('users').doc(context.auth.uid).get(),
        tenantRef.collection('users').get(),
        db.collection('invites').where('tenantId', '==', tenantId).where('status', '==', 'Ativo').get()
    ]);
    if (!tenantDoc.exists || !memberDoc.exists || !['Proprietario', 'Proprietário'].includes(memberDoc.data().role)) {
        throw new functions.https.HttpsError('permission-denied', 'Você não pode convidar usuários desta empresa.');
    }
    const tenant = tenantDoc.data();
    const limit = Number(tenant.adminUserLimit || PLAN_USER_LIMITS[tenant.planId] || 1);
    if (usersSnapshot.size + invitesSnapshot.size >= limit) {
        throw new functions.https.HttpsError('resource-exhausted', `Limite de ${limit} usuário(s) do plano atingido.`);
    }
    const code = inviteCode();
    await db.collection('invites').doc(code).set({
        code,
        inviteType: 'user',
        tenantId,
        companyName: optionalString(data?.companyName || tenant.name, 160),
        role,
        status: 'Ativo',
        expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
        createdBy: context.auth.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { code };
});

exports.completeInviteRegistration = functions.https.onCall(async (data, context) => {
    requireAuthenticated(context);
    const code = requiredString(data?.code, 'Convite', 20).toUpperCase();
    const inviteRef = db.collection('invites').doc(code);
    const inviteDoc = await inviteRef.get();
    if (!inviteDoc.exists) throw new functions.https.HttpsError('not-found', 'Convite inválido.');
    const invite = inviteDoc.data();
    const expired = invite.expiresAt?.toMillis?.() && invite.expiresAt.toMillis() < Date.now();
    if (invite.status !== 'Ativo' || expired) {
        throw new functions.https.HttpsError('failed-precondition', 'Convite usado ou expirado.');
    }

    const tenantId = invite.tenantId || db.collection('tenants').doc().id;
    const tenantRef = db.collection('tenants').doc(tenantId);
    const userRef = tenantRef.collection('users').doc(context.auth.uid);
    const membershipRef = db.collection('userTenants').doc(context.auth.uid).collection('memberships').doc(tenantId);
    const finalCompanyName = optionalString(invite.companyName || data?.companyName, 160) || 'Empresa';
    const email = String(context.auth.token.email || data?.email || '').trim().toLowerCase();
    const role = invite.role || 'Consulta';
    const batch = db.batch();

    if (invite.inviteType === 'commercial') {
        batch.set(tenantRef, {
            ...(invite.tenantDraft || {}),
            name: finalCompanyName,
            planId: invite.planId || 'medium',
            subscriptionStatus: invite.subscriptionStatus || 'trial',
            billingDay: Number(invite.billingDay || 15),
            startDate: invite.tenantDraft?.startDate || new Date().toISOString().slice(0, 10),
            nextBillingDate: invite.nextBillingDate || '',
            dataVersion: Number(invite.tenantDraft?.dataVersion || 1),
            archived: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: false });
    }
    batch.set(userRef, {
        email,
        name: requiredString(data?.name, 'Nome'),
        role,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    batch.set(membershipRef, {
        companyName: finalCompanyName,
        role,
        planId: invite.planId || 'medium',
        subscriptionStatus: invite.subscriptionStatus || 'trial',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    batch.update(inviteRef, {
        status: 'Usado',
        usedAt: admin.firestore.FieldValue.serverTimestamp(),
        usedBy: context.auth.uid
    });
    await batch.commit();
    return {
        id: context.auth.uid,
        email,
        name: requiredString(data?.name, 'Nome'),
        role,
        tenantId,
        companyName: finalCompanyName,
        planId: invite.planId || 'medium',
        subscriptionStatus: invite.subscriptionStatus || 'trial',
        nextBillingDate: invite.nextBillingDate || ''
    };
});

exports.updateTenantUserRole = functions.https.onCall(async (data, context) => {
    requireAuthenticated(context);
    const tenantId = requiredString(data?.tenantId, 'Empresa');
    const userId = requiredString(data?.userId, 'Usuário');
    const role = requiredString(data?.role, 'Função');
    if (!['Proprietario', 'Financeiro', 'Consulta'].includes(role)) {
        throw new functions.https.HttpsError('invalid-argument', 'Função inválida.');
    }
    const requester = await db.collection('tenants').doc(tenantId).collection('users').doc(context.auth.uid).get();
    const isPlatformAdmin = String(context.auth.token.email || '').toLowerCase() === PLATFORM_ADMIN_EMAIL;
    if (!isPlatformAdmin && (!requester.exists || !['Proprietario', 'Proprietário'].includes(requester.data().role))) {
        throw new functions.https.HttpsError('permission-denied', 'Você não pode alterar funções desta empresa.');
    }
    await db.collection('tenants').doc(tenantId).collection('users').doc(userId).update({
        role,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    await db.collection('userTenants').doc(userId).collection('memberships').doc(tenantId).set({ role }, { merge: true });
    await writeAudit(tenantId, context, 'user.role_updated', { userId, role });
    return { ok: true };
});

exports.adminUpdateTenant = functions.https.onCall(async (data, context) => {
    requirePlatformAdmin(context);
    const tenantId = requiredString(data?.tenantId, 'Cliente');
    const updates = pickAdminUpdates(data?.updates || {});
    await db.collection('tenants').doc(tenantId).update({
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    await writeAudit(tenantId, context, 'tenant.updated', { fields: Object.keys(updates) });
    return { ok: true };
});

exports.adminRecordPayment = functions.https.onCall(async (data, context) => {
    requirePlatformAdmin(context);
    const tenantId = requiredString(data?.tenantId, 'Cliente');
    const payment = data?.payment || {};
    const tenantRef = db.collection('tenants').doc(tenantId);
    const paymentRef = tenantRef.collection('payments').doc();
    const batch = db.batch();
    batch.set(paymentRef, {
        amount: Math.max(0, Number(payment.amount) || 0),
        method: optionalString(payment.method, 40),
        note: optionalString(payment.note, 500),
        paidAt: optionalString(payment.paidAt, 10),
        referenceMonth: optionalString(payment.referenceMonth, 7),
        nextBillingDate: optionalString(payment.nextBillingDate, 10),
        recordedBy: context.auth.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    batch.update(tenantRef, {
        subscriptionStatus: 'ativo',
        nextBillingDate: optionalString(payment.nextBillingDate, 10),
        lastPaymentAt: optionalString(payment.paidAt, 10),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    await batch.commit();
    await writeAudit(tenantId, context, 'payment.recorded', { paymentId: paymentRef.id, referenceMonth: payment.referenceMonth || '' });
    return { ok: true, paymentId: paymentRef.id };
});

exports.adminArchiveTenant = functions.https.onCall(async (data, context) => {
    requirePlatformAdmin(context);
    const tenantId = requiredString(data?.tenantId, 'Cliente');
    await db.collection('tenants').doc(tenantId).update({
        archived: true,
        archivedAt: admin.firestore.FieldValue.serverTimestamp(),
        archivedBy: context.auth.uid,
        subscriptionStatus: 'cancelado',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    await writeAudit(tenantId, context, 'tenant.archived');
    return { ok: true };
});

exports.adminRestoreTenant = functions.https.onCall(async (data, context) => {
    requirePlatformAdmin(context);
    const tenantId = requiredString(data?.tenantId, 'Cliente');
    await db.collection('tenants').doc(tenantId).update({
        archived: false,
        restoredAt: admin.firestore.FieldValue.serverTimestamp(),
        restoredBy: context.auth.uid,
        subscriptionStatus: 'trial',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    await writeAudit(tenantId, context, 'tenant.restored');
    return { ok: true };
});

async function persistPortalSync(clients, status, error = '') {
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    for (let index = 0; index < clients.length; index += 400) {
        const batch = db.batch();
        clients.slice(index, index + 400).forEach((client) => {
            batch.set(db.collection('tenants').doc(client.id), {
                externalId: client.externalCustomerId,
                lastSyncAt: timestamp,
                lastSyncError: error,
                syncStatus: status
            }, { merge: true });
        });
        await batch.commit();
    }
}

async function buildAutoDetailPortalSnapshot() {
    const generatedAt = new Date().toISOString();
    const tenantSnapshot = await db.collection('tenants').get();
    const clients = await Promise.all(tenantSnapshot.docs.map(async (tenantDoc) => {
        const [usersSnapshot, paymentsSnapshot] = await Promise.all([
            tenantDoc.ref.collection('users').get(),
            tenantDoc.ref.collection('payments').get()
        ]);
        return buildPortalClient({
            tenantId: tenantDoc.id,
            tenant: tenantDoc.data(),
            users: usersSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
            payments: paymentsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
            generatedAt
        });
    }));
    const payload = buildPortalPayload(clients, generatedAt);
    const serializedPayload = JSON.stringify(payload);
    return {
        clients,
        serializedPayload,
        summary: {
            clientCount: clients.length,
            contractVersion: CONTRACT_VERSION,
            dataVersion: payload.dataVersion,
            generatedAt,
            onlineUserCount: clients.reduce((total, client) => total + client.onlineUserCount, 0),
            payloadBytes: Buffer.byteLength(serializedPayload, 'utf8'),
            sourceSystem: SOURCE_SYSTEM,
            userCount: clients.reduce((total, client) => total + client.users.length, 0)
        }
    };
}

exports.adminSyncPortal = functions
    .runWith({ secrets: ['ORQUESTRA_PORTAL_CONNECTOR_URL', 'ORQUESTRA_CONNECTOR_SHARED_SECRET'] })
    .https.onCall(async (_data, context) => {
        requirePlatformAdmin(context);
        const endpoint = String(process.env.ORQUESTRA_PORTAL_CONNECTOR_URL || '').trim();
        const sharedSecret = String(process.env.ORQUESTRA_CONNECTOR_SHARED_SECRET || '').trim();
        if (!endpoint || !sharedSecret || !isConnectorUrlAllowed(endpoint)) {
            throw new functions.https.HttpsError('failed-precondition', 'A integração com o Portal Orquestra.cs ainda não foi configurada no servidor.');
        }

        const snapshot = await buildAutoDetailPortalSnapshot();
        try {
            const response = await axios.post(endpoint, snapshot.serializedPayload, {
                headers: {
                    Authorization: `Bearer ${sharedSecret}`,
                    'Content-Type': 'application/json',
                    'X-Orquestra-Contract-Version': CONTRACT_VERSION,
                    'X-Orquestra-Source-System': SOURCE_SYSTEM
                },
                maxContentLength: 5 * 1024 * 1024,
                timeout: 30000,
                validateStatus: () => true
            });
            if (response.status < 200 || response.status >= 300) {
                const message = `Portal recusou a sincronização (HTTP ${response.status}).`;
                await persistPortalSync(snapshot.clients, 'error', message);
                throw new functions.https.HttpsError('unavailable', message);
            }
            await persistPortalSync(snapshot.clients, 'success');
            return { ok: true, summary: snapshot.summary };
        } catch (error) {
            if (error instanceof functions.https.HttpsError) throw error;
            const message = 'Falha de comunicação com o Portal Orquestra.cs.';
            await persistPortalSync(snapshot.clients, 'error', message).catch(() => undefined);
            console.error('[Portal] Sincronização indisponível.', error.code || error.message || 'unknown');
            throw new functions.https.HttpsError('unavailable', message);
        }
    });

exports.receivePortalCommand = functions
    .runWith({ secrets: ['ORQUESTRA_CONNECTOR_SHARED_SECRET'] })
    .https.onRequest(async (req, res) => {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
        const expectedSecret = String(process.env.ORQUESTRA_CONNECTOR_SHARED_SECRET || '').trim();
        const authorization = req.get('authorization') || '';
        const receivedSecret = String(req.get('x-orquestra-connector-secret') || authorization.replace(/^Bearer\s+/i, '')).trim();
        const receivedBuffer = Buffer.from(receivedSecret);
        const expectedBuffer = Buffer.from(expectedSecret);
        if (!expectedSecret || receivedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)) {
            return res.status(401).json({ error: 'Conector não autorizado.' });
        }

        const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
        const commandId = String(body.commandId || '').trim();
        const sourceSystem = String(body.sourceSystem || '').trim();
        const targetSystem = String(body.targetSystem || '').trim();
        const commandType = String(body.commandType || '').trim();
        const externalTenantId = String(body.externalTenantId || '').trim();
        const contract = body.contract && typeof body.contract === 'object' && !Array.isArray(body.contract) ? body.contract : {};
        if (!commandId || !externalTenantId || sourceSystem !== 'orquestra_portal' || targetSystem !== 'orquestra_auto_detail' || commandType !== 'tenant.updated') {
            return res.status(400).json({ error: 'Comando contratual inválido.' });
        }

        const tenantId = externalTenantId.replace(/^orquestra_auto_detail_/, '');
        const tenantRef = db.collection('tenants').doc(tenantId);
        const commandRef = db.collection('connectorCommands').doc(commandId);
        const updates = {};
        const plan = String(contract.plan || '').trim();
        if (['starter', 'medium', 'premium'].includes(plan)) updates.planId = plan;
        const monthlyAmount = contract.monthlyFee === null || contract.monthlyFee === undefined || contract.monthlyFee === '' ? null : Number(contract.monthlyFee);
        const billingDay = contract.billingDay === null || contract.billingDay === undefined || contract.billingDay === '' ? null : Number(contract.billingDay);
        const toleranceDays = contract.graceDays === null || contract.graceDays === undefined || contract.graceDays === '' ? null : Number(contract.graceDays);
        const startDate = String(contract.startDate || '').trim();
        const nextBillingDate = String(contract.renewalDate || contract.nextDueDate || '').trim();
        const paymentMethod = String(contract.paymentMethod || '').trim();
        const subscriptionStatus = String(contract.subscriptionStatus || '').trim();
        const internalNotes = String(contract.notes || '').trim();
        if (monthlyAmount !== null && (!Number.isFinite(monthlyAmount) || monthlyAmount < 0)) return res.status(400).json({ error: 'Mensalidade inválida.' });
        if (billingDay !== null && (!Number.isInteger(billingDay) || billingDay < 1 || billingDay > 31)) return res.status(400).json({ error: 'Dia de vencimento inválido.' });
        if (toleranceDays !== null && (!Number.isInteger(toleranceDays) || toleranceDays < 0 || toleranceDays > 60)) return res.status(400).json({ error: 'Tolerância inválida.' });
        if (startDate && !/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(startDate)) return res.status(400).json({ error: 'Data de início inválida.' });
        if (nextBillingDate && !/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(nextBillingDate)) return res.status(400).json({ error: 'Data de renovação inválida.' });
        if (['trial', 'ativo', 'vencido', 'bloqueado', 'cancelado'].includes(subscriptionStatus)) updates.subscriptionStatus = subscriptionStatus;
        if (monthlyAmount !== null) updates.monthlyAmount = monthlyAmount;
        if (billingDay !== null) updates.billingDay = billingDay;
        if (toleranceDays !== null) updates.toleranceDays = toleranceDays;
        if (startDate) updates.startDate = startDate.slice(0, 10);
        if (nextBillingDate) updates.nextBillingDate = nextBillingDate.slice(0, 10);
        if (paymentMethod) updates.paymentMethod = paymentMethod.slice(0, 80);
        if (internalNotes) updates.internalNotes = internalNotes.slice(0, 1000);

        try {
            let duplicate = false;
            await db.runTransaction(async (transaction) => {
                const [commandSnapshot, tenantSnapshot] = await Promise.all([transaction.get(commandRef), transaction.get(tenantRef)]);
                if (commandSnapshot.exists) { duplicate = true; return; }
                if (!tenantSnapshot.exists) throw new Error('tenant_not_found');
                transaction.update(tenantRef, { ...updates, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
                const now = new Date().toISOString();
                transaction.create(commandRef, { commandId, commandType, sourceSystem, targetSystem, externalTenantId, status: 'applied', fields: Object.keys(updates), createdAt: now, appliedAt: now });
                transaction.set(tenantRef.collection('audit').doc(commandId), { action: 'tenant.contract_updated_from_portal', actorEmail: 'orquestra_portal', actorUid: 'orquestra_portal', details: { fields: Object.keys(updates) }, createdAt: now });
            });
            return res.json({ ok: true, duplicate, tenantId });
        } catch (error) {
            if (error instanceof Error && error.message === 'tenant_not_found') return res.status(404).json({ error: 'Empresa de origem não encontrada.' });
            console.error('[Portal] Comando contratual recusado.', error.message || 'unknown');
            return res.status(500).json({ error: 'Não foi possível aplicar o comando no sistema de origem.' });
        }
    });

// Carteira de créditos da IA -------------------------------------------------
async function requireTenantMembership(context, tenantId) {
    requireAuthenticated(context);
    const membership = await db.collection('tenants').doc(tenantId).collection('users').doc(context.auth.uid).get();
    if (!membership.exists) {
        throw new functions.https.HttpsError('permission-denied', 'Usuário não pertence a esta empresa.');
    }
    return membership.data();
}

function walletForTenant(tenant) {
    const included = planIncludedCredits(tenant.planId, tenant.aiCreditLimit);
    return normalizeWallet(tenant.aiCredits || {}, included, monthKey());
}

async function renewTenantWallet(tenantId) {
    const tenantRef = db.collection('tenants').doc(tenantId);
    return db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(tenantRef);
        if (!snapshot.exists) throw new functions.https.HttpsError('not-found', 'Empresa não encontrada.');
        const tenant = snapshot.data();
        const wallet = walletForTenant(tenant);
        if (tenant.aiCredits?.renewalMonth !== wallet.renewalMonth || tenant.aiCredits?.included !== wallet.included) {
            transaction.update(tenantRef, { aiCredits: wallet, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        }
        return wallet;
    });
}

exports.getTenantAiCredits = functions.https.onCall(async (data, context) => {
    requireAuthenticated(context);
    const tenantId = requiredString(data?.tenantId, 'Empresa');
    const platformAdmin = String(context.auth.token.email || '').toLowerCase() === PLATFORM_ADMIN_EMAIL;
    if (!platformAdmin) await requireTenantMembership(context, tenantId);
    return renewTenantWallet(tenantId);
});

exports.adminAddAiCredits = functions.https.onCall(async (data, context) => {
    requirePlatformAdmin(context);
    const tenantId = requiredString(data?.tenantId, 'Cliente');
    let adjustment;
    try {
        adjustment = validateAdjustment(data?.credits, data?.reason);
    } catch (error) {
        const message = error.message === 'INVALID_CREDIT_REASON'
            ? 'O motivo deve ter entre 5 e 300 caracteres.'
            : 'Informe uma quantidade inteira entre 1 e 100.000 créditos.';
        throw new functions.https.HttpsError('invalid-argument', message);
    }

    const tenantRef = db.collection('tenants').doc(tenantId);
    const historyRef = tenantRef.collection('aiCreditAdjustments').doc();
    const result = await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(tenantRef);
        if (!snapshot.exists) throw new functions.https.HttpsError('not-found', 'Cliente não encontrado.');
        const before = walletForTenant(snapshot.data());
        const after = addBonus(before, adjustment.credits);
        const timestamp = admin.firestore.FieldValue.serverTimestamp();
        transaction.update(tenantRef, {
            aiCredits: {
                ...after,
                lastAdjustmentAt: timestamp,
                lastAdjustmentBy: context.auth.token.email || context.auth.uid
            },
            updatedAt: timestamp
        });
        transaction.set(historyRef, {
            type: 'manual_bonus',
            credits: adjustment.credits,
            reason: adjustment.reason,
            balanceBefore: before.balance,
            balanceAfter: after.balance,
            bonusBefore: before.bonus,
            bonusAfter: after.bonus,
            createdBy: context.auth.token.email || context.auth.uid,
            createdAt: timestamp
        });
        return after;
    });
    await writeAudit(tenantId, context, 'ai_credits.manual_bonus', { credits: adjustment.credits, adjustmentId: historyRef.id });
    return { ok: true, wallet: result };
});

async function requestOpenAi(question, snapshot, planLabel) {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.4,
        max_tokens: 700,
        messages: [
            {
                role: 'system',
                content: [
                    'Você é o Assistente IA do Orquestra Auto Detail.',
                    'Responda sempre em português do Brasil, com clareza e foco prático.',
                    'Não invente dados que não estejam no resumo recebido.',
                    'Use no máximo 3 tópicos curtos e termine com Próximo passo.'
                ].join('\n')
            },
            { role: 'user', content: JSON.stringify({ pergunta: question, plano: planLabel, resumoDoSistema: snapshot || {} }) }
        ]
    }, {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        timeout: 45000
    });
    return response.data?.choices?.[0]?.message?.content || 'Não foi possível gerar uma resposta agora.';
}

exports.askAiAssistant = functions
    .runWith({ secrets: ['OPENAI_API_KEY'] })
    .https.onCall(async (data, context) => {
        requireAuthenticated(context);
        const question = requiredString(data?.question, 'Pergunta', 2000);
        const isPlatformAdmin = String(context.auth.token.email || '').toLowerCase() === PLATFORM_ADMIN_EMAIL;
        if (isPlatformAdmin) {
            return { answer: await requestOpenAi(question, data?.snapshot, 'Admin Orquestra.cs'), wallet: null };
        }

        const tenantId = requiredString(data?.tenantId, 'Empresa');
        await requireTenantMembership(context, tenantId);
        const tenantRef = db.collection('tenants').doc(tenantId);
        const usageRef = tenantRef.collection('aiCreditUsage').doc();
        let reservedWallet;

        try {
            reservedWallet = await db.runTransaction(async (transaction) => {
                const tenantSnapshot = await transaction.get(tenantRef);
                if (!tenantSnapshot.exists) throw new functions.https.HttpsError('not-found', 'Empresa não encontrada.');
                const tenant = tenantSnapshot.data();
                const current = walletForTenant(tenant);
                let reserved;
                try { reserved = reserveCredit(current); }
                catch { throw new functions.https.HttpsError('resource-exhausted', 'Seus créditos de IA acabaram.'); }
                const timestamp = admin.firestore.FieldValue.serverTimestamp();
                transaction.update(tenantRef, { aiCredits: reserved, updatedAt: timestamp });
                transaction.set(usageRef, { credits: 1, status: 'reserved', userId: context.auth.uid, createdAt: timestamp });
                return reserved;
            });

            const tenantSnapshot = await tenantRef.get();
            const planLabels = { starter: 'Plano Inicial', medium: 'Plano Médio', premium: 'Plano Premium' };
            const answer = await requestOpenAi(question, data?.snapshot, planLabels[tenantSnapshot.data()?.planId] || 'Plano');
            await usageRef.update({ status: 'completed', completedAt: admin.firestore.FieldValue.serverTimestamp() });
            return { answer, wallet: reservedWallet };
        } catch (error) {
            if (reservedWallet) {
                await db.runTransaction(async (transaction) => {
                    const snapshot = await transaction.get(tenantRef);
                    if (!snapshot.exists) return;
                    const current = walletForTenant(snapshot.data());
                    transaction.update(tenantRef, { aiCredits: refundCredit(current), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
                    transaction.set(usageRef, { status: 'refunded', refundedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
                });
            }
            if (error instanceof functions.https.HttpsError) throw error;
            console.error('[IA] Falha após reserva; crédito devolvido.', error.response?.data?.error?.type || error.code || 'unknown');
            throw new functions.https.HttpsError('internal', 'A IA não respondeu. O crédito foi devolvido automaticamente.');
        }
    });

exports.portalAiCreditsWebhook = functions
    .runWith({ secrets: ['ORQUESTRA_PORTAL_WEBHOOK_SECRET'] })
    .https.onRequest(async (req, res) => {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
        const secret = process.env.ORQUESTRA_PORTAL_WEBHOOK_SECRET;
        const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
        if (!validSignature(rawBody, req.headers['x-orquestra-signature'], secret)) {
            return res.status(401).json({ error: 'Assinatura inválida.' });
        }
        try {
            const { eventId, paymentId, packageId, externalCustomerId, sourceSystem, status } = req.body || {};
            if (sourceSystem !== 'orquestra_auto_detail') return res.status(400).json({ error: 'Sistema de origem inválido.' });
            if (!isPaidStatus(status)) {
                return res.status(400).json({ error: 'Pagamento ainda não confirmado.' });
            }
            const credits = packageCredits(packageId);
            const safeEventId = requiredString(eventId, 'Evento', 180);
            const safePaymentId = requiredString(paymentId, 'Pagamento', 180);
            const externalId = requiredString(externalCustomerId, 'Cliente externo', 180);
            let tenantSnapshot = await db.collection('tenants').doc(externalId).get();
            if (!tenantSnapshot.exists) {
                const querySnapshot = await db.collection('tenants').where('externalId', '==', externalId).limit(1).get();
                tenantSnapshot = querySnapshot.docs[0];
            }
            if (!tenantSnapshot?.exists) return res.status(404).json({ error: 'Carteira não encontrada.' });
            const tenantRef = tenantSnapshot.ref;
            const eventKey = crypto.createHash('sha256').update(safePaymentId).digest('hex');
            const eventRef = db.collection('portalAiCreditEvents').doc(eventKey);
            const adjustmentRef = tenantRef.collection('aiCreditAdjustments').doc();
            const result = await db.runTransaction(async (transaction) => {
                const [eventSnapshot, freshTenant] = await Promise.all([transaction.get(eventRef), transaction.get(tenantRef)]);
                if (eventSnapshot.exists) return { duplicate: true, wallet: freshTenant.data()?.aiCredits || null };
                const before = walletForTenant(freshTenant.data());
                const after = addBonus(before, credits);
                const timestamp = admin.firestore.FieldValue.serverTimestamp();
                transaction.update(tenantRef, { aiCredits: { ...after, lastAdjustmentAt: timestamp, lastAdjustmentBy: 'portal_orquestra' }, updatedAt: timestamp });
                transaction.set(eventRef, { eventId: safeEventId, paymentId: safePaymentId, tenantId: tenantRef.id, packageId, credits, createdAt: timestamp });
                transaction.set(adjustmentRef, { type: 'portal_purchase', credits, packageId, paymentId: safePaymentId, balanceBefore: before.balance, balanceAfter: after.balance, bonusBefore: before.bonus, bonusAfter: after.bonus, createdBy: 'portal_orquestra', createdAt: timestamp });
                return { duplicate: false, wallet: after };
            });
            return res.status(200).json({ ok: true, duplicate: result.duplicate, credits, balance: result.wallet?.balance });
        } catch (error) {
            if (error.message === 'INVALID_PACKAGE') return res.status(400).json({ error: 'Pacote inválido.' });
            if (error instanceof functions.https.HttpsError) return res.status(400).json({ error: error.message });
            console.error('[Portal] Falha ao sincronizar créditos.', error.code || error.message);
            return res.status(500).json({ error: 'Não foi possível sincronizar os créditos.' });
        }
    });



