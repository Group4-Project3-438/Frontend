import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
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

type ChatRoom = {
  id: number;
  roomKey: string;
};

type ChatMessage = {
  id: number;
  roomId: number;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
};

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
  "https://cardfetcherapi.onrender.com";

async function fetchRooms(): Promise<ChatRoom[]> {
  const response = await fetch(`${BACKEND_BASE_URL}/chat/rooms`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`Room fetch failed with ${response.status}`);
  }
  return response.json();
}

async function createRoom(roomKey: string): Promise<ChatRoom> {
  const response = await fetch(`${BACKEND_BASE_URL}/chat/rooms`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ roomKey }),
  });
  if (!response.ok) {
    throw new Error(`Room creation failed with ${response.status}`);
  }
  return response.json();
}

async function fetchMessages(roomId: number): Promise<ChatMessage[]> {
  const response = await fetch(`${BACKEND_BASE_URL}/chat/rooms/${roomId}/messages`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`Message fetch failed with ${response.status}`);
  }
  return response.json();
}

async function sendMessage(
  roomId: number,
  text: string,
  senderId: string,
  senderName: string
): Promise<ChatMessage> {
  const response = await fetch(`${BACKEND_BASE_URL}/chat/rooms/${roomId}/messages`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, senderId, senderName }),
  });
  if (!response.ok) {
    throw new Error(`Message send failed with ${response.status}`);
  }
  return response.json();
}

async function fetchLists(userId: string): Promise<CardList[]> {
  const encodedUserId = encodeURIComponent(userId);
  const response = await fetch(`${BACKEND_BASE_URL}/api/lists?userId=${encodedUserId}`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`List fetch failed with ${response.status}`);
  }
  return response.json();
}

async function fetchListCards(userId: string, listId: number): Promise<ListCardItem[]> {
  const encodedUserId = encodeURIComponent(userId);
  const response = await fetch(
    `${BACKEND_BASE_URL}/api/lists/${listId}/cards?userId=${encodedUserId}`,
    {
      credentials: "include",
    }
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

export default function ChatroomsScreen() {
  const { user, loading: authLoading } = useAuth();
  const { width } = useWindowDimensions();
  const isCompactLayout = width < 760;
  const isVeryNarrow = width < 500;
  const sellerCardColumns = width >= 900 ? 5 : width >= 700 ? 4 : width >= 430 ? 3 : 2;
  const sellerCardWidth = Math.max(90, (width - 80 - (sellerCardColumns - 1) * 8) / sellerCardColumns);
  const normalizedUserId = user?.userId?.trim() ?? "";

  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newRoomName, setNewRoomName] = useState("");
  const [newMessageText, setNewMessageText] = useState("");
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState("");
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [selectedSellerName, setSelectedSellerName] = useState<string | null>(null);
  const [sellerLists, setSellerLists] = useState<CardList[]>([]);
  const [sellerListsLoading, setSellerListsLoading] = useState(false);
  const [sellerError, setSellerError] = useState("");
  const [expandedSellerListId, setExpandedSellerListId] = useState<number | null>(null);
  const [sellerCardsByListId, setSellerCardsByListId] = useState<Record<number, ListCardDisplay[]>>({});
  const [loadingSellerCardsForListId, setLoadingSellerCardsForListId] = useState<number | null>(null);

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId]
  );

  const loadRooms = useCallback(async () => {
    setRoomsLoading(true);
    setError("");
    try {
      const nextRooms = await fetchRooms();
      setRooms(nextRooms);
      if (nextRooms.length === 0) {
        setSelectedRoomId(null);
        return;
      }

      const hasSelectedRoom = selectedRoomId
        ? nextRooms.some((room) => room.id === selectedRoomId)
        : false;
      if (hasSelectedRoom) {
        return;
      }

      const defaultRoom = nextRooms.find((room) => room.roomKey.toLowerCase() === "trades");
      setSelectedRoomId(defaultRoom?.id ?? nextRooms[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load rooms");
    } finally {
      setRoomsLoading(false);
    }
  }, [selectedRoomId]);

  const loadMessages = useCallback(async (roomId: number, showLoading = false) => {
    if (showLoading) {
      setMessagesLoading(true);
    }
    setError("");
    try {
      const nextMessages = await fetchMessages(roomId);
      setMessages(nextMessages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load messages");
    } finally {
      if (showLoading) {
        setMessagesLoading(false);
      }
    }
  }, []);

  async function handleCreateRoom() {
    const normalizedRoomName = newRoomName.trim();
    if (!normalizedRoomName || creatingRoom) return;

    setCreatingRoom(true);
    setError("");
    try {
      const createdRoom = await createRoom(normalizedRoomName);
      setRooms((prev) => [...prev, createdRoom].sort((a, b) => a.roomKey.localeCompare(b.roomKey)));
      setSelectedRoomId(createdRoom.id);
      setNewRoomName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create room");
    } finally {
      setCreatingRoom(false);
    }
  }

  async function handleSendMessage() {
    const normalizedText = newMessageText.trim();
    if (!selectedRoomId || !normalizedText || sendingMessage) return;
    if (!normalizedUserId) {
      setError("Could not determine current user id");
      return;
    }

    setSendingMessage(true);
    setError("");
    try {
      const createdMessage = await sendMessage(
        selectedRoomId,
        normalizedText,
        normalizedUserId,
        user?.name?.trim() || normalizedUserId
      );
      setMessages((prev) => [...prev, createdMessage]);
      setNewMessageText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send message");
    } finally {
      setSendingMessage(false);
    }
  }

  async function openSellerLists(senderId: string, senderName: string) {
    setSelectedSellerId(senderId);
    setSelectedSellerName(senderName);
    setSellerLists([]);
    setSellerCardsByListId({});
    setExpandedSellerListId(null);
    setSellerError("");
    setSellerListsLoading(true);
    try {
      const nextLists = await fetchLists(senderId);
      setSellerLists(nextLists);
    } catch (err) {
      setSellerError(err instanceof Error ? err.message : "Could not load this user's lists");
    } finally {
      setSellerListsLoading(false);
    }
  }

  function closeSellerModal() {
    setSelectedSellerId(null);
    setSelectedSellerName(null);
    setSellerLists([]);
    setSellerCardsByListId({});
    setExpandedSellerListId(null);
    setSellerError("");
    setLoadingSellerCardsForListId(null);
  }

  async function handleToggleSellerList(listId: number) {
    if (!selectedSellerId) return;

    if (expandedSellerListId === listId) {
      setExpandedSellerListId(null);
      return;
    }

    setExpandedSellerListId(listId);
    if (sellerCardsByListId[listId]) {
      return;
    }

    setLoadingSellerCardsForListId(listId);
    setSellerError("");
    try {
      const cards = await fetchListCards(selectedSellerId, listId);
      const cardsWithDisplay = await Promise.all(cards.map((card) => resolveListCardDisplay(card)));
      setSellerCardsByListId((prev) => ({ ...prev, [listId]: cardsWithDisplay }));
    } catch (err) {
      setSellerError(err instanceof Error ? err.message : "Could not load cards for this list");
    } finally {
      setLoadingSellerCardsForListId(null);
    }
  }

  useEffect(() => {
    if (!user?.authenticated) {
      setRooms([]);
      setMessages([]);
      setSelectedRoomId(null);
      return;
    }
    loadRooms();
  }, [loadRooms, user?.authenticated]);

  useEffect(() => {
    if (!selectedRoomId || !user?.authenticated) {
      setMessages([]);
      return;
    }

    loadMessages(selectedRoomId, true);
    const intervalId = setInterval(() => {
      loadMessages(selectedRoomId);
    }, 4000);

    return () => clearInterval(intervalId);
  }, [loadMessages, selectedRoomId, user?.authenticated]);

  return (
    <>
      <Stack.Screen options={{ title: "Chatrooms" }} />
      <View style={styles.container}>
        <Text style={styles.title}>Chatrooms</Text>

        {authLoading ? (
          <ActivityIndicator color="#fff" />
        ) : !user?.authenticated ? (
          <Text style={styles.meta}>Sign in from Profile to view and send chat messages.</Text>
        ) : !normalizedUserId ? (
          <Text style={styles.meta}>Signed in, but no usable user id was returned by OAuth.</Text>
        ) : (
          <View style={[styles.chatLayout, isCompactLayout && styles.chatLayoutCompact]}>
            <View style={[styles.roomPanel, isCompactLayout && styles.roomPanelCompact]}>
              <Text style={styles.sectionTitle}>Rooms</Text>
              <View style={[styles.row, isVeryNarrow && styles.rowStacked]}>
                <TextInput
                  value={newRoomName}
                  onChangeText={setNewRoomName}
                  placeholder="New room name"
                  placeholderTextColor="#8d8d8d"
                  style={[styles.input, styles.roomInput]}
                />
                <Pressable
                  onPress={handleCreateRoom}
                  disabled={!newRoomName.trim() || creatingRoom}
                  style={[
                    styles.primaryButton,
                    isVeryNarrow && styles.fullWidthButton,
                    (!newRoomName.trim() || creatingRoom) && styles.disabled,
                  ]}
                >
                  <Text style={styles.primaryButtonText}>{creatingRoom ? "..." : "Create"}</Text>
                </Pressable>
              </View>
              <Pressable
                onPress={loadRooms}
                disabled={roomsLoading}
                style={[styles.secondaryButton, roomsLoading && styles.disabled]}
              >
                <Text style={styles.secondaryButtonText}>Refresh Rooms</Text>
              </Pressable>

              <ScrollView style={styles.roomList}>
                {roomsLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  rooms.map((room) => (
                    <Pressable
                      key={room.id}
                      onPress={() => setSelectedRoomId(room.id)}
                      style={[
                        styles.roomItem,
                        selectedRoomId === room.id && styles.roomItemSelected,
                      ]}
                    >
                      <Text style={styles.roomName}>{room.roomKey}</Text>
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </View>

            <View style={styles.messagesPanel}>
              <Text style={styles.sectionTitle}>
                {selectedRoom ? `${selectedRoom.roomKey} chat` : "Select a room"}
              </Text>
              {!!error && <Text style={styles.error}>{error}</Text>}
              <ScrollView style={styles.messagesList} contentContainerStyle={styles.messagesContent}>
                {selectedRoomId === null ? (
                  <Text style={styles.meta}>Choose or create a room to view messages.</Text>
                ) : messagesLoading && messages.length === 0 ? (
                  <Text style={styles.meta}>Loading messages...</Text>
                ) : messages.length === 0 ? (
                  <Text style={styles.meta}>No messages yet.</Text>
                ) : (
                  messages.map((message) => {
                    const isOwnMessage = message.senderId === normalizedUserId;
                    return (
                      <Pressable
                        key={message.id}
                        disabled={isOwnMessage}
                        onPress={() => openSellerLists(message.senderId, message.senderName)}
                        style={isOwnMessage ? undefined : styles.otherMessagePressable}
                      >
                        <View
                          style={[
                            styles.messageBubble,
                            isOwnMessage ? styles.myMessageBubble : styles.otherMessageBubble,
                          ]}
                        >
                          <Text style={styles.messageSender}>{message.senderName}</Text>
                          <Text style={styles.messageText}>{message.text}</Text>
                          {!isOwnMessage && (
                            <Text style={styles.messageHint}>Tap to view trade lists</Text>
                          )}
                        </View>
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>

              <View style={[styles.row, isVeryNarrow && styles.rowStacked]}>
                <TextInput
                  value={newMessageText}
                  onChangeText={setNewMessageText}
                  placeholder="Type a message..."
                  placeholderTextColor="#8d8d8d"
                  style={[styles.input, styles.messageInput]}
                />
                <Pressable
                  onPress={handleSendMessage}
                  disabled={!selectedRoomId || !newMessageText.trim() || sendingMessage}
                  style={[
                    styles.primaryButton,
                    isVeryNarrow && styles.fullWidthButton,
                    (!selectedRoomId || !newMessageText.trim() || sendingMessage) && styles.disabled,
                  ]}
                >
                  <Text style={styles.primaryButtonText}>{sendingMessage ? "..." : "Send"}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </View>
      <Modal
        visible={!!selectedSellerId}
        transparent
        animationType="fade"
        onRequestClose={closeSellerModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, isVeryNarrow && styles.modalCardNarrow]}>
            <View style={[styles.modalHeader, isVeryNarrow && styles.modalHeaderNarrow]}>
              <Text style={styles.modalTitle}>{`${selectedSellerName || "Trader"}'s lists`}</Text>
              <Pressable
                onPress={closeSellerModal}
                style={[styles.modalCloseButton, isVeryNarrow && styles.fullWidthButton]}
              >
                <Text style={styles.modalCloseButtonText}>Close</Text>
              </Pressable>
            </View>

            {!!sellerError && <Text style={styles.error}>{sellerError}</Text>}

            <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
              {sellerListsLoading ? (
                <Text style={styles.meta}>Loading lists...</Text>
              ) : sellerLists.length === 0 ? (
                <Text style={styles.meta}>No lists found for this user.</Text>
              ) : (
                sellerLists.map((list) => {
                  const isExpanded = expandedSellerListId === list.id;
                  const isLoadingCards = loadingSellerCardsForListId === list.id;
                  const cards = sellerCardsByListId[list.id] ?? [];
                  return (
                    <View key={list.id} style={styles.sellerListCard}>
                      <Pressable onPress={() => handleToggleSellerList(list.id)}>
                        <Text style={styles.sellerListName}>{list.name}</Text>
                        <Text style={styles.sellerListMeta}>
                          {isExpanded ? "Tap to hide cards" : "Tap to view cards"}
                        </Text>
                      </Pressable>

                      {isExpanded && (
                        <View style={styles.sellerCardsArea}>
                          {isLoadingCards ? (
                            <Text style={styles.meta}>Loading cards...</Text>
                          ) : cards.length === 0 ? (
                            <Text style={styles.meta}>No cards in this list.</Text>
                          ) : (
                            <View style={styles.sellerCardsGrid}>
                              {cards.map((card) => (
                                <View key={card.id} style={[styles.sellerCardItem, { width: sellerCardWidth }]}>
                                  {card.image ? (
                                    <Image source={{ uri: card.image }} style={styles.sellerCardImage} />
                                  ) : (
                                    <View style={styles.sellerCardImageFallback}>
                                      <Text style={styles.sellerCardImageFallbackText}>No image</Text>
                                    </View>
                                  )}
                                  <Text style={styles.sellerCardName} numberOfLines={2}>
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
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 12,
  },
  meta: {
    color: "#999",
    fontSize: 12,
  },
  chatLayout: {
    flex: 1,
    flexDirection: "row",
    gap: 12,
  },
  chatLayoutCompact: {
    flexDirection: "column",
  },
  roomPanel: {
    width: 260,
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 10,
    backgroundColor: "#1b1b1b",
    padding: 10,
    gap: 8,
  },
  roomPanelCompact: {
    width: "100%",
    maxHeight: 300,
  },
  messagesPanel: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 10,
    backgroundColor: "#1b1b1b",
    padding: 10,
    gap: 8,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  rowStacked: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  input: {
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 8,
    backgroundColor: "#222",
    color: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  roomInput: {
    flex: 1,
  },
  messageInput: {
    flex: 1,
  },
  primaryButton: {
    backgroundColor: "#2f6df5",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
    textAlign: "center",
  },
  secondaryButton: {
    backgroundColor: "#2a2a2a",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
  },
  secondaryButtonText: {
    color: "#ddd",
    fontWeight: "700",
    fontSize: 12,
  },
  disabled: {
    opacity: 0.6,
  },
  roomList: {
    flex: 1,
  },
  roomItem: {
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 8,
    backgroundColor: "#222",
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 7,
  },
  roomItemSelected: {
    borderColor: "#2f6df5",
    backgroundColor: "#20335f",
  },
  roomName: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingVertical: 4,
    gap: 8,
  },
  messageBubble: {
    maxWidth: "80%",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
  },
  myMessageBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#2f6df5",
    borderColor: "#2f6df5",
  },
  otherMessageBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#2a2a2a",
    borderColor: "#444",
  },
  otherMessagePressable: {
    alignSelf: "flex-start",
  },
  messageSender: {
    color: "#d8e5ff",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 2,
  },
  messageText: {
    color: "#fff",
    fontSize: 13,
  },
  messageHint: {
    color: "#c9c9c9",
    fontSize: 10,
    marginTop: 4,
  },
  error: {
    color: "#ff9696",
    fontSize: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 900,
    maxHeight: "90%",
    backgroundColor: "#1b1b1b",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  modalCardNarrow: {
    padding: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  modalHeaderNarrow: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  modalTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    flex: 1,
  },
  modalCloseButton: {
    backgroundColor: "#2a2a2a",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  modalCloseButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  fullWidthButton: {
    width: "100%",
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    gap: 8,
    paddingBottom: 8,
  },
  sellerListCard: {
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 8,
    backgroundColor: "#222",
    padding: 10,
  },
  sellerListName: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  sellerListMeta: {
    color: "#aaa",
    fontSize: 11,
  },
  sellerCardsArea: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#333",
    paddingTop: 8,
  },
  sellerCardsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  sellerCardItem: {
    minWidth: 0,
  },
  sellerCardImage: {
    width: "100%",
    aspectRatio: 0.72,
    borderRadius: 6,
    backgroundColor: "#2a2a2a",
  },
  sellerCardImageFallback: {
    width: "100%",
    aspectRatio: 0.72,
    borderRadius: 6,
    backgroundColor: "#262626",
    borderWidth: 1,
    borderColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
  sellerCardImageFallbackText: {
    color: "#8f8f8f",
    fontSize: 11,
    fontWeight: "600",
  },
  sellerCardName: {
    color: "#ddd",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 6,
  },
});
