const SOURCE_SYSTEM = 'orquestra_auto_detail';
const CONTRACT_VERSION = 'v1';
const DATA_VERSION = 1;

function cleanString(value) {
    const text = String(value ?? '').trim();
    return text || null;
}

function timestampToIso(value) {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    if (typeof value.toMillis === 'function') return new Date(value.toMillis()).toISOString();
    if (typeof value.seconds === 'number') return new Date(value.seconds * 1000).toISOString();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function externalCustomerId(tenantId, currentValue) {
    return cleanString(currentValue) || `${SOURCE_SYSTEM}_${tenantId}`;
}

function isConnectorUrlAllowed(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname));
    } catch {
        return false;
    }
}

function buildPortalClient({ tenantId, tenant = {}, users = [], payments = [], generatedAt }) {
    const externalId = externalCustomerId(tenantId, tenant.externalId || tenant.externalCustomerId);
    const normalizedUsers = users.map((user) => ({
        id: cleanString(user.id),
        name: cleanString(user.name),
        email: cleanString(user.email),
        role: cleanString(user.role),
        userType: ['Proprietario', 'Proprietário', 'Financeiro'].includes(user.role) ? 'admin' : 'end_user',
        isOwner: ['Proprietario', 'Proprietário'].includes(user.role),
        lastAccessAt: timestampToIso(user.lastAccessAt),
        lastActivityAt: timestampToIso(user.lastSeenAt || user.lastActivityAt),
        device: cleanString(user.lastDevice || user.device),
        online: Boolean(user.online),
    }));
    const latestPayment = [...payments].sort((left, right) => {
        const leftDate = timestampToIso(left.paidAt || left.createdAt) || '';
        const rightDate = timestampToIso(right.paidAt || right.createdAt) || '';
        return rightDate.localeCompare(leftDate);
    })[0] || null;
    const responsible = normalizedUsers.find((user) => user.isOwner) || normalizedUsers.find((user) => user.userType === 'admin');

    return {
        externalCustomerId: externalId,
        id: tenantId,
        dataVersion: Math.max(1, Number(tenant.dataVersion) || DATA_VERSION),
        client: {
            id: tenantId,
            externalCustomerId: externalId,
            name: cleanString(tenant.name) || 'Empresa',
            legalName: cleanString(tenant.legalName),
            tradeName: cleanString(tenant.tradeName),
            email: cleanString(tenant.accessEmail),
            phone: cleanString(tenant.phone),
            document: { type: cleanString(tenant.documentType), number: cleanString(tenant.documentNumber) },
            address: {
                street: cleanString(tenant.addressStreet),
                number: cleanString(tenant.addressNumber),
                complement: cleanString(tenant.addressComplement),
                neighborhood: cleanString(tenant.addressDistrict),
                city: cleanString(tenant.addressCity),
                state: cleanString(tenant.addressState),
                cep: cleanString(tenant.postalCode),
                mapUrl: cleanString(tenant.googleMapsUrl),
            },
            archived: Boolean(tenant.archived),
        },
        responsible: {
            name: responsible?.name || cleanString(tenant.responsibleName),
            email: responsible?.email || cleanString(tenant.accessEmail),
            phone: cleanString(tenant.phone),
        },
        subscription: {
            planId: cleanString(tenant.planId),
            monthlyFee: Number(tenant.monthlyAmount) || 0,
            billingDay: Number(tenant.billingDay) || null,
            graceDays: Math.max(0, Number(tenant.toleranceDays) || 0),
            startDate: cleanString(tenant.startDate),
            renewalDate: cleanString(tenant.nextBillingDate),
            paymentMethod: cleanString(tenant.paymentMethod),
            billingStatus: cleanString(tenant.billingStatus || tenant.subscriptionStatus),
            subscriptionStatus: cleanString(tenant.subscriptionStatus),
            administrativeUserLimit: Math.max(0, Number(tenant.adminUserLimit) || 0),
            collaboratorLimit: Math.max(0, Number(tenant.collaboratorLimit) || 0),
            paidPeriod: latestPayment ? {
                id: cleanString(latestPayment.id),
                referenceMonth: cleanString(latestPayment.referenceMonth),
                amount: Number(latestPayment.amount) || 0,
                paidAt: cleanString(latestPayment.paidAt),
                nextBillingDate: cleanString(latestPayment.nextBillingDate),
                method: cleanString(latestPayment.method),
            } : null,
        },
        aiCredits: {
            balance: Math.max(0, Number(tenant.aiCredits?.balance) || 0),
            bonus: Math.max(0, Number(tenant.aiCredits?.bonus) || 0),
            included: Math.max(0, Number(tenant.aiCredits?.included ?? tenant.aiCreditLimit) || 0),
            used: Math.max(0, Number(tenant.aiCredits?.used) || 0),
            renewalMonth: cleanString(tenant.aiCredits?.renewalMonth),
            status: cleanString(tenant.aiCredits?.status),
        },
        users: normalizedUsers,
        onlineUserCount: normalizedUsers.filter((user) => user.online).length,
        lastActivityAt: normalizedUsers.map((user) => user.lastActivityAt).filter(Boolean).sort().at(-1) || timestampToIso(tenant.lastSeenAt),
        updatedAt: timestampToIso(tenant.updatedAt) || generatedAt,
    };
}

function buildPortalPayload(clients, generatedAt = new Date().toISOString()) {
    return {
        contractVersion: CONTRACT_VERSION,
        dataVersion: DATA_VERSION,
        sourceSystem: SOURCE_SYSTEM,
        generatedAt,
        updatedAt: generatedAt,
        clients,
    };
}

module.exports = {
    CONTRACT_VERSION,
    DATA_VERSION,
    SOURCE_SYSTEM,
    buildPortalClient,
    buildPortalPayload,
    externalCustomerId,
    isConnectorUrlAllowed,
    timestampToIso,
};
