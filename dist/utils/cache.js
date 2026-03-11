"use strict";
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
/* eslint-disable import/no-anonymous-default-export */
/*
TLDR; " Expires " is seconds based. for example 60*60 would = 3600 (an hour)
*/
const fetch = (redis, key, fetcher, expires) => __awaiter(void 0, void 0, void 0, function* () {
    const existing = yield get(redis, key);
    if (existing !== null)
        return existing;
    return set(redis, key, fetcher, expires);
});
const get = (redis, key) => __awaiter(void 0, void 0, void 0, function* () {
    const value = yield redis.get(key);
    if (value === null)
        return null;
    return JSON.parse(value);
});
const set = (redis, key, fetcher, expires) => __awaiter(void 0, void 0, void 0, function* () {
    const value = yield fetcher();
    yield redis.set(key, JSON.stringify(value), "EX", expires);
    return value;
});
const del = (redis, key) => __awaiter(void 0, void 0, void 0, function* () {
    yield redis.del(key);
});
exports.default = { fetch, set, get, del };
