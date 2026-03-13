import axios from "axios";
import { load } from "cheerio";
import { ChannelEntry } from "../utils/types";
import { daddylive247Url } from "../constants/api_constants";

/** Fetch a page and extract the first valid HLS (m3u8) stream URL. Skips ad URLs. */
export async function extractHlsFromUrl(pageUrl: string): Promise<string | null> {
    try {
        const res = await axios.get(pageUrl, {
            timeout: 15000,
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                Accept: "text/html,application/xhtml+xml",
                Referer: "https://daddylive.cv/",
            },
            maxRedirects: 5,
            validateStatus: (s) => s >= 200 && s < 400,
        });
        const html = res.data;
        if (typeof html !== "string") return null;
        // Match m3u8 URLs in HTML/JS (player configs, src, loadSource, etc.)
        const m3u8Regex = /https?:\/\/[^\s"'<>)\]&]+\.m3u8[^\s"'<>)\]]*/gi;
        const matches = html.match(m3u8Regex);
        if (!matches || matches.length === 0) return null;
        for (const raw of matches) {
            let url = raw.replace(/["')\]]+$/, "").trim();
            if (url.length < 25) continue;
            if (/\/ad[\-_]|\/ads?\//i.test(url)) continue;
            if (/ad\.|ads\.|adserver/i.test(url)) continue;
            return url;
        }
        return null;
    } catch {
        return null;
    }
}

export async function get247(): Promise<ChannelEntry[] | null> {
    try {
        const channels = await axios.get(daddylive247Url, {
            timeout: 15000,
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; rv:91.0) Gecko/20100101 Firefox/91.0" },
        });
        const $ = load(channels.data);
        const firstGridContainer = $(".grid-container").first();
        const gridItems = firstGridContainer.find(".grid-item").toArray();

        const parsedChannels: ChannelEntry[] = [];
        gridItems.forEach((element) => {
            const href = $(element).find("a").attr("href");
            if (!href) return;
            const channelId = extractChannelId(href);
            const name = $(element).find("strong").text()?.trim();
            if (typeof channelId === "number" && name && !name.startsWith("18+")) {
                parsedChannels.push({ id: channelId, channel_name: name });
            }
        });
        return parsedChannels;
    } catch {
        return null;
    }
}

function extractChannelId(text: string) : number | boolean {
    const regex = /(\d+)/;
    const match = text.match(regex);

    if (match) {
        return Number.parseInt(match[0]);
    } else {
        return false;
    }
}