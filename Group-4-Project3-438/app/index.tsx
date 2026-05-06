import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { useAuth } from "./auth-context";

type ApiKey = "scryfall" | "pokemon" | "riftcodex";

type CardItem = {
  id: string;
  name: string;
  subtitle?: string;
  detail?: string;
  image?: string | null;
  price?: string | null;
};

type CardList = {
  id: number;
  userId: string;
  name: string;
};

const API_OPTIONS: { key: ApiKey; label: string }[] = [
  { key: "scryfall", label: "Magic: The Gathering" },
  { key: "pokemon", label: "Pokemon TCG" },
  { key: "riftcodex", label: "Riftbound" },
];
const MAX_RESULTS = 60;
const HORIZONTAL_PADDING = 16;
const GRID_GAP = 8;
const BACKEND_BASE_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL?.replace(/\/+$/, "") ??
  "https://backend-api-b6pi.onrender.com";

function getPlaceholder(api: ApiKey) {
  if (api === "pokemon") {
    return "e.g. charizard, pikachu, mewtwo";
  }
  if (api === "riftcodex") {
    return "e.g. master yi, jinx, token";
  }
  return "e.g. lightning bolt, t:dragon, c:red";
}

async function fetchJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed with ${res.status}`);
  }
  return res.json();
}

async function fetchRiftCodexJson(url: string) {
  try {
    return await fetchJson(url);
  } catch {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    return fetchJson(proxyUrl);
  }
}

async function saveFavoriteCard(userId: string, cardId: string) {
  const response = await fetch(`${BACKEND_BASE_URL}/api/favorites`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, cardId }),
  });

  if (!response.ok) {
    throw new Error(`Favorite save failed with ${response.status}`);
  }
}

async function fetchUserLists(userId: string): Promise<CardList[]> {
  const encodedUserId = encodeURIComponent(userId);
  const response = await fetch(`${BACKEND_BASE_URL}/api/lists?userId=${encodedUserId}`);

  if (!response.ok) {
    throw new Error(`List fetch failed with ${response.status}`);
  }

  return response.json();
}

async function addCardToList(userId: string, listId: number, cardId: string) {
  const response = await fetch(`${BACKEND_BASE_URL}/api/lists/${listId}/cards`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, cardId }),
  });

  if (!response.ok) {
    throw new Error(`Add to list failed with ${response.status}`);
  }
}

export default function Index() {
  const { user, loading: authLoading } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const [api, setApi] = useState<ApiKey>("scryfall");
  const [query, setQuery] = useState("");
  const [cards, setCards] = useState<CardItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchedQuery, setSearchedQuery] = useState("");
  const [lists, setLists] = useState<CardList[]>([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [savingFavoriteCardIds, setSavingFavoriteCardIds] = useState<Set<string>>(new Set());
  const [savingListCardIds, setSavingListCardIds] = useState<Set<string>>(new Set());
  const [expandedListCardId, setExpandedListCardId] = useState<string | null>(null);
  const [selectedListByCardId, setSelectedListByCardId] = useState<Record<string, number | null>>({});

  const placeholder = useMemo(() => getPlaceholder(api), [api]);
  const columnCount = useMemo(() => {
    if (screenWidth >= 1200) return 7;
    if (screenWidth >= 960) return 6;
    if (screenWidth >= 760) return 5;
    if (screenWidth >= 600) return 4;
    if (screenWidth >= 420) return 3;
    return 2;
  }, [screenWidth]);
  const cardWidth = useMemo(() => {
    const available = screenWidth - HORIZONTAL_PADDING * 2;
    return (available - GRID_GAP * (columnCount - 1)) / columnCount;
  }, [columnCount, screenWidth]);
  const normalizedUserId = user?.userId?.trim() ?? "";
  const isAuthenticated = !!user?.authenticated;

  useEffect(() => {
    if (!normalizedUserId) {
      setLists([]);
      return;
    }

    let cancelled = false;

    async function loadLists() {
      setListsLoading(true);
      try {
        const nextLists = await fetchUserLists(normalizedUserId);
        if (!cancelled) {
          setLists(nextLists);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load lists");
        }
      } finally {
        if (!cancelled) {
          setListsLoading(false);
        }
      }
    }

    loadLists();
    return () => {
      cancelled = true;
    };
  }, [normalizedUserId]);

  async function handleSearch() {
    const q = query.trim();
    if (!q || loading) return;

    setLoading(true);
    setError("");
    setCards([]);
    setSearchedQuery(q);

    try {
      let nextCards: CardItem[] = [];

      if (api === "scryfall") {
        const res = await fetch(
          `https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}`
        );

        if (res.status === 404) {
          nextCards = [];
        } else if (!res.ok) {
          throw new Error(`Scryfall returned ${res.status}`);
        } else {
          const data = await res.json();
          nextCards = (data.data ?? []).slice(0, MAX_RESULTS).map((c: any) => ({
            id: c.id,
            name: c.name,
            subtitle: c.type_line,
            detail: c.set_name,
            image:
              c.image_uris?.normal ??
              c.card_faces?.[0]?.image_uris?.normal ??
              null,
            price: c.prices?.usd
              ? `$${c.prices.usd}`
              : c.prices?.usd_foil
              ? `$${c.prices.usd_foil} (foil)`
              : null,
          }));
        }
      } else if (api === "pokemon") {
        const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(
          `name:"*${q}*"`
        )}&pageSize=${MAX_RESULTS}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Pokemon TCG returned ${res.status}`);

        const data = await res.json();
        nextCards = (data.data ?? []).map((c: any) => {
          const tcgPrices = c.tcgplayer?.prices;
          let price: string | null = null;

          if (tcgPrices) {
            const variant =
              tcgPrices.holofoil ??
              tcgPrices.normal ??
              tcgPrices.reverseHolofoil ??
              tcgPrices["1stEditionHolofoil"] ??
              Object.values(tcgPrices)[0];

            if (variant?.market) {
              price = `$${Number(variant.market).toFixed(2)}`;
            } else if (variant?.mid) {
              price = `$${Number(variant.mid).toFixed(2)}`;
            }
          }

          const subtitleParts = [
            c.supertype,
            ...(c.subtypes ?? []),
          ].filter(Boolean);

          return {
            id: c.id,
            name: c.name,
            subtitle: subtitleParts.join(" · "),
            detail: c.set?.name,
            image: c.images?.large ?? c.images?.small ?? null,
            price,
          };
        });
      } else {
        const url = `https://api.riftcodex.com/cards/name?fuzzy=${encodeURIComponent(
          q
        )}&size=${MAX_RESULTS}&sort=name&dir=1`;
        const data = await fetchRiftCodexJson(url);
        nextCards = (data.items ?? []).map((c: any) => ({
          id: c.id,
          name: c.name,
          subtitle: [c.classification?.supertype, c.classification?.type]
            .filter(Boolean)
            .join(" · "),
          detail: c.set?.label
            ? `${c.set.label}${
                c.riftbound_id ? ` · ${c.riftbound_id}` : ""
              }`
            : c.riftbound_id,
          image: c.media?.image_url ?? null,
          price: null,
        }));
      }

      setCards(nextCards);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddFavorite(cardId: string) {
    if (!normalizedUserId || savingFavoriteCardIds.has(cardId)) return;

    setSavingFavoriteCardIds((prev) => new Set(prev).add(cardId));
    setError("");
    try {
      await saveFavoriteCard(normalizedUserId, cardId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save favorite");
    } finally {
      setSavingFavoriteCardIds((prev) => {
        const next = new Set(prev);
        next.delete(cardId);
        return next;
      });
    }
  }

  async function handleAddCardToSelectedList(cardId: string) {
    const selectedListId = selectedListByCardId[cardId];
    if (!normalizedUserId || !selectedListId || savingListCardIds.has(cardId)) return;

    setSavingListCardIds((prev) => new Set(prev).add(cardId));
    setError("");
    try {
      await addCardToList(normalizedUserId, selectedListId, cardId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add card to list");
    } finally {
      setSavingListCardIds((prev) => {
        const next = new Set(prev);
        next.delete(cardId);
        return next;
      });
    }
  }

  function getSelectedListName(cardId: string) {
    const selectedListId = selectedListByCardId[cardId];
    if (!selectedListId) return "Choose list";

    const selected = lists.find((list) => list.id === selectedListId);
    return selected?.name ?? "Choose list";
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "CardFetcher",
        }}
      />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>CardFetcher</Text>

        <View style={styles.apiRow}>
          {API_OPTIONS.map((opt) => {
            const active = opt.key === api;
            return (
              <Pressable
                key={opt.key}
                onPress={() => setApi(opt.key)}
                style={[styles.apiChip, active && styles.apiChipActive]}
              >
                <Text
                  style={[
                    styles.apiChipText,
                    active && styles.apiChipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.listMeta}>
          {authLoading
            ? "Checking signed-in user..."
            : listsLoading
            ? "Loading your lists..."
            : `${lists.length} list${lists.length === 1 ? "" : "s"} loaded`}
        </Text>
        {!authLoading && !isAuthenticated && (
          <Text style={styles.warningText}>Sign in from Profile to favorite cards and use lists.</Text>
        )}
        {!authLoading && isAuthenticated && !normalizedUserId && (
          <Text style={styles.warningText}>
            Signed in, but no usable user id was returned by OAuth.
          </Text>
        )}

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder}
          placeholderTextColor="#9a948a"
          style={styles.input}
          onSubmitEditing={handleSearch}
          editable={!loading}
        />

        <Pressable
          onPress={handleSearch}
          disabled={loading || !query.trim()}
          style={[
            styles.button,
            (loading || !query.trim()) && styles.buttonDisabled,
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Search</Text>
          )}
        </Pressable>

        {!!error && <Text style={styles.error}>{error}</Text>}

        {!loading &&
          !error &&
          searchedQuery.length > 0 &&
          cards.length === 0 && (
            <Text style={styles.empty}>
              No cards found for {searchedQuery}
            </Text>
          )}

        <View style={styles.grid}>
          {cards.map((card) => (
            <View key={card.id} style={[styles.card, { width: cardWidth }]}>
              {card.image ? (
                <Image
                  source={{ uri: card.image }}
                  style={styles.cardImage}
                />
              ) : (
                <View style={styles.noImage}>
                  <Text style={styles.noImageText}>No image</Text>
                </View>
              )}
              <View style={styles.cardBody}>
                <Text style={styles.cardName}>{card.name}</Text>
                {!!card.subtitle && (
                  <Text style={styles.cardSub}>{card.subtitle}</Text>
                )}
                {!!card.detail && (
                  <Text style={styles.cardDetail}>{card.detail}</Text>
                )}
                <Text style={styles.cardPrice}>
                  {card.price || "—"}
                </Text>
                <View style={styles.cardActionRow}>
                  <Pressable
                    onPress={() => handleAddFavorite(card.id)}
                    disabled={savingFavoriteCardIds.has(card.id) || !normalizedUserId}
                    style={[
                      styles.favoriteButton,
                      (savingFavoriteCardIds.has(card.id) || !normalizedUserId) &&
                        styles.favoriteButtonDisabled,
                    ]}
                  >
                    <Text style={styles.favoriteButtonText}>
                      {savingFavoriteCardIds.has(card.id) ? "Saving..." : "Favorite"}
                    </Text>
                  </Pressable>
                </View>

                <Pressable
                  onPress={() =>
                    setExpandedListCardId((prev) => (prev === card.id ? null : card.id))
                  }
                  style={styles.listDropdown}
                >
                  <Text style={styles.listDropdownText}>{getSelectedListName(card.id)}</Text>
                </Pressable>

                {expandedListCardId === card.id && (
                  <View style={styles.listDropdownMenu}>
                    {lists.length === 0 ? (
                      <Text style={styles.listEmptyText}>No lists found</Text>
                    ) : (
                      lists.map((list) => {
                        const isSelected = selectedListByCardId[card.id] === list.id;
                        return (
                          <Pressable
                            key={list.id}
                            onPress={() => {
                              setSelectedListByCardId((prev) => ({
                                ...prev,
                                [card.id]: list.id,
                              }));
                              setExpandedListCardId(null);
                            }}
                            style={[styles.listOption, isSelected && styles.listOptionSelected]}
                          >
                            <Text style={styles.listOptionText}>{list.name}</Text>
                          </Pressable>
                        );
                      })
                    )}
                  </View>
                )}

                <Pressable
                  onPress={() => handleAddCardToSelectedList(card.id)}
                  disabled={
                    !normalizedUserId ||
                    !selectedListByCardId[card.id] ||
                    savingListCardIds.has(card.id)
                  }
                  style={[
                    styles.addToListButton,
                    (!normalizedUserId ||
                      !selectedListByCardId[card.id] ||
                      savingListCardIds.has(card.id)) &&
                      styles.addToListButtonDisabled,
                  ]}
                >
                  <Text style={styles.addToListButtonText}>
                    {savingListCardIds.has(card.id) ? "Adding..." : "Add to list"}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: "100%",
    backgroundColor: "#111",
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 20,
    paddingBottom: 16,
  },
  listMeta: {
    color: "#999",
    marginBottom: 8,
    fontSize: 11,
  },
  warningText: {
    color: "#f3bc66",
    marginBottom: 8,
    fontSize: 11,
  },
  title: {
    color: "#fff",
    fontSize: 24,
    marginBottom: 10,
    fontWeight: "600",
  },
  apiRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  apiChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 6,
  },
  apiChipActive: {
    borderColor: "#777",
    backgroundColor: "#2a2a2a",
  },
  apiChipText: {
    color: "#ddd",
    fontSize: 11,
  },
  apiChipTextActive: {
    fontWeight: "700",
  },
  input: {
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 8,
    backgroundColor: "#1d1d1d",
    color: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  button: {
    backgroundColor: "#2f6df5",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    marginBottom: 10,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
  error: {
    color: "#ff9696",
    marginBottom: 8,
  },
  empty: {
    color: "#999",
    marginBottom: 8,
    fontStyle: "italic",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    gap: GRID_GAP,
  },
  card: {
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#1b1b1b",
  },
  cardImage: {
    width: "100%",
    aspectRatio: 5 / 7,
    resizeMode: "cover",
    backgroundColor: "#222",
  },
  noImage: {
    width: "100%",
    aspectRatio: 5 / 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#222",
  },
  noImageText: {
    color: "#888",
  },
  cardBody: {
    padding: 6,
    gap: 2,
  },
  cardName: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  cardSub: {
    color: "#bbb",
    fontSize: 10,
  },
  cardDetail: {
    color: "#999",
    fontSize: 9,
  },
  cardPrice: {
    color: "#86d28f",
    fontWeight: "700",
    marginTop: 4,
    fontSize: 11,
  },
  cardActionRow: {
    marginTop: 8,
    flexDirection: "row",
  },
  favoriteButton: {
    alignSelf: "flex-start",
    borderRadius: 6,
    backgroundColor: "#2f6df5",
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  favoriteButtonDisabled: {
    opacity: 0.6,
  },
  favoriteButtonText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  listDropdown: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 6,
    backgroundColor: "#222",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  listDropdownText: {
    color: "#ddd",
    fontSize: 11,
  },
  listDropdownMenu: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 6,
    backgroundColor: "#222",
    overflow: "hidden",
  },
  listOption: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  listOptionSelected: {
    backgroundColor: "#2f6df5",
  },
  listOptionText: {
    color: "#fff",
    fontSize: 11,
  },
  listEmptyText: {
    color: "#999",
    fontSize: 11,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  addToListButton: {
    marginTop: 8,
    alignSelf: "flex-start",
    borderRadius: 6,
    backgroundColor: "#1f8f4a",
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  addToListButtonDisabled: {
    opacity: 0.6,
  },
  addToListButtonText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
});
