/* global require, module */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
    isTenantActiveForAutomation,
    selectBirthdayTargets,
    selectReminderTargets
} = require('./automationRules');

test('lembrete: seleciona só agendamentos de amanhã, ativos, com telefone e ainda não enviados', () => {
    const agendamentos = [
        { id: 1, dataStr: '04/11/2026', status: 'Agendado', telefone: '5511999999999' },
        { id: 2, dataStr: '04/11/2026', status: 'Cancelado', telefone: '5511999999999' },
        { id: 3, dataStr: '04/11/2026', status: 'Concluído', telefone: '5511999999999' },
        { id: 4, dataStr: '04/11/2026', status: 'Confirmado', telefone: '' },
        { id: 5, dataStr: '04/11/2026', status: 'Agendado', telefone: '5511888888888', lembreteAutomotivoEnviado: true },
        { id: 6, dataStr: '05/11/2026', status: 'Agendado', telefone: '5511999999999' },
        { id: 7, dataStr: '04/11/2026', status: 'Confirmado', telefone: '5511777777777' }
    ];
    const ids = selectReminderTargets(agendamentos, '04/11/2026', new Set(['7'])).map((a) => a.id);
    assert.deepEqual(ids, [1]);
});

test('lembrete: ignora registros nulos e lista vazia', () => {
    assert.deepEqual(selectReminderTargets([null, undefined], '04/11/2026'), []);
    assert.deepEqual(selectReminderTargets(undefined, '04/11/2026'), []);
});

test('aniversário: seleciona apenas quem faz aniversário hoje, com telefone e sem envio no ano', () => {
    const clientes = [
        { id: 'a', dataAniversario: '1990-11-03', telefone: '5511999999999' },
        { id: 'b', dataAniversario: '1990-11-04', telefone: '5511999999999' },
        { id: 'c', dataAniversario: '1990-11-03', telefone: '' },
        { id: 'd', dataAniversario: '1985-11-03', telefone: '5511888888888' },
        { id: 'e', dataAniversario: '', telefone: '5511888888888' }
    ];
    const sent = new Set(['d-2026']);
    const ids = selectBirthdayTargets(clientes, '11-03', 2026, sent).map((c) => c.id);
    assert.deepEqual(ids, ['a']);
});

test('aniversário: não repete mensagem no mesmo ano, mas envia no ano seguinte', () => {
    const clientes = [{ id: 'x', dataAniversario: '1990-11-03', telefone: '5511999999999' }];
    assert.deepEqual(selectBirthdayTargets(clientes, '11-03', 2026, new Set(['x-2026'])), []);
    assert.equal(selectBirthdayTargets(clientes, '11-03', 2027, new Set(['x-2026'])).length, 1);
});

test('tenant arquivado não recebe automações', () => {
    assert.equal(isTenantActiveForAutomation({ archivedAt: new Date() }), false);
    assert.equal(isTenantActiveForAutomation({ archived: true }), false);
    assert.equal(isTenantActiveForAutomation(null), false);
    assert.equal(isTenantActiveForAutomation({ archived: false }), true);
});
