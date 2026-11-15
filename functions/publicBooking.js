/* global module */
// Regras puras do agendamento pelo cliente (página pública).
// Sem Firebase aqui: tudo testável com node --test.
//
// Os critérios de horário seguem src/lib/agenda.js (mesma leitura de "horario" e "duracao").
// As functions são CommonJS e não importam o código ESM do app, por isso a cópia mínima abaixo.

const MIN_SLOT = 30;
const DEFAULT_DURATION = 120;
const BLOCKING_STATUSES_EXCLUDED = ['Cancelado'];
const BR_OFFSET_MINUTES = -180; // America/Sao_Paulo, sem horário de verão desde 2019
const BLOCKED_SUBSCRIPTIONS = ['bloqueado', 'cancelado'];

class BookingError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

const DEFAULT_CONFIG = Object.freeze({
    enabled: false,
    slug: '',
    workDays: [1, 2, 3, 4, 5, 6],
    openTime: '08:00',
    closeTime: '18:00',
    slotMinutes: 60,
    capacity: 1,
    minLeadHours: 2,
    maxDaysAhead: 30,
    showPrices: true,
    message: ''
});

function clampInt(value, min, max, fallback) {
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
}

function isClock(value) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''));
}

function clockToMinutes(value) {
    const [h, m] = String(value).split(':').map(Number);
    return h * 60 + m;
}

function minutesToClock(total) {
    const h = Math.floor(total / 60) % 24;
    const m = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Endereço público: letras minúsculas, números e hífen (3 a 40). */
function normalizeSlug(value) {
    return String(value || '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);
}

/** Valida a configuração enviada pela empresa (allowlist de campos). */
function normalizeConfig(input = {}) {
    const slug = normalizeSlug(input.slug);
    if (slug.length < 3) throw new BookingError('invalid-argument', 'O endereço do link precisa ter ao menos 3 letras ou números.');

    const openTime = isClock(input.openTime) ? input.openTime : DEFAULT_CONFIG.openTime;
    const closeTime = isClock(input.closeTime) ? input.closeTime : DEFAULT_CONFIG.closeTime;
    if (clockToMinutes(closeTime) <= clockToMinutes(openTime)) {
        throw new BookingError('invalid-argument', 'O horário de fechamento precisa ser depois da abertura.');
    }

    const workDays = Array.isArray(input.workDays)
        ? [...new Set(input.workDays.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
        : [...DEFAULT_CONFIG.workDays];
    if (!workDays.length) throw new BookingError('invalid-argument', 'Escolha ao menos um dia de atendimento.');

    return {
        enabled: input.enabled === true,
        slug,
        workDays,
        openTime,
        closeTime,
        slotMinutes: [30, 60, 90, 120].includes(Number(input.slotMinutes)) ? Number(input.slotMinutes) : DEFAULT_CONFIG.slotMinutes,
        capacity: clampInt(input.capacity, 1, 10, DEFAULT_CONFIG.capacity),
        minLeadHours: clampInt(input.minLeadHours, 0, 72, DEFAULT_CONFIG.minLeadHours),
        maxDaysAhead: clampInt(input.maxDaysAhead, 1, 90, DEFAULT_CONFIG.maxDaysAhead),
        showPrices: input.showPrices !== false,
        message: String(input.message || '').trim().slice(0, 300)
    };
}

/** Empresa pode receber pedidos? Link ligado, empresa não arquivada nem bloqueada. */
function isBookingOpen(tenant, config) {
    if (!tenant || !config || config.enabled !== true) return false;
    if (tenant.archivedAt || tenant.archived === true) return false;
    return !BLOCKED_SUBSCRIPTIONS.includes(String(tenant.subscriptionStatus || '').toLowerCase());
}

/** Duração em minutos a partir de "HH:mm", "3h", "1h 30", "45 min" ou "Dia inteiro". */
function durationMinutes(raw) {
    const text = String(raw ?? '').trim().toLowerCase();
    if (!text) return DEFAULT_DURATION;
    if (text.includes('dia')) return 8 * 60;
    const clock = text.match(/^(\d{1,2}):(\d{2})$/);
    if (clock) return Math.max(MIN_SLOT, Number(clock[1]) * 60 + Number(clock[2]));
    const hours = text.match(/(\d+)\s*h(?:\s*(\d+))?/);
    const minutesOnly = text.match(/(\d+)\s*min/);
    if (hours || minutesOnly) {
        return Math.max(MIN_SLOT, Number(hours?.[1] ?? 0) * 60 + Number(hours?.[2] ?? minutesOnly?.[1] ?? 0));
    }
    return DEFAULT_DURATION;
}

function serviceDuration(servico) {
    return durationMinutes(servico?.duracao || servico?.tempoEstimado);
}

function isActiveRecord(item) {
    return Boolean(item) && !item.deletedAt && item.deleted !== true;
}

/** Portes (variações de preço) de um serviço, no mesmo formato do formulário da agenda. */
function servicePortes(servico) {
    const base = Number(servico?.preco);
    const extras = Array.isArray(servico?.categorias) ? servico.categorias : [];
    return [
        { nome: 'Pequeno', valor: Number.isFinite(base) ? base : 0 },
        ...extras
            .filter((c) => String(c?.nome || '').trim())
            .map((c) => ({ nome: String(c.nome).trim().slice(0, 40), valor: Number(c.valor) || 0 }))
    ];
}

/** Nome salvo na agenda: "Serviço" ou "Serviço (Porte)", igual ao formulário interno. */
function serviceLabel(servico, porte) {
    const nome = String(servico?.nome || '').trim().slice(0, 120);
    return porte && porte !== 'Pequeno' ? `${nome} (${porte})` : nome;
}

/** Catálogo público: o mesmo catálogo da empresa, sem dados internos. */
function listPublicServices(servicos = [], showPrices = true) {
    return (Array.isArray(servicos) ? servicos : [])
        .filter((s) => isActiveRecord(s) && s.id != null && String(s.nome || '').trim())
        .map((s) => {
            const portes = servicePortes(s);
            const prices = portes.map((p) => p.valor).filter((v) => v > 0);
            return {
                id: String(s.id),
                nome: String(s.nome).trim().slice(0, 120),
                categoria: String(s.categoria || 'SERVIÇOS').trim().toUpperCase().slice(0, 40),
                descricao: String(s.descricao || '').trim().slice(0, 1000),
                duracaoMinutos: serviceDuration(s),
                precoAPartirDe: showPrices && prices.length ? Math.min(...prices) : null,
                portes: portes.map((p) => ({ nome: p.nome, valor: showPrices && p.valor > 0 ? p.valor : null }))
            };
        });
}

/** "AAAA-MM-DD" -> "DD/MM/AAAA" (formato salvo na agenda). */
function toStoredDate(isoDate) {
    const [y, m, d] = String(isoDate).split('-');
    return `${d}/${m}/${y}`;
}

function isIsoDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
    const date = new Date(`${value}T12:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Data (AAAA-MM-DD) e minutos do dia no horário de Brasília. */
function brazilNow(nowMs = Date.now()) {
    const local = new Date(nowMs + BR_OFFSET_MINUTES * 60 * 1000);
    return { date: local.toISOString().slice(0, 10), minutes: local.getUTCHours() * 60 + local.getUTCMinutes() };
}

function daysBetween(fromIso, toIso) {
    return Math.round((Date.parse(`${toIso}T12:00:00Z`) - Date.parse(`${fromIso}T12:00:00Z`)) / 86400000);
}

/** Intervalos ocupados no dia: agenda (não cancelada) + pedidos pendentes. */
function busyIntervals(dateIso, appointments = [], requests = []) {
    const stored = toStoredDate(dateIso);
    const fromAgenda = (Array.isArray(appointments) ? appointments : [])
        .filter((a) => isActiveRecord(a) && !BLOCKING_STATUSES_EXCLUDED.includes(a.status) && (a.dataStr ?? a.date) === stored && isClock(String(a.horario || '').padStart(5, '0')))
        .map((a) => {
            const start = clockToMinutes(String(a.horario).padStart(5, '0'));
            const begin = start === 0 ? 24 * 60 : start;
            return [begin, begin + durationMinutes(a.duracao ?? a.duration)];
        });
    const fromRequests = (Array.isArray(requests) ? requests : [])
        .filter((r) => r && r.status === 'pendente' && r.date === dateIso && isClock(r.time))
        .map((r) => {
            const start = clockToMinutes(r.time);
            return [start, start + Number(r.durationMinutes || DEFAULT_DURATION)];
        });
    return [...fromAgenda, ...fromRequests];
}

/**
 * Horários livres para um serviço em uma data.
 * Livre = dentro do expediente, respeita antecedência mínima e o número de atendimentos
 * simultâneos (capacity) não é atingido em nenhum momento do intervalo.
 */
function availableSlots({ config, date, durationMinutes: duration, appointments = [], requests = [], nowMs = Date.now() }) {
    if (!config || !isIsoDate(date)) return [];
    const now = brazilNow(nowMs);
    const ahead = daysBetween(now.date, date);
    if (ahead < 0 || ahead > config.maxDaysAhead) return [];

    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    if (!config.workDays.includes(weekday)) return [];

    const open = clockToMinutes(config.openTime);
    const close = clockToMinutes(config.closeTime);
    const length = Math.max(MIN_SLOT, Number(duration) || DEFAULT_DURATION);
    // Antecedência mínima medida em minutos corridos a partir de agora.
    const earliest = now.minutes + config.minLeadHours * 60 - ahead * 24 * 60;
    const busy = busyIntervals(date, appointments, requests);

    const slots = [];
    for (let start = open; start + length <= close; start += config.slotMinutes) {
        if (start < earliest) continue;
        const end = start + length;
        // Pico de ocupação dentro do intervalo: basta checar o início e cada início ocupado dentro dele.
        const checkpoints = [start, ...busy.map(([b]) => b).filter((b) => b > start && b < end)];
        const peak = Math.max(...checkpoints.map((t) => busy.filter(([b, e]) => b <= t && t < e).length));
        if (peak < config.capacity) slots.push(minutesToClock(start));
    }
    return slots;
}

function onlyDigits(value) {
    return String(value || '').replace(/\D/g, '');
}

/** WhatsApp brasileiro: DDD + número (10 ou 11 dígitos), aceita prefixo 55. Devolve com 55. */
function normalizePhone(value) {
    let digits = onlyDigits(value);
    if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) digits = digits.slice(2);
    if (digits.length !== 10 && digits.length !== 11) return '';
    if (digits.startsWith('0')) return '';
    return `55${digits}`;
}

function normalizePlate(value) {
    const plate = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!plate) return '';
    return /^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(plate) ? plate : null;
}

function cleanText(value, max) {
    // eslint-disable-next-line no-control-regex -- remove caracteres de controle de propósito
    return String(value || '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Valida o pedido do cliente. Campos fora da lista são ignorados. */
function validateBookingInput(input = {}) {
    const name = cleanText(input.name, 80);
    if (name.length < 3) throw new BookingError('invalid-argument', 'Informe seu nome.');
    const phone = normalizePhone(input.phone);
    if (!phone) throw new BookingError('invalid-argument', 'Informe um WhatsApp válido com DDD.');
    const vehicle = cleanText(input.vehicle, 80);
    if (vehicle.length < 2) throw new BookingError('invalid-argument', 'Informe o modelo do veículo.');
    const plate = normalizePlate(input.plate);
    if (plate === null) throw new BookingError('invalid-argument', 'Placa inválida. Use o formato ABC1D23 ou ABC1234.');
    const serviceId = cleanText(input.serviceId, 40);
    if (!serviceId) throw new BookingError('invalid-argument', 'Escolha um serviço.');
    if (!isIsoDate(input.date)) throw new BookingError('invalid-argument', 'Data inválida.');
    if (!isClock(input.time)) throw new BookingError('invalid-argument', 'Horário inválido.');
    if (input.consent !== true) throw new BookingError('invalid-argument', 'É preciso concordar com o uso dos dados para o agendamento.');

    return {
        name,
        phone,
        vehicle,
        plate,
        serviceId,
        date: input.date,
        time: input.time,
        notes: cleanText(input.notes, 300),
        porte: cleanText(input.porte, 40) || 'Pequeno'
    };
}

/** Campo-armadilha preenchido = robô. */
function isBot(input = {}) {
    return Boolean(String(input.website || '').trim());
}

/** Janela de limite: true se ainda pode enviar. */
function withinRateLimit(entry, nowMs, { max, windowMs }) {
    if (!entry || entry.windowStart == null || nowMs - entry.windowStart >= windowMs) return { allowed: true, next: { windowStart: nowMs, count: 1 } };
    if (entry.count >= max) return { allowed: false, next: entry };
    return { allowed: true, next: { windowStart: entry.windowStart, count: entry.count + 1 } };
}

module.exports = {
    BookingError,
    DEFAULT_CONFIG,
    availableSlots,
    brazilNow,
    durationMinutes,
    isBookingOpen,
    isBot,
    isIsoDate,
    listPublicServices,
    minutesToClock,
    normalizeConfig,
    normalizePhone,
    normalizePlate,
    normalizeSlug,
    serviceDuration,
    serviceLabel,
    servicePortes,
    toStoredDate,
    validateBookingInput,
    withinRateLimit
};
