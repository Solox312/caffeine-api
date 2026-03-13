"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.daddyliveDomains = exports.daddylive247Url = exports.daddyliveTrailingUrl = exports.daddyliveStreamBaseUrl = exports.daddyliveUserAgent = exports.daddyliveReferrer = exports.tmdbKey = exports.tmdbBaseUrl = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.tmdbBaseUrl = "https://api.themoviedb.org";
exports.tmdbKey = process.env.TMDB_KEY;
exports.daddyliveReferrer = "https://lewblivehdplay.ru/";
exports.daddyliveUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1";
exports.daddyliveStreamBaseUrl = "https://webhdrunns.mizhls.ru/lb/premium";
exports.daddyliveTrailingUrl = `/index.m3u8?|referer=${exports.daddyliveReferrer}`;
exports.daddylive247Url = "https://dlhd.so/24-7-channels.php";
/** Domains for embed/watch pages - used when extracting HLS. Try in order if one fails. */
exports.daddyliveDomains = [
    "https://daddylive.cv",
    "https://daddylive.top",
    "https://daddylives.nl",
];
