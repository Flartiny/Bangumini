const BASE_URL = "https://graphql.anilist.co";

let fetchFn: typeof fetch = fetch;

export function setFetchFunction(fn: typeof fetch) {
  fetchFn = fn;
}

function buildQuery(title: string): string {
  const escaped = title.replace(/"/g, '\\"');
  return `{ Page(page: 1, perPage: 1) { media(search: "${escaped}", type: ANIME) { id nextAiringEpisode { airingAt episode } } } }`;
}

interface AniListResponse {
  data: {
    Page: {
      media: {
        id: number;
        nextAiringEpisode: { airingAt: number; episode: number } | null;
      }[];
    };
  };
}

export async function getAiringAt(title: string): Promise<{ airingAt: number; episode: number } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetchFn(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: buildQuery(title) }),
      signal: controller.signal,
    });

    const json = (await res.json()) as AniListResponse;
    const media = json.data?.Page?.media?.[0];
    if (!media?.nextAiringEpisode) return null;

    return {
      airingAt: media.nextAiringEpisode.airingAt,
      episode: media.nextAiringEpisode.episode,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
