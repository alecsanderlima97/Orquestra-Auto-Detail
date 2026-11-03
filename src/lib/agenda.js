// Lógica de agenda (portada do Orquestra One, src/lib/agenda.ts).
// Mantém o mesmo critério: conflito por data + responsável, duração mínima de 30 min,
// meia-noite contando como fim do dia e duração aceita em "HH:mm", "1h 30", "45 min" e "Dia inteiro".

export const AGENDA_MIN_SLOT = 30;
export const DEFAULT_DURATION_MINUTES = 120; // "02:00", padrão histórico do sistema
const EXCLUDED_STATUSES = ['Cancelado'];

/** Minutos desde 00:00. A meia-noite (00:00) conta como 24h, fim do dia da agenda. */
export function startMinutes(appointment) {
  const [hours = 0, minutes = 0] = String(appointment?.horario || '').split(':').map(Number);
  return (hours === 0 ? 24 : hours) * 60 + minutes;
}

/** Duração em minutos. Aceita "HH:mm" (formato do formulário), "1h", "1h 30", "45 min" e "Dia inteiro". */
export function lengthMinutes(appointment) {
  const raw = String(appointment?.duracao ?? appointment?.duration ?? '').trim().toLowerCase();
  if (!raw) return DEFAULT_DURATION_MINUTES;
  if (raw.includes('dia')) return 8 * 60;

  const clock = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (clock) return Math.max(AGENDA_MIN_SLOT, Number(clock[1]) * 60 + Number(clock[2]));

  const hours = raw.match(/(\d+)\s*h(?:\s*(\d+))?/);
  const minutesOnly = raw.match(/(\d+)\s*min/);
  if (hours || minutesOnly) {
    const total = Number(hours?.[1] ?? 0) * 60 + Number(hours?.[2] ?? minutesOnly?.[1] ?? 0);
    return Math.max(AGENDA_MIN_SLOT, total);
  }
  return DEFAULT_DURATION_MINUTES;
}

/** Converte minutos desde 00:00 em "HH:mm" (passando de 24h volta para 00:xx). */
export function formatClock(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Horário em que o compromisso termina. */
export function endTime(appointment) {
  return formatClock(startMinutes(appointment) + lengthMinutes(appointment));
}

/** "08:00 – 10:30" */
export function timeRange(appointment) {
  return `${String(appointment?.horario || '').padStart(5, '0')} – ${endTime(appointment)}`;
}

/**
 * Compromissos que se sobrepõem ao alvo: mesma data, mesmo responsável (vazio = equipe única),
 * horários que se cruzam e status não cancelado. O próprio registro (mesmo id) é ignorado.
 */
export function findConflicts(target, all = []) {
  const start = startMinutes(target);
  const end = start + lengthMinutes(target);
  const day = target?.dataStr ?? target?.date;
  const owner = target?.responsavel || '';

  return all.filter((other) => {
    if (!other || (target.id != null && String(other.id) === String(target.id))) return false;
    if (EXCLUDED_STATUSES.includes(other.status)) return false;
    if ((other.dataStr ?? other.date) !== day) return false;
    if ((other.responsavel || '') !== owner) return false;
    const otherStart = startMinutes(other);
    return otherStart < end && start < otherStart + lengthMinutes(other);
  });
}

/** Data de hoje no fuso do navegador, em AAAA-MM-DD. */
export function todayDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Converte "AAAA-MM-DD" (input type=date) em "DD/MM/AAAA" (formato salvo nos agendamentos). */
export function toStoredDate(isoDate) {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString('pt-BR');
}
