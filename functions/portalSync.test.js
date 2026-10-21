const test = require('node:test');
const assert = require('node:assert/strict');
const {
    buildPortalClient,
    buildPortalPayload,
    externalCustomerId,
    isConnectorUrlAllowed,
} = require('./portalSync');

test('gera identificador externo fixo e exclusivo por sistema', () => {
    assert.equal(externalCustomerId('tenant-1'), 'orquestra_auto_detail_tenant-1');
    assert.equal(externalCustomerId('tenant-1', 'cliente-fixo'), 'cliente-fixo');
});

test('aceita HTTPS e HTTP apenas para desenvolvimento local', () => {
    assert.equal(isConnectorUrlAllowed('https://portal.orquestracs.com/api/connectors/snapshot'), true);
    assert.equal(isConnectorUrlAllowed('http://127.0.0.1:3000/api/connectors/snapshot'), true);
    assert.equal(isConnectorUrlAllowed('http://portal.orquestracs.com/api/connectors/snapshot'), false);
    assert.equal(isConnectorUrlAllowed('javascript:alert(1)'), false);
});

test('snapshot preserva cadastro, usuários, pagamento e créditos', () => {
    const generatedAt = '2026-10-20T12:00:00.000Z';
    const client = buildPortalClient({
        tenantId: 'tenant-1',
        generatedAt,
        tenant: { name: 'Cliente Teste', planId: 'premium', monthlyAmount: 299, aiCredits: { balance: 115, bonus: 15, included: 100, used: 2 } },
        users: [{ id: 'user-1', name: 'Responsável', role: 'Proprietario', online: true }],
        payments: [{ id: 'pay-1', amount: 299, paidAt: '2026-10-20', referenceMonth: '2026-10' }],
    });
    const payload = buildPortalPayload([client], generatedAt);

    assert.equal(payload.sourceSystem, 'orquestra_auto_detail');
    assert.equal(payload.contractVersion, 'v1');
    assert.equal(payload.clients[0].externalCustomerId, 'orquestra_auto_detail_tenant-1');
    assert.equal(payload.clients[0].subscription.paidPeriod.id, 'pay-1');
    assert.deepEqual(payload.clients[0].aiCredits, { balance: 115, bonus: 15, included: 100, used: 2, renewalMonth: null, status: null });
    assert.equal(payload.clients[0].onlineUserCount, 1);
});
