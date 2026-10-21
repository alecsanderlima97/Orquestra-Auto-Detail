const test = require('node:test');
const assert = require('node:assert/strict');
const {
    addBonus, isPaidStatus, monthKey, normalizeWallet, packageCredits, refundCredit, reserveCredit,
    signPayload, validateAdjustment, validSignature
} = require('./aiCredits');

test('renovação mensal preserva bônus e zera consumo', () => {
    const wallet = normalizeWallet({ balance: 2, bonus: 30, included: 15, renewalMonth: '2026-09', used: 13 }, 15, '2026-10');
    assert.deepEqual({ balance: wallet.balance, bonus: wallet.bonus, included: wallet.included, used: wallet.used }, { balance: 45, bonus: 30, included: 15, used: 0 });
});

test('mês atual preserva saldo existente', () => {
    const wallet = normalizeWallet({ balance: 8, bonus: 3, renewalMonth: '2026-10', used: 7 }, 15, '2026-10');
    assert.equal(wallet.balance, 8);
    assert.equal(wallet.used, 7);
});

test('renovação mensal usa o fuso de São Paulo', () => {
    assert.equal(monthKey(new Date('2026-11-01T01:30:00.000Z')), '2026-10');
});

test('reserva e estorno alteram exatamente um crédito', () => {
    const initial = normalizeWallet({ balance: 4, bonus: 1, renewalMonth: '2026-10', used: 2 }, 15, '2026-10');
    const reserved = reserveCredit(initial);
    assert.equal(reserved.balance, 3);
    assert.equal(reserved.used, 3);
    assert.deepEqual(refundCredit(reserved), initial);
});

test('cliente sem saldo é bloqueado', () => {
    assert.throws(() => reserveCredit({ balance: 0, used: 15 }), /AI_CREDITS_EMPTY/);
});

test('ajuste manual exige inteiro e motivo válido', () => {
    assert.deepEqual(validateAdjustment(300, 'Compra confirmada manualmente'), { credits: 300, reason: 'Compra confirmada manualmente' });
    assert.throws(() => validateAdjustment(1.5, 'Motivo válido'), /INVALID_CREDIT_AMOUNT/);
    assert.throws(() => validateAdjustment(10, 'abc'), /INVALID_CREDIT_REASON/);
});

test('bônus soma saldo sem substituir créditos mensais', () => {
    const wallet = addBonus({ balance: 15, bonus: 0, included: 15, used: 0 }, 100);
    assert.deepEqual(wallet, { balance: 115, bonus: 100, included: 15, used: 0, status: 'active' });
    assert.throws(() => addBonus(wallet, 1.5), /INVALID_CREDIT_AMOUNT/);
});

test('webhook aceita somente pagamento confirmado', () => {
    assert.equal(isPaidStatus('PAID'), true);
    assert.equal(isPaidStatus('pending'), false);
});

test('pacotes aceitam apenas ids conhecidos', () => {
    assert.equal(packageCredits('ai-1000'), 1000);
    assert.throws(() => packageCredits('ai-999'), /INVALID_PACKAGE/);
});

test('assinatura do Portal rejeita payload manipulado', () => {
    const secret = 'segredo-de-teste';
    const raw = Buffer.from('{"eventId":"evt-1"}');
    const signature = signPayload(raw, secret);
    assert.equal(validSignature(raw, signature, secret), true);
    assert.equal(validSignature(Buffer.from('{"eventId":"evt-2"}'), signature, secret), false);
});
