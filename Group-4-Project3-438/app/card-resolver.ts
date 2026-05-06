export type CardSource = "scryfall" | "pokemon" | "riftcodex" | null;

export type ResolvedCard = {
  image: string | null;
  name: string | null;
  source: CardSource;
};

async function fetchJson(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }
  return response.json();
}

async function fetchRiftCodexJson(url: string) {
  try {
    return await fetchJson(url);
  } catch {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    return fetchJson(proxyUrl);
  }
}

export async function resolveCardById(cardIdRaw: string): Promise<ResolvedCard> {
  const cardId = cardIdRaw.trim();
  if (!cardId) {
    return { image: null, name: null, source: null };
  }

  try {
    const scryfall = await fetchJson(
      `https://api.scryfall.com/cards/${encodeURIComponent(cardId)}`
    );
    return {
      image:
        scryfall.image_uris?.normal ??
        scryfall.card_faces?.[0]?.image_uris?.normal ??
        null,
      name: typeof scryfall.name === "string" ? scryfall.name : null,
      source: "scryfall",
    };
  } catch {
    // Try next source
  }

  try {
    const pokemon = await fetchJson(
      `https://api.pokemontcg.io/v2/cards/${encodeURIComponent(cardId)}`
    );
    const payload = pokemon?.data ?? pokemon;
    return {
      image: payload?.images?.large ?? payload?.images?.small ?? null,
      name: typeof payload?.name === "string" ? payload.name : null,
      source: "pokemon",
    };
  } catch {
    // Try next source
  }

  try {
    const rift = await fetchRiftCodexJson(
      `https://api.riftcodex.com/cards/${encodeURIComponent(cardId)}`
    );
    return {
      image: rift?.media?.image_url ?? null,
      name: typeof rift?.name === "string" ? rift.name : null,
      source: "riftcodex",
    };
  } catch {
    return { image: null, name: null, source: null };
  }
}
