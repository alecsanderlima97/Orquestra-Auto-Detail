/* global module, require */
// Núcleo do agendamento pelo cliente: acesso ao Firestore e regras de negócio.
// Usado pela API da Vercel (api/booking.js) e, se o projeto tiver plano Blaze, pelas Cloud Functions.
// Recebe o Firestore e os utilitários do firebase-admin por parâmetro, para funcionar com qualquer versão.

const crypto = require('crypto');
const {
    BookingError,
    availableSlots,
    isBookingOpen,
    isBot,
    isIsoDate,
    listPublicServices,
    normalizeConfig,
    normalizeSlug,
    serviceDuration,
    serviceLabel,
    servicePortes,
    toStoredDate,
    validateBookingInput,
    withinRateLimit
} = require('./publicBooking');

const PLATFORM_ADMIN_EMAIL = 'orquestracs@gmail.com';
const OWNER_ROLES = ['Proprietario', 'Proprietário'];
const LIMIT_IP = { max: 5, windowMs: 60 * 60 * 1000 };        // 5 pedidos por hora por IP
const LIMIT_PHONE = { max: 3, windowMs: 24 * 60 * 60 * 1000 }; // 3 pedidos por dia por WhatsApp e empresa
const CONSENT_VERSION = 'v1';

/** Hash curto para chaves de limite: não guardamos IP nem telefone em texto. */
function hashKey(value) {
    return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 40);
}

function activeService(servicos, serviceId) {
    return (servicos || []).find((s) => String(s?.id) === String(serviceId || '') && !s.deletedAt && s.deleted !== true);
}

function createBookingCore({ db, FieldValue, Timestamp }) {
    async function loadPublicBooking(slugInput) {
        const slug = normalizeSlug(slugInput);
        const unavailable = new BookingError('not-found', 'Agendamento online indisponível para este link.');
        if (slug.length < 3) throw unavailable;
        const slugDoc = await db.collection('bookingSlugs').doc(slug).get();
        if (!slugDoc.exists) throw unavailable;
        const tenantId = String(slugDoc.get('tenantId') || '');
        if (!tenantId) throw unavailable;
        const tenantRef = db.collection('tenants').doc(tenantId);
        const [tenantSnap, configSnap] = await Promise.all([
            tenantRef.get(),
            tenantRef.collection('bookingConfig').doc('main').get()
        ]);
        const tenant = tenantSnap.exists ? tenantSnap.data() : null;
        const config = configSnap.exists ? configSnap.data() : null;
        if (!config || config.slug !== slug || !isBookingOpen(tenant, config)) throw unavailable;
        return { tenantId, tenantRef, tenant, config };
    }

    const requestsOfDay = (tenantRef, date) => tenantRef.collection('bookingRequests').where('date', '==', date);

    async function getInfo({ slug }) {
        const { tenantRef, tenant, config } = await loadPublicBooking(slug);
        const appSnap = await tenantRef.collection('appData').doc('main').get();
        return {
            companyName: String(tenant.name || tenant.companyName || 'Estética automotiva').slice(0, 120),
            message: config.message || '',
            workDays: config.workDays,
            openTime: config.openTime,
            closeTime: config.closeTime,
            maxDaysAhead: config.maxDaysAhead,
            services: listPublicServices(appSnap.exists ? appSnap.get('servicos') : [], config.showPrices)
        };
    }

    async function getAvailability({ slug, serviceId, date }) {
        if (!isIsoDate(date)) throw new BookingError('invalid-argument', 'Data inválida.');
        const { tenantRef, config } = await loadPublicBooking(slug);
        const [appSnap, requestsSnap] = await Promise.all([
            tenantRef.collection('appData').doc('main').get(),
            requestsOfDay(tenantRef, date).get()
        ]);
        const app = appSnap.exists ? appSnap.data() : {};
        const servico = activeService(app.servicos, serviceId);
        if (!servico) throw new BookingError('invalid-argument', 'Serviço indisponível.');
        return {
            slots: availableSlots({
                config,
                date,
                durationMinutes: serviceDuration(servico),
                appointments: app.agendamentos || [],
                requests: requestsSnap.docs.map((d) => d.data())
            })
        };
    }

    async function createRequest(data, { ip }) {
        // Robô: responde como sucesso para não ensinar o atacante, mas não grava nada.
        if (isBot(data || {})) return { ok: true };
        const input = validateBookingInput(data || {});
        const { tenantId, tenantRef, config } = await loadPublicBooking(data?.slug);
        const ipLimitRef = db.collection('bookingRateLimits').doc(`ip-${hashKey(ip || 'desconhecido')}`);
        const phoneLimitRef = db.collection('bookingRateLimits').doc(`tel-${hashKey(`${tenantId}:${input.phone}`)}`);
        const requestRef = tenantRef.collection('bookingRequests').doc();
        const nowMs = Date.now();

        await db.runTransaction(async (t) => {
            const [ipLimit, phoneLimit, appSnap, requestsSnap] = await Promise.all([
                t.get(ipLimitRef),
                t.get(phoneLimitRef),
                t.get(tenantRef.collection('appData').doc('main')),
                t.get(requestsOfDay(tenantRef, input.date))
            ]);

            const ipCheck = withinRateLimit(ipLimit.exists ? ipLimit.data() : null, nowMs, LIMIT_IP);
            const phoneCheck = withinRateLimit(phoneLimit.exists ? phoneLimit.data() : null, nowMs, LIMIT_PHONE);
            if (!ipCheck.allowed || !phoneCheck.allowed) {
                throw new BookingError('resource-exhausted', 'Muitos pedidos em pouco tempo. Tente novamente mais tarde ou fale com a empresa pelo WhatsApp.');
            }

            const app = appSnap.exists ? appSnap.data() : {};
            const servico = activeService(app.servicos, input.serviceId);
            if (!servico) throw new BookingError('invalid-argument', 'Serviço indisponível.');
            const duration = serviceDuration(servico);
            const slots = availableSlots({
                config,
                date: input.date,
                durationMinutes: duration,
                appointments: app.agendamentos || [],
                requests: requestsSnap.docs.map((d) => d.data()),
                nowMs
            });
            if (!slots.includes(input.time)) {
                throw new BookingError('failed-precondition', 'Este horário acabou de ser ocupado. Escolha outro.');
            }

            // Porte precisa existir no catálogo; preço vem do servidor, nunca do navegador.
            const portes = servicePortes(servico);
            const porte = portes.find((p) => p.nome === input.porte) || portes[0];
            const expiresAt = Timestamp.fromMillis(nowMs + 2 * 24 * 60 * 60 * 1000);
            t.set(ipLimitRef, { ...ipCheck.next, expiresAt });
            t.set(phoneLimitRef, { ...phoneCheck.next, expiresAt });
            t.set(requestRef, {
                status: 'pendente',
                name: input.name,
                phone: input.phone,
                vehicle: input.vehicle,
                plate: input.plate,
                notes: input.notes,
                serviceId: input.serviceId,
                serviceName: serviceLabel(servico, porte.nome),
                porte: porte.nome,
                price: porte.valor,
                durationMinutes: duration,
                date: input.date,
                dataStr: toStoredDate(input.date),
                time: input.time,
                source: 'link-publico',
                consentVersion: CONSENT_VERSION,
                consentAt: FieldValue.serverTimestamp(),
                createdAt: FieldValue.serverTimestamp()
            });
        });

        return { ok: true, protocol: requestRef.id.slice(0, 6).toUpperCase(), requestId: requestRef.id, tenantId };
    }

    /** Só o proprietário (ou a administração Orquestra) altera a configuração. */
    async function saveConfig(data, actor) {
        if (!actor?.uid) throw new BookingError('unauthenticated', 'Faça login para continuar.');
        const tenantId = String(data?.tenantId || '').trim();
        if (!tenantId) throw new BookingError('invalid-argument', 'Empresa é obrigatória.');
        const tenantRef = db.collection('tenants').doc(tenantId);
        const isPlatformAdmin = String(actor.email || '').toLowerCase() === PLATFORM_ADMIN_EMAIL;
        if (!isPlatformAdmin) {
            const member = await tenantRef.collection('users').doc(actor.uid).get();
            if (!member.exists || !OWNER_ROLES.includes(member.data().role)) {
                throw new BookingError('permission-denied', 'Só o proprietário pode configurar o agendamento online.');
            }
        }

        const config = normalizeConfig(data?.config || {});
        const configRef = tenantRef.collection('bookingConfig').doc('main');
        const slugRef = db.collection('bookingSlugs').doc(config.slug);
        let previous = null;

        await db.runTransaction(async (t) => {
            const [tenantSnap, currentSnap, slugSnap] = await Promise.all([t.get(tenantRef), t.get(configRef), t.get(slugRef)]);
            if (!tenantSnap.exists) throw new BookingError('not-found', 'Empresa não encontrada.');
            if (slugSnap.exists && slugSnap.get('tenantId') !== tenantId) {
                throw new BookingError('already-exists', 'Este endereço de link já está em uso. Escolha outro.');
            }
            previous = currentSnap.exists ? currentSnap.data() : null;
            if (previous?.slug && previous.slug !== config.slug) {
                t.delete(db.collection('bookingSlugs').doc(previous.slug));
            }
            t.set(slugRef, { tenantId, updatedAt: FieldValue.serverTimestamp() });
            t.set(configRef, { ...config, updatedBy: actor.uid, updatedAt: FieldValue.serverTimestamp() });
        });

        await tenantRef.collection('audit').add({
            action: 'booking.config_updated',
            actorEmail: actor.email || '',
            actorUid: actor.uid,
            details: {
                before: previous ? { enabled: previous.enabled === true, slug: previous.slug || '' } : null,
                after: { enabled: config.enabled, slug: config.slug }
            },
            createdAt: FieldValue.serverTimestamp()
        });
        return { ok: true, config };
    }

    return { getInfo, getAvailability, createRequest, saveConfig };
}

module.exports = { BookingError, createBookingCore };
