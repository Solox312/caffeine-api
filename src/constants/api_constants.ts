import dotenv from "dotenv";
dotenv.config();

export const tmdbBaseUrl = "https://api.themoviedb.org";
export const tmdbKey = process.env.TMDB_KEY;
export const daddyliveReferrer = "https://lewblivehdplay.ru/";
export const daddyliveUserAgent =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1";
export const daddyliveStreamBaseUrl =
    "https://webhdrunns.mizhls.ru/lb/premium";
export const daddyliveTrailingUrl = `/index.m3u8?|referer=${daddyliveReferrer}`;
export const daddylive247Url = "https://dlhd.so/24-7-channels.php";
