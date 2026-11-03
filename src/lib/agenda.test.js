import test from 'node:test';
import assert from 'node:assert/strict';
import { findConflicts, lengthMinutes, startMinutes, endTime, timeRange, toStoredDate } from './agenda.js';

test('duração aceita HH:mm, horas e minutos, e dia inteiro', () => {
  assert.equal(lengthMinutes({ duracao: '02:00' }), 120);
  assert.equal(lengthMinutes({ duracao: '01:30' }), 90);
  assert.equal(lengthMinutes({ duracao: '1h 30' }), 90);
  assert.equal(lengthMinutes({ duracao: '1h' }), 60);
  assert.equal(lengthMinutes({ duracao: '45 min' }), 45);
  assert.equal(lengthMinutes({ duracao: 'Dia inteiro' }), 480);
});

test('duração vazia usa o padrão de 2h e duração abaixo de 30 min sobe para 30', () => {
  assert.equal(lengthMinutes({ duracao: '' }), 120);
  assert.equal(lengthMinutes({ duracao: undefined }), 120);
  assert.equal(lengthMinutes({ duracao: '00:10' }), 30);
});

test('meia-noite conta como fim do dia e horário final cruza a meia-noite', () => {
  assert.equal(startMinutes({ horario: '00:00' }), 1440);
  assert.equal(endTime({ horario: '23:00', duracao: '02:00' }), '01:00');
});

test('faixa de horário formatada como no One', () => {
  assert.equal(timeRange({ horario: '08:00', duracao: '02:30' }), '08:00 – 10:30');
});

test('encontra conflito na mesma data, com horários sobrepostos', () => {
  const todos = [
    { id: 1, dataStr: '04/11/2026', horario: '09:00', duracao: '02:00', status: 'Agendado' },
    { id: 2, dataStr: '04/11/2026', horario: '13:00', duracao: '01:00', status: 'Agendado' }
  ];
  const alvo = { id: 9, dataStr: '04/11/2026', horario: '10:00', duracao: '01:00' };
  assert.deepEqual(findConflicts(alvo, todos).map((a) => a.id), [1]);
});

test('encostar no fim de um serviço não é conflito', () => {
  const todos = [{ id: 1, dataStr: '04/11/2026', horario: '09:00', duracao: '02:00', status: 'Agendado' }];
  const alvo = { id: 9, dataStr: '04/11/2026', horario: '11:00', duracao: '01:00' };
  assert.deepEqual(findConflicts(alvo, todos), []);
});

test('ignora outra data, cancelados e o próprio registro na edição', () => {
  const todos = [
    { id: 1, dataStr: '05/11/2026', horario: '09:00', duracao: '02:00', status: 'Agendado' },
    { id: 2, dataStr: '04/11/2026', horario: '09:00', duracao: '02:00', status: 'Cancelado' },
    { id: 3, dataStr: '04/11/2026', horario: '09:00', duracao: '02:00', status: 'Agendado' }
  ];
  const alvo = { id: 3, dataStr: '04/11/2026', horario: '09:30', duracao: '01:00' };
  assert.deepEqual(findConflicts(alvo, todos), []);
});

test('conflito só entre o mesmo responsável quando ele é informado', () => {
  const todos = [
    { id: 1, dataStr: '04/11/2026', horario: '09:00', duracao: '02:00', status: 'Agendado', responsavel: 'Ana' },
    { id: 2, dataStr: '04/11/2026', horario: '09:00', duracao: '02:00', status: 'Agendado', responsavel: 'Bruno' }
  ];
  const alvo = { id: 9, dataStr: '04/11/2026', horario: '09:30', duracao: '01:00', responsavel: 'Ana' };
  assert.deepEqual(findConflicts(alvo, todos).map((a) => a.id), [1]);
});

test('converte data do formulário para o formato salvo', () => {
  assert.equal(toStoredDate('2026-11-04'), '04/11/2026');
});
