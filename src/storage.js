// src/storage.js

/**
 * Load state from localStorage
 * @returns {Object|null} State object or null if not found
 */
function loadState() {
    try {
        const serializedState = localStorage.getItem('state');
        return serializedState === null ? null : JSON.parse(serializedState);
    } catch (err) {
        return null;
    }
}

/**
 * Save state to localStorage
 * @param {Object} state - The state to save
 */
function saveState(state) {
    try {
        const serializedState = JSON.stringify(state);
        localStorage.setItem('state', serializedState);
    } catch (err) {
        console.error('Could not save state', err);
    }
}

/**
 * Load chat messages from localStorage
 * @returns {Array|null} Chat messages array or null if not found
 */
function loadChat() {
    try {
        const serializedChat = localStorage.getItem('chat');
        return serializedChat === null ? null : JSON.parse(serializedChat);
    } catch (err) {
        return null;
    }
}

/**
 * Save chat messages to localStorage
 * @param {Array} chat - The chat messages to save
 */
function saveChat(chat) {
    try {
        const serializedChat = JSON.stringify(chat);
        localStorage.setItem('chat', serializedChat);
    } catch (err) {
        console.error('Could not save chat', err);
    }
}

// Exporting functions for use in other modules
export { loadState, saveState, loadChat, saveChat };