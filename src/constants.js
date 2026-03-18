// Game Configuration Constants

const STORAGE_KEYS = {
    USER_DATA: 'user_data',
    GAME_SETTINGS: 'game_settings',
};

const USER_LIMITS = {
    MAX_USERS: 1000,
    MIN_USERS: 2,
};

const BET_LIMITS = {
    MIN_BET: 1,
    MAX_BET: 100,
};

const GAME_CONFIGS = {
    CLASSIC_SLOTS: {
        REELS: 3,
        LINES: 1,
        JACKPOT: 1000,
    },
    LINES_SLOTS: {
        REELS: 5,
        LINES: 20,
        JACKPOT: 5000,
    },
    MINES: {
        MIN_MINES: 1,
        MAX_MINES: 20,
    },
    PLINKO: {
        PINS: 16,
    },
    DAILY_BONUS: {
        AMOUNT: 100,
        CLAIM_LIMIT: 1,
    },
};

const CHAT_CONFIG = {
    MESSAGE_LIMIT: 250,
    USERNAME_LIMIT: 30,
};

const ERROR_MESSAGES = {
    USER_NOT_FOUND: 'User not found.',
    INSUFFICIENT_FUNDS: 'Insufficient funds.',
    INVALID_BET: 'Invalid bet amount.',
};

module.exports = { STORAGE_KEYS, USER_LIMITS, BET_LIMITS, GAME_CONFIGS, CHAT_CONFIG, ERROR_MESSAGES };