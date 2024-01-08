# caffeine API

REST API that fetches streaming links of movies and TV shows based on TMDB id


Hosted instance: https://caffeine-api.vercel.app/

## API Reference

#### List of available providers:
| Name         | Id            | Status               |
| :--------    | :-------      | :-------              |
| ShowBox      | `showbox`     | 🟡 Working partially |   
| FlixHQ       | `flixhq`      | 🟢 Working           |
| ZoeChip      | `zoe`         | 🟢 Working           |
| SmashyStream | `smashystream`| 🔴 Down              |
| RemoteStream | `remotestream`| 🔴 Down              |
| Gomovies     | `gomovies`    | 🟢 Working           |
| VidSrc       | `vidsrc`      | 🟡 Working partially |


### Get all links and subtitles for a movie

| Parameter | Type     | Description                |
| :-------- | :------- | :------------------------- |
| `tmdbId`  | `string` | **Required**. TMDB id of the movie|

```http
  GET /{provider ID}/watch-movie?tmdbId=tmdbId
```

#### Example
Get streaming link and subtitles for the movie 'The Hangover 1' from the 'FlixHQ' provider

```http
  GET /flixhq/watch-movie?tmdbId=18785
```

### Get all links and subtitles for an episode

| Parameter | Type     | Description                |
| :-------- | :------- | :------------------------- |
| `tmdbId`  | `string` | **Required**. TMDB id of the TV show|
| `season`  | `string` | **Required**. The season number of the episode |
| `episode`  | `string` | **Required**. The episode number of the episode |

```http
  GET /{provider ID}/watch-tv?tmdbId=tmdbId&season=season&episode=episode
```

#### Example
Get streaming link and subtitles for the TV show 'The Office' from the 'FlixHQ' provider

```http
  GET /flixhq/watch-tv?tmdbId=2316&season=1&episode=1
```




## Environment Variables

To run this project you need a Cloudflare workers running, you will need to add your workers URL and a TMDB API key to your .env file



`TMDB_KEY`

`WORKERS_URL`

