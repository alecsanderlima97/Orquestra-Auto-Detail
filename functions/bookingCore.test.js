/* global require */
// Testa o núcleo com um Firestore em memória (sem rede, sem emulador).
const test = require('node:test');
const assert = require('node:assert/strict');
const { BookingError, createBookingCore } = require('./bookingCore');

function fakeFirestore(seed = {}) {
    const store = new Map(Object.entries(seed));
    let auto = 0;
    const snap = (path) => {
        const data = store.get(path);
        return { id: path.split('/').pop(), exists: data !== undefined, data: () => data && { ...data }, get: (k) => data?.[k] };
    };
    const docRef = (path) => ({
        path,
        id: path.split('/').pop(),
        get: async () => snap(path),
        set: async (data) => { store.set(path, { ...data }); },
        collection: (name) => colRef(`${path}/${name}`)
    });
    const colRef = (path) => ({
        doc: (id) => docRef(`${path}/${id ?? `auto${++auto}`}`),
        add: async (data) => { const ref = docRef(`${path}/auto${++auto}`); await ref.set(data); return ref; },
        where: (field, _op, value) => ({
            get: async () => ({
                docs: [...store.keys()]
                    .filter((k) => k.startsWith(`${path}/`) && k.split('/').length === path.split('/').length + 1 && store.get(k)[field] === value)
                    .map(snap)
            })
        })
    });
    return {
        store,
        collection: colRef,
        runTransaction: async (fn) => {
            const writes = [];
            await fn({
                get: (ref) => ref.get(),
                set: (ref, data) => writes.push(() => store.set(ref.path, { ...data })),
                delete: (ref) => writes.push(() => store.delete(ref.path))
            });
            writes.forEach((w) => w());
        }
    };
}

const FieldValue = { serverTimestamp: () => 'SERVER_TIME' };
const Timestamp = { fromMillis: (ms) => ({ ms }) };

function setup(extra = {}) {
    const db = fakeFirestore({
        'tenants/t1': { name: 'Estética Teste' },
        'tenants/t1/users/owner': { role: 'Proprietario' },
        'tenants/t1/users/fin': { role: 'Financeiro' },
        'tenants/t1/appData/main': {
            servicos: [{ id: 1, nome: 'Lavagem', categoria: 'LAVAGEM', preco: 80, tempoEstimado: '1h', categorias: [{ nome: 'Médio', valor: 100 }] }],
            agendamentos: []
        },
        ...extra
    });
    return { db, core: createBookingCore({ db, FieldValue, Timestamp }) };
}

const config = { enabled: true, slug: 'estetica-teste', workDays: [0, 1, 2, 3, 4, 5, 6], openTime: '08:00', closeTime: '18:00', slotMinutes: 60, capacity: 1, minLeadHours: 0, maxDaysAhead: 60, showPrices: true };
const future = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);

test('configuração: só proprietário salva; cria o link e registra auditoria', async () => {
    const { db, core } = setup();
    await assert.rejects(core.saveConfig({ tenantId: 't1', config }, null), (e) => e.code === 'unauthenticated');
    await assert.rejects(core.saveConfig({ tenantId: 't1', config }, { uid: 'fin' }), (e) => e.code === 'permission-denied');
    const result = await core.saveConfig({ tenantId: 't1', config }, { uid: 'owner', email: 'dono@x.com' });
    assert.equal(result.config.slug, 'estetica-teste');
    assert.equal(db.store.get('bookingSlugs/estetica-teste').tenantId, 't1');
    assert.ok([...db.store.keys()].some((k) => k.startsWith('tenants/t1/audit/')));
});

test('configuração: endereço de outra empresa é recusado', async () => {
    const { core } = setup({ 'bookingSlugs/estetica-teste': { tenantId: 'outra' } });
    await assert.rejects(core.saveConfig({ tenantId: 't1', config }, { uid: 'owner' }), (e) => e.code === 'already-exists');
});

test('fluxo público: catálogo, horários, pedido com preço do servidor e horário bloqueado depois', async () => {
    const { db, core } = setup();
    await core.saveConfig({ tenantId: 't1', config }, { uid: 'owner' });

    const info = await core.getInfo({ slug: 'estetica-teste' });
    assert.equal(info.companyName, 'Estética Teste');
    assert.deepEqual(info.services[0].portes.map((p) => p.nome), ['Pequeno', 'Médio']);

    const { slots } = await core.getAvailability({ slug: 'estetica-teste', serviceId: '1', date: future });
    assert.ok(slots.includes('09:00'));

    const result = await core.createRequest({
        slug: 'estetica-teste', serviceId: '1', porte: 'Médio', date: future, time: '09:00',
        name: 'Maria Souza', phone: '11988887777', vehicle: 'Onix', consent: true, price: 1
    }, { ip: '1.2.3.4' });
    assert.ok(result.protocol);
    const saved = db.store.get(`tenants/t1/bookingRequests/${result.requestId}`);
    assert.equal(saved.status, 'pendente');
    assert.equal(saved.price, 100);
    assert.equal(saved.serviceName, 'Lavagem (Médio)');

    const after = await core.getAvailability({ slug: 'estetica-teste', serviceId: '1', date: future });
    assert.ok(!after.slots.includes('09:00'));
    await assert.rejects(core.createRequest({
        slug: 'estetica-teste', serviceId: '1', date: future, time: '09:00',
        name: 'Outra Pessoa', phone: '11977776666', vehicle: 'Gol', consent: true
    }, { ip: '5.6.7.8' }), (e) => e.code === 'failed-precondition');
});

test('fluxo público: link desligado ou inexistente fica indisponível', async () => {
    const { core } = setup();
    await assert.rejects(core.getInfo({ slug: 'nao-existe' }), (e) => e instanceof BookingError && e.code === 'not-found');
    await core.saveConfig({ tenantId: 't1', config: { ...config, enabled: false } }, { uid: 'owner' });
    await assert.rejects(core.getInfo({ slug: 'estetica-teste' }), (e) => e.code === 'not-found');
});

test('antispam: robô não grava e IP passa do limite', async () => {
    const { db, core } = setup();
    await core.saveConfig({ tenantId: 't1', config: { ...config, capacity: 10 } }, { uid: 'owner' });
    const before = db.store.size;
    await core.createRequest({ website: 'spam' }, { ip: '9.9.9.9' });
    assert.equal(db.store.size, before);

    const base = { slug: 'estetica-teste', serviceId: '1', date: future, time: '10:00', vehicle: 'Onix', consent: true };
    for (let i = 0; i < 5; i += 1) {
        await core.createRequest({ ...base, name: `Cliente ${i}`, phone: `1198888000${i}` }, { ip: '9.9.9.9' });
    }
    await assert.rejects(core.createRequest({ ...base, name: 'Cliente 6', phone: '11988880009' }, { ip: '9.9.9.9' }), (e) => e.code === 'resource-exhausted');
});
