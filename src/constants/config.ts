import dotenv from "dotenv";

dotenv.config();

const baseUrl =
    process.env.CAFFEINE_API_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    process.env.API_BASE_URL ||
    "http://localhost:3000";

export const config = {
    consumet_url: process.env.CONSUMET_URL || "https://consumet-api-livid.vercel.app/",
    vidscr_api: process.env.VIDSRC_API || "",
    opensubtitles_key: process.env.OPENSUBTITLES_KEY || "",
    streaming_server_dcva: process.env.STREAMING_SERVER_DCVA || "asianload",
    streaming_server_zoro: process.env.STREAMING_SERVER_ZORO || "vidcloud",
    ads_enabled: process.env.ADS_ENABLED !== "false",
    route: process.env.FETCH_ROUTE || "tmDB",
    use_external_subtitles: process.env.USE_EXTERNAL_SUBTITLES === "true",
    ott_ads_enabled: process.env.OTT_ADS_ENABLED !== "false",
    trending_holiday_scroller: process.env.TRENDING_HOLIDAY_SCROLLER !== "false",
    enable_stream: process.env.ENABLE_STREAM !== "false",
    enable_chromecast_feature: process.env.ENABLE_CHROMECAST !== "false",
    enable_ott: process.env.ENABLE_OTT !== "false",
    caffeine_api_url: baseUrl.replace(/\/$/, ""),
    flix_api_url: process.env.FLIXAPI_URL || baseUrl.replace(/\/$/, ""),
    forced_update: process.env.FORCED_UPDATE === "true",
    latest_version: process.env.LATEST_VERSION || "1.7.1",
    vidsrc_server: process.env.VIDSRC_SERVER || "vidsrcembed",
    vidsrcto_server: process.env.VIDSRCTO_SERVER || "vidplay",
    tmdb_proxy: process.env.TMDB_PROXY || "",
    new_flixhq_url: process.env.NEW_FLIXHQ_URL || "",
    new_flixhq_server: process.env.NEW_FLIXHQ_SERVER || "megacloud",
    goku_server: process.env.GOKU_SERVER || "vidcloud",
    sflix_server: process.env.SFLIX_SERVER || "vidcloud",
    himovies_server: process.env.HIMOVIES_SERVER || "vidcloud",
    animekai_server: process.env.ANIMEKAI_SERVER || "vidcloud",
    hianime_server: process.env.HIANIME_SERVER || "vidcloud",
};
