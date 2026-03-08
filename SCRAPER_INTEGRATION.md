# FlixQuest Scraper Integration

This document describes the FlixQuest-style scraper integration in Caffeine API, based on [flixquest-scraper](https://github.com/BeamlakAschalew/flixquest-scraper).

## Overview

The scraper module adds streaming link endpoints compatible with the Caffeine Flutter app's `getStreamLinksFlixAPIMulti` format. The app uses these for providers like **vixsrc**, **pstream**, **showbox**, etc.

## Architecture

```
caffeine-api/
├── src/
│   ├── scraper/
│   │   ├── types.ts           # ProviderLink, ProviderResponse, Provider interface
│   │   ├── utils/
│   │   │   └── tmdb.ts        # TMDB metadata (uses TMDB_KEY)
│   │   └── providers/
│   │       ├── index.ts       # Provider registry
│   │       └── vixsrc.ts      # Vixsrc provider (implemented)
│   └── routes/
│       └── scraper.ts         # Fastify routes
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /providers` | List available scraper providers |
| `GET /:provider/stream-movie?tmdbId={id}` | Get movie streaming links |
| `GET /:provider/stream-tv?tmdbId={id}&season={n}&episode={n}` | Get TV episode streaming links |

## Response Format

Matches Caffeine app's `FlixAPIMultiResponse`:

```json
{
  "success": true,
  "provider": "vixsrc",
  "media": {
    "type": "movie",
    "title": "Hamilton",
    "releaseYear": 2020,
    "tmdbId": "556574"
  },
  "links": [
    {
      "server": "vixsrc",
      "url": "https://...",
      "isM3U8": true,
      "quality": "auto",
      "subtitles": [
        { "file": "https://...", "label": "English", "kind": "captions", "default": true }
      ]
    }
  ]
}
```

## Currently Implemented Providers

| Provider | Status | Notes |
|----------|--------|-------|
| **vixsrc** | ✅ Implemented | No API keys required |
| **vidsrc** | ✅ Implemented | No API keys required |
| vidzee | 🔲 To add | May need crypto-js (when added) |
| uhdmovies | 🔲 To add | |
| showbox | 🔲 To add | Requires FEBBOX_COOKIE |
| 4khdhub | 🔲 To add | |

## Adding More Providers

1. Copy the provider from [flixquest-scraper/src/providers](https://github.com/BeamlakAschalew/flixquest-scraper/tree/main/src/providers)
2. Adapt imports: `from '../types/index.js'` → `from '../types'`
3. Add to `src/scraper/providers/index.ts`:

```ts
import { vidsrcProvider } from "./vidsrc";

export const providers: Record<string, Provider> = {
  vixsrc: vixsrcProvider,
  vidsrc: vidsrcProvider,  // add new provider
};
```

4. Add `crypto-js` if needed: `npm install crypto-js @types/crypto-js`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TMDB_KEY` | TMDB API key (required for metadata) | - |
| `FLIXAPI_URL` | Scraper base URL (for config) | Same as `CAFFEINE_API_URL` |
| `FEBBOX_COOKIE` | For ShowBox provider (when added) | - |
| `SHOWBOX_PROXY_URL_VALUE` | Proxy for ShowBox (when added) | - |

## Caffeine App Configuration

1. **FLIXAPI_URL** in `.env` – Set to your caffeine-api base URL, e.g.:
   ```
   FLIXAPI_URL=https://your-caffeine-api.vercel.app
   ```

2. **Config API** – The `/config` endpoint now returns `flix_api_url`. The Caffeine app fetches this and uses it for vixsrc, pstream, showbox, etc.

3. **Provider preference** – Ensure `vixsrc` is in your provider list (it's in the default `providerPreference` constant).

## Testing

```bash
# List providers
curl "http://localhost:3000/providers"

# Stream movie (replace 884605 with a valid TMDB movie ID)
curl "http://localhost:3000/vixsrc/stream-movie?tmdbId=884605"

# Stream TV episode
curl "http://localhost:3000/vixsrc/stream-tv?tmdbId=2316&season=1&episode=1"
```

## Running flixquest-scraper Separately (Optional)

If you prefer to run [flixquest-scraper](https://github.com/BeamlakAschalew/flixquest-scraper) as a separate service (e.g. on Vercel):

1. Deploy flixquest-scraper to Vercel/Render
2. Set `FLIXAPI_URL` in caffeine-api `.env` to that deployment URL
3. The config will serve this URL to the Caffeine app
4. Disable or remove the built-in scraper routes if desired

## Credits

- [flixquest-scraper](https://github.com/BeamlakAschalew/flixquest-scraper) by Beamlak Aschalew
- Provider logic adapted for Fastify/Caffeine API
