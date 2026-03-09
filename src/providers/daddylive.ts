import axios from "axios";
import { load } from "cheerio";
import { ChannelEntry } from "../utils/types";
import { daddylive247Url } from "../constants/api_constants";

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