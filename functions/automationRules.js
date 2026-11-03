/* global require, module */
// Regras puras das automações de WhatsApp. Sem acesso ao Firebase, para poderem ser testadas.

const TERMINAL_STATUSES = ['Cancelado', 'Concluído'];

/**
 * Agendamentos que devem receber lembrete na data informada (formato DD/MM/AAAA).
 * `alreadySentIds` contém os ids de agendamentos que já receberam lembrete.
 */
function selectReminderTargets(agendamentos, dataStr, alreadySentIds = new Set()) {
    return (agendamentos || []).filter((a) => {
        if (!a || a.dataStr !== dataStr) return false;
        if (TERMINAL_STATUSES.includes(a.status)) return false;
        if (!a.telefone) return false;
        if (a.lembreteAutomotivoEnviado) return false;
        return !alreadySentIds.has(String(a.id));
    });
}

/**
 * Clientes que fazem aniversário no dia `mmdd` (formato MM-DD) e ainda não
 * receberam a mensagem neste `year`. `alreadySentKeys` usa a chave `${id}-${year}`.
 */
function selectBirthdayTargets(clientes, mmdd, year, alreadySentKeys = new Set()) {
    return (clientes || []).filter((c) => {
        if (!c || !c.dataAniversario) return false;
        if (!String(c.dataAniversario).endsWith(mmdd)) return false;
        if (!c.telefone) return false;
        return !alreadySentKeys.has(`${c.id}-${year}`);
    });
}

/** Tenant arquivado não deve receber nenhuma automação. */
function isTenantActiveForAutomation(tenant) {
    return Boolean(tenant) && !tenant.archivedAt && tenant.archived !== true;
}

module.exports = {
    TERMINAL_STATUSES,
    isTenantActiveForAutomation,
    selectBirthdayTargets,
    selectReminderTargets
};
