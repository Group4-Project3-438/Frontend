import { useMemo, useState, useEffect } from "react";
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
  AppState,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";

type ApiKey = "scryfall" | "pokemon" | "riftcodex";

type CardItem = {
  id: string;
  name: string;
  subtitle?: string;
  detail?: string;
  image?: string | null;
  price?: string | null;
};

const API_OPTIONS: { key: ApiKey; label: string }[] = [
  { key: "scryfall", label: "Magic: The Gathering" },
  { key: "pokemon", label: "Pokemon TCG" },
  { key: "riftcodex", label: "Riftbound" },
];

const MAX_RESULTS = 60;
const HORIZONTAL_PADDING = 16;
const GRID_GAP = 8;

function getPlaceholder(api: ApiKey) {
  if (api === "pokemon") return "e.g. charizard, pikachu, mewtwo";
  if (api === "riftcodex") return "e.g. master yi, jinx, token";
  return "e.g. lightning bolt, t:dragon, c:red";
}

function loginWithGoogle() {
  WebBrowser.openBrowserAsync(
    "http://localhost:8081/oauth2/authorization/google"
  );
}

async function fetchJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed with ${res.status}`);
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

export default function Index() {
  const { width: screenWidth } = useWindowDimensions();
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [api, setApi] = useState<ApiKey>("scryfall");
  const [query, setQuery] = useState("");
  const [cards, setCards] = useState<CardItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchedQuery, setSearchedQuery] = useState("");

  const placeholder = useMemo(() => getPlaceholder(api), [api]);

  const columnCount = useMemo(() => {
    if (screenWidth >= 1000) return 7;
    if (screenWidth >= 760) return 6;
    if (screenWidth >= 520) return 5;
    return 4;
  }, [screenWidth]);

  const cardWidth = useMemo(() => {
    const available = screenWidth - HORIZONTAL_PADDING * 2;
    return (available - GRID_GAP * (columnCount - 1)) / columnCount;
  }, [columnCount, screenWidth]);

  const checkAuth = () => {
    fetch("http://localhost:8081/api/auth/me", {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) {
          setUser(data);
        } else {
          setUser(null);
        }
      })
      .catch(() => setUser(null));
  };

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        checkAuth();
      }
    });
    return () => sub.remove();
  }, []);

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

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () =>
            user ? (
              <Pressable
                onPress={() => router.push("/profile")}
                style={{ marginRight: 15 }}
              >
                <Text style={{ fontWeight: "bold" }}>
                  {user.name || "Profile"}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={loginWithGoogle}
                style={{ marginRight: 15 }}
              >
                <Text style={{ fontWeight: "bold" }}>Login</Text>
              </Pressable>
            ),
        }}
      />

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Card Search</Text>

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
                <Text selectable style={styles.cardId}>
                  id: {card.id}
                </Text>
                <Text style={styles.cardPrice}>
                  {card.price || "—"}
                </Text>
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
    justifyContent: "space-between",
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
  cardId: {
    color: "#8a8a8a",
    marginTop: 2,
    fontSize: 8,
  },
  cardPrice: {
    color: "#86d28f",
    fontWeight: "700",
    marginTop: 4,
    fontSize: 11,
  },
});