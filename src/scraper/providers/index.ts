/**
 * Scraper provider registry - add providers here as you integrate them
 * Providers from https://github.com/BeamlakAschalew/flixquest-scraper
 */
import type { Provider } from "../types";
import { vidsrcProvider } from "./vidsrc";
import { vixsrcProvider } from "./vixsrc";
import { vidzeeProvider } from "./vidzee";

export const providers: Record<string, Provider> = {
    vixsrc: vixsrcProvider,
    vidsrc: vidsrcProvider,
    vidzee: vidzeeProvider,
    // Add more as you integrate: uhdmovies, showbox, 4khdhub
};

export function getProvider(providerId: string): Provider | undefined {
    return providers[providerId];
}

export function getAllProviderIds(): string[] {
    return Object.keys(providers);
}
