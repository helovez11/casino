// XSS Protection Functions

/**
 * Escape HTML special characters
 * @param {string} unsafe
 * @returns {string}
 */
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Sanitize user input to prevent XSS
 * @param {string} input
 * @returns {string}
 */
function sanitizeInput(input) {
    return escapeHtml(input);
}

/**
 * Sanitize a username
 * @param {string} username
 * @returns {string}
 */
function sanitizeUsername(username) {
    return escapeHtml(username.trim());
}

/**
 * Sanitize a message
 * @param {string} message
 * @returns {string}
 */
function sanitizeMessage(message) {
    return escapeHtml(message);
}

/**
 * Sanitize a JSON object
 * @param {Object} json
 * @returns {Object}
 */
function sanitizeJSON(json) {
    return JSON.parse(JSON.stringify(json, (key, value) => typeof value === 'string' ? escapeHtml(value) : value));
}

/**
 * Sanitize betting data
 * @param {number} bet
 * @returns {number}
 */
function sanitizeBet(bet) {
    return isNaN(bet) ? 0 : Math.max(0, parseFloat(bet));
}