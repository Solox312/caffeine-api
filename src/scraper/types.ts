/**
 * FlixQuest-style scraper types for Caffeine API integration
 * Compatible with Caffeine app's FlixAPIMultiResponse format
 */

export interface Subtitle {
    file: string;
    label: string;
    kind: string;
    default?: boolean;
}

export interface ProviderLink {
    server: string;
    url: string;
    isM3U8: boolean;
    quality: string;
    subtitles: Subtitle[];
}

export interface ProviderResponse {
    success: boolean;
    provider: string;
    media?: {
        type: string;
        title: string;
        releaseYear: number;
        tmdbId: string;
    };
    links?: ProviderLink[];
    error?: string;
    details?: string;
}

export interface Provider {
    name: string;
    id: string;
    streamMovie: (tmdbId: string) => Promise<ProviderLink[]>;
    streamTV: (
        tmdbId: string,
        season: number,
        episode: number
    ) => Promise<ProviderLink[]>;
}
