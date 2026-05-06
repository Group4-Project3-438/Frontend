import { useEffect, useState } from "react";
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
import { resolveCardById, type ResolvedCard } from "./card-resolver";

type CardList = {
  id: number;
  userId: string;
  name: string;
};

type ListCardItem = {
  id: number;
  listId: number;
  cardId: string;
};

type ListCardDisplay = ListCardItem & {
  image: ResolvedCard["image"];
  name: ResolvedCard["name"];
  source: ResolvedCard["source"];
};

const BACKEND_BASE_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL?.replace(/\/+$/, "") ??
  "http://localhost:8082";

async function fetchLists(userId: string): Promise<CardList[]> {
  const encodedUserId = encodeURIComponent(userId);
  const response = await fetch(`${BACKEND_BASE_URL}/api/lists?userId=${encodedUserId}`);
  if (!response.ok) {
    throw new Error(`List fetch failed with ${response.status}`);
  }
  return response.json();
}

async function createList(userId: string, name: string): Promise<CardList> {
  const response = await fetch(`${BACKEND_BASE_URL}/api/lists`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, name }),
  });
  if (!response.ok) {
    throw new Error(`List creation failed with ${response.status}`);
  }
  return response.json();
}

async function fetchListCards(userId: string, listId: number): Promise<ListCardItem[]> {
  const encodedUserId = encodeURIComponent(userId);
  const response = await fetch(
    `${BACKEND_BASE_URL}/api/lists/${listId}/cards?userId=${encodedUserId}`
  );
  if (!response.ok) {
    throw new Error(`List cards fetch failed with ${response.status}`);
  }
  return response.json();
}

async function resolveListCardDisplay(card: ListCardItem): Promise<ListCardDisplay> {
  const resolved = await resolveCardById(card.cardId);
  return { ...card, ...resolved };
}

export default function ListsScreen() {
  const { user, loading: authLoading } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const [newListName, setNewListName] = useState("");
  const [lists, setLists] = useState<CardList[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [expandedListId, setExpandedListId] = useState<number | null>(null);
  const [cardsByListId, setCardsByListId] = useState<Record<number, ListCardDisplay[]>>({});
  const [loadingCardsForListId, setLoadingCardsForListId] = useState<number | null>(null);
  const normalizedUserId = user?.userId?.trim() ?? "";
  const isAuthenticated = !!user?.authenticated;
  const cardColumns = screenWidth >= 900 ? 5 : screenWidth >= 700 ? 4 : screenWidth >= 430 ? 3 : 2;
  const listCardWidth = (screenWidth - 32 - 20 - (cardColumns - 1) * 8) / cardColumns;

  async function loadLists(normalizedUserId: string) {
    if (!normalizedUserId) {
      setLists([]);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const nextLists = await fetchLists(normalizedUserId);
      setLists(nextLists);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load lists");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLists(normalizedUserId);
  }, [normalizedUserId]);

  async function handleCreateList() {
    const normalizedName = newListName.trim();
    if (!normalizedUserId || !normalizedName || creating) return;

    setCreating(true);
    setError("");
    try {
      const created = await createList(normalizedUserId, normalizedName);
      setNewListName("");
      setLists((prev) => [created, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create list");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleList(listId: number) {
    if (expandedListId === listId) {
      setExpandedListId(null);
      return;
    }

    setExpandedListId(listId);
    if (cardsByListId[listId]) {
      return;
    }

    if (!normalizedUserId) return;

    setLoadingCardsForListId(listId);
    setError("");
    try {
      const cards = await fetchListCards(normalizedUserId, listId);
      const cardsWithDisplay = await Promise.all(cards.map((card) => resolveListCardDisplay(card)));
      setCardsByListId((prev) => ({ ...prev, [listId]: cardsWithDisplay }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load list cards");
    } finally {
      setLoadingCardsForListId(null);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: "Your Lists" }} />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Your Lists</Text>

        <Text style={styles.label}>Create a new list</Text>
        <View style={styles.createRow}>
          <TextInput
            value={newListName}
            onChangeText={setNewListName}
            placeholder="e.g. Budget Deck Ideas"
            placeholderTextColor="#9a948a"
            style={[styles.input, styles.createInput]}
          />
          <Pressable
            onPress={handleCreateList}
          disabled={!normalizedUserId || !newListName.trim() || creating || authLoading}
            style={[
              styles.createButton,
              (!normalizedUserId || !newListName.trim() || creating) &&
                styles.createButtonDisabled,
            ]}
          >
            <Text style={styles.createButtonText}>{creating ? "..." : "Create"}</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => loadLists(normalizedUserId)}
          disabled={loading || !normalizedUserId || authLoading}
          style={[
            styles.refreshButton,
            (loading || !normalizedUserId || authLoading) && styles.refreshButtonDisabled,
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.refreshButtonText}>Refresh Lists</Text>
          )}
        </Pressable>

        {authLoading && <Text style={styles.meta}>Checking signed-in user...</Text>}
        {!authLoading && !isAuthenticated && (
          <Text style={styles.meta}>Sign in from Profile to view and create lists.</Text>
        )}
        {!authLoading && isAuthenticated && !normalizedUserId && (
          <Text style={styles.meta}>Signed in, but no usable user id was returned by OAuth.</Text>
        )}

        {!!error && <Text style={styles.error}>{error}</Text>}

        <Text style={styles.sectionLabel}>
          {lists.length} list{lists.length === 1 ? "" : "s"}
        </Text>

        <View style={styles.listContainer}>
          {lists.map((list) => {
            const cards = cardsByListId[list.id] ?? [];
            const isExpanded = expandedListId === list.id;
            const isLoadingCards = loadingCardsForListId === list.id;
            return (
              <View key={list.id} style={styles.listCard}>
                <Pressable onPress={() => handleToggleList(list.id)}>
                  <Text style={styles.listName}>{list.name}</Text>
                  <Text style={styles.listMeta}>List ID: {list.id}</Text>
                  <Text style={styles.listMeta}>
                    {isExpanded ? "Tap to hide cards" : "Tap to view cards"}
                  </Text>
                </Pressable>

                {isExpanded && (
                  <View style={styles.cardsArea}>
                    {isLoadingCards ? (
                      <ActivityIndicator color="#fff" />
                    ) : cards.length === 0 ? (
                      <Text style={styles.emptyCards}>No cards in this list yet.</Text>
                    ) : (
                      <View style={styles.cardsGrid}>
                        {cards.map((card) => (
                          <View key={card.id} style={[styles.cardItem, { width: listCardWidth }]}>
                            {card.image ? (
                              <Image source={{ uri: card.image }} style={styles.cardImage} />
                            ) : (
                              <View style={styles.cardImageFallback}>
                                <Text style={styles.cardImageFallbackText}>No image</Text>
                              </View>
                            )}
                            <Text style={styles.cardName} numberOfLines={2}>
                              {card.name || card.cardId}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: "100%",
    backgroundColor: "#111",
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 14,
  },
  label: {
    color: "#ddd",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  sectionLabel: {
    color: "#ddd",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 8,
    backgroundColor: "#1d1d1d",
    color: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  createRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginBottom: 8,
  },
  createInput: {
    flex: 1,
    marginBottom: 0,
  },
  createButton: {
    backgroundColor: "#2f6df5",
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  refreshButton: {
    marginBottom: 10,
    backgroundColor: "#1f8f4a",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
  },
  refreshButtonDisabled: {
    opacity: 0.6,
  },
  refreshButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  error: {
    color: "#ff9696",
    marginBottom: 8,
  },
  meta: {
    color: "#999",
    marginBottom: 8,
    fontSize: 11,
  },
  listContainer: {
    gap: 8,
  },
  listCard: {
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 8,
    backgroundColor: "#1b1b1b",
    padding: 10,
  },
  listName: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
    marginBottom: 4,
  },
  listMeta: {
    color: "#aaa",
    fontSize: 11,
    marginBottom: 2,
  },
  cardsArea: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#333",
    paddingTop: 8,
  },
  cardsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  cardItem: {
    minWidth: 0,
  },
  cardImage: {
    width: "100%",
    aspectRatio: 0.72,
    borderRadius: 6,
    backgroundColor: "#2a2a2a",
  },
  cardImageFallback: {
    width: "100%",
    aspectRatio: 0.72,
    borderRadius: 6,
    backgroundColor: "#262626",
    borderWidth: 1,
    borderColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
  cardImageFallbackText: {
    color: "#8f8f8f",
    fontSize: 11,
    fontWeight: "600",
  },
  cardName: {
    color: "#ddd",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 6,
  },
  emptyCards: {
    color: "#888",
    fontSize: 11,
  },
});
