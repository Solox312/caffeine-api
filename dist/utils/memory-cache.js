"use strict";
/**
 * In-memory TTL cache for fetch results. Works without Redis.
 * Keys expire after ttlSeconds. Values are JSON-serialized.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const store = new Map();
function get(key) {
    const entry = store.get(key);
    if (!entry)
        return null;
    if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
    }
    try {
        return JSON.parse(entry.value);
    }
    catch (_a) {
        return null;
    }
}
function set(key, value, ttlSeconds) {
    store.set(key, {
        value: JSON.stringify(value),
        expiresAt: Date.now() + ttlSeconds * 1000,
    });
}
/** Get cached value or run fetcher, then cache and return. TTL in seconds. */
function fetch(key, fetcher, ttlSeconds) {
    return __awaiter(this, void 0, void 0, function* () {
        const existing = get(key);
        if (existing !== null)
            return existing;
        const value = yield fetcher();
        set(key, value, ttlSeconds);
        return value;
    });
}
exports.default = { get, set, fetch };
