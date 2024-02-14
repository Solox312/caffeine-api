<p align="center">
    <img alt="Consumet" src="https://github.com/Webcap/webcap.github.io/blob/trunk/caffiene/res/assets/images/logo.png?raw=true" width="200">
</p>
<h1 align="center">caffeine API</h1>

<p align="center">REST API that fetches streaming links of movies and TV shows based on TMDB id using @movie-web/providers package</p>

</p>

Hosted instance: https://caffeine-api.vercel.app

## API Reference

#### List of available providers:

| Name         | Id             | Status   |
| :----------- | :------------- | :------- |
| ShowBox      | `showbox`      | 🟢 200   |
| FlixHQ       | `flixhq`       | 🔴 500   |
| ZoeChip      | `zoe`          | 🔴 500   |
| SmashyStream | `smashystream` | 🔴 500   |
| RemoteStream | `remotestream` | 🔴 500   |
| Gomovies     | `gomovies`     | 🔴 500   |
| VidSrc       | `vidsrc`       | 🟢 200   |
| VidSrcTo     | `vidsrcto`     | 🟢 200   |

### Get all links and subtitles for a movie

| Parameter | Type   | Description                                                                                                                                                                                                                                                  |
| :-------- | :----- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tmdbId`  | `int`  | **Required**. TMDB id of the movie                                                                                                                                                                                                                           |
| `proxied` | `bool` | Optional. `true` or `false` value.<br><br>If set `true` or `proxied` parameter is left empty, the script uses the proxy URL that is found in the environment variable.<br/>Otherwise if set `false` the script will make a raw request towards the provider. |

```http
  GET /{provider ID}/watch-movie?tmdbId=tmdbId
```

#### Example

Get streaming link and subtitles for the movie 'The Hangover 1' from the 'FlixHQ' provider

```http
  GET /flixhq/watch-movie?tmdbId=18785
```

### Get all links and subtitles for an episode

| Parameter | Type   | Description                                                                                                                                                                                                                                                  |
| :-------- | :----- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tmdbId`  | `int`  | **Required**. TMDB id of the TV show                                                                                                                                                                                                                         |
| `season`  | `int`  | **Required**. The season number of the episode                                                                                                                                                                                                               |
| `episode` | `int`  | **Required**. The episode number of the episode                                                                                                                                                                                                              |
| `proxied` | `bool` | Optional. `true` or `false` value.<br><br>If set `true` or `proxied` parameter is left empty, the script uses the proxy URL that is found in the environment variable.<br/>Otherwise if set `false` the script will make a raw request towards the provider. |

```http
  GET /{provider ID}/watch-tv?tmdbId=tmdbId&season=season&episode=episode
```

#### Example

Get streaming link and subtitles for the TV show 'The Office' from the 'FlixHQ' provider

```http
  GET /flixhq/watch-tv?tmdbId=2316&season=1&episode=1
```

## Environment Variables

`TMDB_KEY` (**Required**) : TMDB API key, used to get the metadata of a movie or TV show, can be found at https://www.themoviedb.org/settings/api

`WORKERS_URL` (Optional) : A proxy URL that'll be used while making a GET request (used only if `proxied` is true or if `proxied` is left unprovided).

You can get Cloudflare proxy at https://workers.cloudflare.com/<br>
Or deploy your own custom proxy from [here](https://github.com/movie-web/simple-proxy) and place the endpoint in `WORKERS_URL` 

You can cache data that comes from TMDB and from the providers if you have a [Redis](https://redis.com) database:

`REDIS_HOST` URL of your Redis database<br>
`REDIS_PASSWORD` password of your database<br>
`REDIS_PORT` port of your database connection

