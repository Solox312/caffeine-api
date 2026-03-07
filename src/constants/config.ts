import dotenv from "dotenv";

dotenv.config();

const baseUrl =
    process.env.CAFFEINE_API_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    process.env.API_BASE_URL ||
    "http://localhost:3000";

export const config = {
    consumet_url: process.env.CONSUMET_URL || "https://api.consumet.org",
    vidscr_api: process.env.VIDSRC_API || "",
    opensubtitles_key: process.env.OPENSUBTITLES_KEY || "",
    streaming_server_flixhq: process.env.STREAMING_SERVER_FLIXHQ || "vidcloud",
    streaming_server_dcva: process.env.STREAMING_SERVER_DCVA || "asianload",
    streaming_server_zoro: process.env.STREAMING_SERVER_ZORO || "vidcloud",
    ads_enabled: process.env.ADS_ENABLED !== "false",
    route: process.env.FETCH_ROUTE || "flixHQ",
    use_external_subtitles: process.env.USE_EXTERNAL_SUBTITLES === "true",
    ott_ads_enabled: process.env.OTT_ADS_ENABLED !== "false",
    trending_holiday_scroller: process.env.TRENDING_HOLIDAY_SCROLLER !== "false",
    enable_stream: process.env.ENABLE_STREAM !== "false",
    enable_chromecast_feature: process.env.ENABLE_CHROMECAST !== "false",
    displayVipBanner: process.env.DISPLAY_VIP_BANNER !== "false",
    enable_ott: process.env.ENABLE_OTT !== "false",
    caffeine_api_url: baseUrl.replace(/\/$/, ""),
    forced_update: process.env.FORCED_UPDATE === "true",
    latest_version: process.env.LATEST_VERSION || "1.7.1",
    flixhq_zoe_server: process.env.FLIXHQ_ZOE_SERVER || "vidcloud",
    gomovies_server: process.env.GOMOVIES_SERVER || "upcloud",
    vidsrc_server: process.env.VIDSRC_SERVER || "vidsrcembed",
    vidsrcto_server: process.env.VIDSRCTO_SERVER || "vidplay",
    tmdb_proxy: process.env.TMDB_PROXY || "",
};
