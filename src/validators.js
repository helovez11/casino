'use strict';

/**
 * Validates a username.
 * @param {string} username - The username to validate.
 * @returns {boolean} - Returns true if valid, false otherwise.
 */
function validateUsername(username) {
    const regex = /^[a-zA-Z0-9_]{3,20}$/;
    return typeof username === 'string' && regex.test(username);
}

/**
 * Validates a password.
 * @param {string} password - The password to validate.
 * @returns {boolean} - Returns true if valid, false otherwise.
 */
function validatePassword(password) {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return typeof password === 'string' && regex.test(password);
}

/**
 * Validates a bet amount.
 * @param {number} bet - The bet amount to validate.
 * @param {number} balance - The balance to compare against.
 * @returns {boolean} - Returns true if valid, false otherwise.
 */
function validateBet(bet, balance) {
    return typeof bet === 'number' && bet > 0 && bet <= balance;
}

/**
 * Validates a balance amount.
 * @param {number} balance - The balance to validate.
 * @returns {boolean} - Returns true if valid, false otherwise.
 */
function validateBalance(balance) {
    return typeof balance === 'number' && balance >= 0;
}

/**
 * Validates a message.
 * @param {string} message - The message to validate.
 * @returns {boolean} - Returns true if valid, false otherwise.
 */
function validateMessage(message) {
    return typeof message === 'string' && message.length <= 256;
}

/**
 * Validates game parameters.
 * @param {object} params - The game parameters to validate.
 * @returns {boolean} - Returns true if all required parameters are valid.
 */
function validateGameParameters(params) {
    // Implement game-specific validations here
    return true;
}

module.exports = { validateUsername, validatePassword, validateBet, validateBalance, validateMessage, validateGameParameters };