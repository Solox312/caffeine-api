/**
 * Scraper provider registry - add providers here as you integrate them
 * Providers from https://github.com/BeamlakAschalew/flixquest-scraper
 */
import type { Provider } from "../types";
import { vixsrcProvider } from "./vixsrc";

export const providers: Record<string, Provider> = {
    vixsrc: vixsrcProvider,
    // Add more as you integrate: vidsrc, vidzee, uhdmovies, showbox, 4khdhub
};

export function getProvider(providerId: string): Provider | undefined {
    return providers[providerId];
}

export function getAllProviderIds(): string[] {
    return Object.keys(providers);
}
