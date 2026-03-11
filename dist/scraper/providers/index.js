"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllProviderIds = exports.getProvider = exports.providers = void 0;
const vidsrc_1 = require("./vidsrc");
const vixsrc_1 = require("./vixsrc");
const vidzee_1 = require("./vidzee");
exports.providers = {
    vixsrc: vixsrc_1.vixsrcProvider,
    vidsrc: vidsrc_1.vidsrcProvider,
    vidzee: vidzee_1.vidzeeProvider,
    // Add more as you integrate: uhdmovies, showbox, 4khdhub
};
function getProvider(providerId) {
    return exports.providers[providerId];
}
exports.getProvider = getProvider;
function getAllProviderIds() {
    return Object.keys(exports.providers);
}
exports.getAllProviderIds = getAllProviderIds;
