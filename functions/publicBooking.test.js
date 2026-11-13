/* global require */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
    BookingError,
    availableSlots,
    durationMinutes,
    isBookingOpen,
    isBot,
    listPublicServices,
    serviceLabel,
    normalizeConfig,
    normalizePhone,
    normalizePlate,
    normalizeSlug,
    validateBookingInput,
    withinRateLimit
} = require('./publicBooking');

// 2026-11-16 é segunda-feira. 09:00 em Brasília = 12:00 UTC.
const MONDAY_9AM_BR = Date.parse('2026-11-16T12:00:00Z');
const config = normalizeConfig({ slug: 'Estética do João', workDays: [1, 2, 3, 4, 5], openTime: '08:00', closeTime: '12:00', slotMinutes: 60, capacity: 1, minLeadHours: 2, maxDaysAhead: 10 });

test('config: normaliza slug, aplica limites e recusa expediente invertido', () => {
    assert.equal(config.slug, 'estetica-do-joao');
    assert.equal(config.enabled, false);
    assert.equal(normalizeConfig({ slug: 'abc', capacity: 99, slotMinutes: 7 }).capacity, 10);
    assert.equal(normalizeConfig({ slug: 'abc', slotMinutes: 7 }).slotMinutes, 60);
    assert.throws(() => normalizeConfig({ slug: 'ab' }), BookingError);
    assert.throws(() => normalizeConfig({ slug: 'abc', openTime: '18:00', closeTime: '08:00' }), BookingError);
    assert.throws(() => normalizeConfig({ slug: 'abc', workDays: [] }), BookingError);
    assert.equal(normalizeSlug('  Auto--Detail!! SP '), 'auto-detail-sp');
});

test('link só abre para empresa ativa com agendamento ligado', () => {
    const on = { ...config, enabled: true };
    assert.equal(isBookingOpen({}, on), true);
    assert.equal(isBookingOpen({}, config), false);
    assert.equal(isBookingOpen({ archived: true }, on), false);
    assert.equal(isBookingOpen({ subscriptionStatus: 'Bloqueado' }, on), false);
    assert.equal(isBookingOpen(null, on), false);
});

test('duração: aceita formatos da agenda e do catálogo', () => {
    assert.equal(durationMinutes('3h'), 180);
    assert.equal(durationMinutes('1h 30'), 90);
    assert.equal(durationMinutes('02:00'), 120);
    assert.equal(durationMinutes('15 min'), 30);
    assert.equal(durationMinutes(''), 120);
});

test('serviços públicos: sem itens excluídos e preço só quando permitido', () => {
    const servicos = [
        { id: 1, nome: 'Lavagem', preco: 80, tempoEstimado: '1h', categorias: [{ nome: 'Médio', valor: 60 }, { nome: 'Grande', valor: 100 }], custoInterno: 10 },
        { id: 2, nome: 'Antigo', preco: 50, deletedAt: '2026-01-01' },
        { id: 3, nome: '' }
    ];
    const list = listPublicServices(servicos, true);
    assert.deepEqual(list.map((s) => s.id), ['1']);
    assert.equal(list[0].precoAPartirDe, 60);
    assert.equal(list[0].duracaoMinutos, 60);
    assert.equal(list[0].custoInterno, undefined);
    assert.equal(listPublicServices(servicos, false)[0].precoAPartirDe, null);
    assert.equal(list[0].categoria, 'SERVIÇOS');
    const comPortes = listPublicServices([{ id: 9, nome: 'Vitrificação', categoria: 'Pintura', preco: 900, categorias: [{ nome: 'Médio', valor: 1100 }, { nome: 'Grande / SUV', valor: 1300 }] }], true)[0];
    assert.equal(comPortes.categoria, 'PINTURA');
    assert.deepEqual(comPortes.portes, [{ nome: 'Pequeno', valor: 900 }, { nome: 'Médio', valor: 1100 }, { nome: 'Grande / SUV', valor: 1300 }]);
    assert.deepEqual(listPublicServices([{ id: 9, nome: 'X', preco: 900 }], false)[0].portes, [{ nome: 'Pequeno', valor: null }]);
});

test('horários: respeita antecedência mínima no mesmo dia', () => {
    // Agora 09:00 + 2h de antecedência: primeiro horário 11:00; serviço de 1h termina até 12:00.
    const slots = availableSlots({ config, date: '2026-11-16', durationMinutes: 60, nowMs: MONDAY_9AM_BR });
    assert.deepEqual(slots, ['11:00']);
});

test('horários: bloqueia agenda existente e pedidos pendentes, ignora cancelados', () => {
    const appointments = [
        { dataStr: '17/11/2026', horario: '08:00', duracao: '02:00', status: 'Agendado' },
        { dataStr: '17/11/2026', horario: '11:00', duracao: '01:00', status: 'Cancelado' }
    ];
    const requests = [{ status: 'pendente', date: '2026-11-17', time: '11:00', durationMinutes: 60 }];
    const slots = availableSlots({ config, date: '2026-11-17', durationMinutes: 60, appointments, requests, nowMs: MONDAY_9AM_BR });
    assert.deepEqual(slots, ['10:00']);
});

test('horários: capacidade 2 permite dois atendimentos simultâneos', () => {
    const two = { ...config, capacity: 2 };
    const appointments = [{ dataStr: '17/11/2026', horario: '08:00', duracao: '04:00', status: 'Agendado' }];
    assert.deepEqual(availableSlots({ config: two, date: '2026-11-17', durationMinutes: 60, appointments, nowMs: MONDAY_9AM_BR }), ['08:00', '09:00', '10:00', '11:00']);
    const full = [...appointments, { dataStr: '17/11/2026', horario: '10:00', duracao: '01:00', status: 'Confirmado' }];
    assert.deepEqual(availableSlots({ config: two, date: '2026-11-17', durationMinutes: 60, appointments: full, nowMs: MONDAY_9AM_BR }), ['08:00', '09:00', '11:00']);
});

test('horários: fora dos dias de atendimento, passado e além do limite ficam vazios', () => {
    assert.deepEqual(availableSlots({ config, date: '2026-11-21', durationMinutes: 60, nowMs: MONDAY_9AM_BR }), []); // sábado
    assert.deepEqual(availableSlots({ config, date: '2026-11-13', durationMinutes: 60, nowMs: MONDAY_9AM_BR }), []);
    assert.deepEqual(availableSlots({ config, date: '2026-12-30', durationMinutes: 60, nowMs: MONDAY_9AM_BR }), []);
    assert.deepEqual(availableSlots({ config, date: '2026-02-30', durationMinutes: 60, nowMs: MONDAY_9AM_BR }), []);
});

test('telefone e placa: normaliza formatos brasileiros', () => {
    assert.equal(normalizePhone('(11) 98888-7777'), '5511988887777');
    assert.equal(normalizePhone('+55 11 3333-4444'), '551133334444');
    assert.equal(normalizePhone('12345'), '');
    assert.equal(normalizePlate('abc-1d23'), 'ABC1D23');
    assert.equal(normalizePlate('ABC1234'), 'ABC1234');
    assert.equal(normalizePlate(''), '');
    assert.equal(normalizePlate('12'), null);
});

test('pedido: exige consentimento e campos válidos, descarta campos extras', () => {
    const base = { name: 'Maria <b>Souza</b>', phone: '11988887777', vehicle: 'Onix', plate: 'abc1d23', serviceId: '1', date: '2026-11-17', time: '10:00', consent: true, tenantId: 'outro', status: 'aprovado' };
    const valid = validateBookingInput(base);
    assert.equal(valid.name, 'Maria b Souza /b');
    assert.equal(valid.tenantId, undefined);
    assert.equal(valid.status, undefined);
    assert.equal(valid.porte, 'Pequeno');
    assert.equal(validateBookingInput({ ...base, porte: 'Médio' }).porte, 'Médio');
    assert.throws(() => validateBookingInput({ ...base, consent: false }), BookingError);
    assert.throws(() => validateBookingInput({ ...base, phone: '123' }), BookingError);
    assert.throws(() => validateBookingInput({ ...base, time: '25:00' }), BookingError);
});

test('antispam: campo-armadilha e limite por janela', () => {
    assert.equal(isBot({ website: 'http://spam' }), true);
    assert.equal(isBot({}), false);
    const rule = { max: 2, windowMs: 1000 };
    let r = withinRateLimit(null, 0, rule);
    assert.equal(r.allowed, true);
    r = withinRateLimit(r.next, 100, rule);
    assert.equal(r.allowed, true);
    assert.equal(withinRateLimit(r.next, 200, rule).allowed, false);
    assert.equal(withinRateLimit(r.next, 1500, rule).allowed, true);
});

test('nome do serviço segue o padrão da agenda', () => {
    assert.equal(serviceLabel({ nome: 'Lavagem' }, 'Pequeno'), 'Lavagem');
    assert.equal(serviceLabel({ nome: 'Lavagem' }, 'Médio'), 'Lavagem (Médio)');
});
