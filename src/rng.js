// src/rng.js

/**
 * Secure random number generator using the Mulberry32 algorithm.
 * @returns {number} A random number between 0 and 1.
 */
function mulberry32(seed) {
    return function() {
        seed |= 0; // Convert to 32-bit integer
        seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t ^ (Math.imul(t ^ (t >>> 7), 61))) | 0;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Game utility to pick a weighted symbol from a given set of symbols.
 * @param {Object} symbols - An object where keys are symbols and values are their weights.
 * @returns {string} The picked symbol.
 */
function pickWeightedSymbol(symbols) {
    const totalWeight = Object.values(symbols).reduce((acc, weight) => acc + weight, 0);
    let randomNum = Math.random() * totalWeight;
    for (const [symbol, weight] of Object.entries(symbols)) {
        if (randomNum < weight) {
            return symbol;
        }
        randomNum -= weight;
    }
    return null;
}

/**
 * Shuffle an array using Fisher-Yates shuffle.
 * @param {Array} array - The array to shuffle.
 * @returns {Array} The shuffled array.
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]]; // Swap elements
    }
    return array;
}

// Exporting the functions
module.exports = { mulberry32, pickWeightedSymbol, shuffleArray };