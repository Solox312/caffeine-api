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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.get247 = void 0;
const axios_1 = __importDefault(require("axios"));
const cheerio_1 = require("cheerio");
const api_constants_1 = require("../constants/api_constants");
function get247() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const channels = yield axios_1.default.get(api_constants_1.daddylive247Url, {
                timeout: 15000,
                headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; rv:91.0) Gecko/20100101 Firefox/91.0" },
            });
            const $ = (0, cheerio_1.load)(channels.data);
            const firstGridContainer = $(".grid-container").first();
            const gridItems = firstGridContainer.find(".grid-item").toArray();
            const parsedChannels = [];
            gridItems.forEach((element) => {
                var _a;
                const href = $(element).find("a").attr("href");
                if (!href)
                    return;
                const channelId = extractChannelId(href);
                const name = (_a = $(element).find("strong").text()) === null || _a === void 0 ? void 0 : _a.trim();
                if (typeof channelId === "number" && name && !name.startsWith("18+")) {
                    parsedChannels.push({ id: channelId, channel_name: name });
                }
            });
            return parsedChannels;
        }
        catch (_a) {
            return null;
        }
    });
}
exports.get247 = get247;
function extractChannelId(text) {
    const regex = /(\d+)/;
    const match = text.match(regex);
    if (match) {
        return Number.parseInt(match[0]);
    }
    else {
        return false;
    }
}
