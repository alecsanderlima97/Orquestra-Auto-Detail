const crypto = require('crypto');

const AI_CREDIT_PACKAGES = Object.freeze({
    'ai-100': 100,
    'ai-300': 300,
    'ai-1000': 1000
});

const PLAN_AI_CREDITS = Object.freeze({
    starter: 0,
    medium: 15,
    premium: 100
});

function monthKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit'
    }).formatToParts(date);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    return `${year}-${month}`;
}

function planIncludedCredits(planId, override) {
    if (Number.isFinite(Number(override)) && Number(override) >= 0) return Math.floor(Number(override));
    return PLAN_AI_CREDITS[planId] || 0;
}

function normalizeWallet(wallet = {}, included = 0, renewalMonth = monthKey()) {
    const safeIncluded = Math.max(0, Math.floor(Number(included) || 0));
    const bonus = Math.max(0, Math.floor(Number(wallet.bonus) || 0));
    const isRenewal = wallet.renewalMonth !== renewalMonth;
    if (isRenewal) {
        return {
            balance: safeIncluded + bonus,
            bonus,
            included: safeIncluded,
            renewalMonth,
            status: safeIncluded + bonus > 0 ? 'active' : 'empty',
            used: 0,
            lastAdjustmentAt: wallet.lastAdjustmentAt || null,
            lastAdjustmentBy: wallet.lastAdjustmentBy || null
        };
    }
    const balance = Math.max(0, Math.floor(Number(wallet.balance) || 0));
    return {
        ...wallet,
        balance,
        bonus,
        included: safeIncluded,
        renewalMonth,
        status: balance > 0 ? 'active' : 'empty',
        used: Math.max(0, Math.floor(Number(wallet.used) || 0))
    };
}

function reserveCredit(wallet) {
    if (!wallet || wallet.balance < 1) throw new Error('AI_CREDITS_EMPTY');
    return { ...wallet, balance: wallet.balance - 1, status: wallet.balance - 1 > 0 ? 'active' : 'empty', used: wallet.used + 1 };
}

function refundCredit(wallet) {
    return { ...wallet, balance: wallet.balance + 1, status: 'active', used: Math.max(0, wallet.used - 1) };
}

function addBonus(wallet, credits) {
    const amount = Number(credits);
    if (!Number.isInteger(amount) || amount < 1 || amount > 100000) throw new Error('INVALID_CREDIT_AMOUNT');
    return { ...wallet, balance: wallet.balance + amount, bonus: wallet.bonus + amount, status: 'active' };
}

function isPaidStatus(status) {
    return ['approved', 'paid', 'succeeded'].includes(String(status || '').toLowerCase());
}

function validateAdjustment(credits, reason) {
    const amount = Number(credits);
    const safeReason = String(reason || '').trim();
    if (!Number.isInteger(amount) || amount < 1 || amount > 100000) throw new Error('INVALID_CREDIT_AMOUNT');
    if (safeReason.length < 5 || safeReason.length > 300) throw new Error('INVALID_CREDIT_REASON');
    return { credits: amount, reason: safeReason };
}

function packageCredits(packageId) {
    const credits = AI_CREDIT_PACKAGES[packageId];
    if (!credits) throw new Error('INVALID_PACKAGE');
    return credits;
}

function signPayload(rawBody, secret) {
    return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

function validSignature(rawBody, signature, secret) {
    if (!secret || !signature) return false;
    const expected = signPayload(rawBody, secret);
    const received = String(signature).replace(/^sha256=/i, '').toLowerCase();
    if (received.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

module.exports = {
    AI_CREDIT_PACKAGES,
    PLAN_AI_CREDITS,
    addBonus,
    isPaidStatus,
    monthKey,
    normalizeWallet,
    packageCredits,
    planIncludedCredits,
    refundCredit,
    reserveCredit,
    signPayload,
    validateAdjustment,
    validSignature
};
