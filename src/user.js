'use strict';

/**
 * Creates a default user object.
 *
 * @returns {Object} Default user object.
 */
function createDefaultUser() {
    return {
        id: null,
        name: '',
        balance: 0,
        payments: [],
        stats: {},
        lastClaimedBonus: null
    };
}

/**
 * Normalizes user data.
 *
 * @param {Object} user - User object to normalize.
 * @returns {Object} Normalized user object.
 */
function normalizeUser(user) {
    return {
        id: user.id || null,
        name: user.name || '',
        balance: parseFloat(user.balance) || 0,
        payments: user.payments || [],
        stats: user.stats || {},
        lastClaimedBonus: user.lastClaimedBonus || null
    };
}

/**
 * Updates the user's balance.
 *
 * @param {Object} user - User object.
 * @param {number} amount - Amount to update the balance by.
 */
function updateBalance(user, amount) {
    if (user && typeof amount === 'number') {
        user.balance += amount;
    }
}

/**
 * Adds a payment to the user.
 *
 * @param {Object} user - User object.
 * @param {Object} payment - Payment object.
 */
function addPayment(user, payment) {
    if (user && payment) {
        user.payments.push(payment);
    }
}

/**
 * Updates user statistics.
 *
 * @param {Object} user - User object.
 * @param {string} statName - Name of the stat to update.
 * @param {number} value - Value to set the stat to.
 */
function updateStat(user, statName, value) {
    if (user && statName) {
        user.stats[statName] = value;
    }
}

/**
 * Returns the milliseconds until the daily bonus can be claimed again.
 *
 * @param {Object} user - User object.
 * @returns {number} Milliseconds until daily bonus.
 */
function msUntilDailyBonus(user) {
    if (user && user.lastClaimedBonus) {
        const now = new Date();
        const nextBonusTime = new Date(user.lastClaimedBonus);
        nextBonusTime.setDate(nextBonusTime.getDate() + 1);
        return nextBonusTime - now;
    }
    return 0;
}

/**
 * Claims the daily bonus for the user.
 *
 * @param {Object} user - User object.
 */
function claimDailyBonus(user) {
    if (user) {
        user.lastClaimedBonus = new Date();
    }
}

module.exports = {
    createDefaultUser,
    normalizeUser,
    updateBalance,
    addPayment,
    updateStat,
    msUntilDailyBonus,
    claimDailyBonus
};