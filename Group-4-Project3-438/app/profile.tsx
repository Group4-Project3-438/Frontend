import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Stack } from "expo-router";
import * as ExpoLinking from "expo-linking";
import { useAuth } from "./auth-context";
import { resolveCardById, type ResolvedCard } from "./card-resolver";

const BACKEND_BASE_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL?.replace(/\/+$/, "") ??
  "http://localhost:8082";

type FavoriteCard = {
  id: number;
  userId: string;
  cardId: string;
};

type FavoriteCardDisplay = FavoriteCard & {
  image: ResolvedCard["image"];
  name: ResolvedCard["name"];
  source: ResolvedCard["source"];
};

async function fetchFavorites(userId: string): Promise<FavoriteCard[]> {
  const encodedUserId = encodeURIComponent(userId);
  const response = await fetch(`${BACKEND_BASE_URL}/api/favorites?userId=${encodedUserId}`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Favorites fetch failed with ${response.status}`);
  }

  return response.json();
}

async function resolveFavoriteCardDisplay(favorite: FavoriteCard): Promise<FavoriteCardDisplay> {
  const resolved = await resolveCardById(favorite.cardId);
  return { ...favorite, ...resolved };
}

export default function Profile() {
  const { user, loading, refreshAuth, signOut } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState("");
  const [favorites, setFavorites] = useState<FavoriteCardDisplay[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const favoriteColumns = screenWidth >= 900 ? 5 : screenWidth >= 700 ? 4 : screenWidth >= 430 ? 3 : 2;
  const favoriteCardWidth = (screenWidth - 32 - 12 - (favoriteColumns - 1) * 8) / favoriteColumns;

  useEffect(() => {
    async function loadFavorites() {
      const actionUserId = user?.userId?.trim();
      if (!user?.authenticated || !actionUserId) {
        setFavorites([]);
        return;
      }
      setFavoritesLoading(true);
      try {
        const nextFavorites = await fetchFavorites(actionUserId);
        const nextFavoriteDisplays = await Promise.all(
          nextFavorites.map((favorite) => resolveFavoriteCardDisplay(favorite))
        );
        setFavorites(nextFavoriteDisplays);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load favorites");
      } finally {
        setFavoritesLoading(false);
      }
    }

    loadFavorites();
  }, [user?.authenticated, user?.email]);

  async function handleSignIn(provider: "google" | "github") {
    setAuthLoading(true);
    setError("");
    try {
      const authUrl =
        Platform.OS === "web"
          ? `${BACKEND_BASE_URL}/oauth2/authorization/${provider}`
          : `${BACKEND_BASE_URL}/api/auth/oauth2/start/${provider}?redirectUri=${encodeURIComponent(
              ExpoLinking.createURL("/profile")
            )}`;
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.location.href = authUrl;
      } else {
        const canOpen = await Linking.canOpenURL(authUrl);
        if (!canOpen) {
          throw new Error("Could not open OAuth URL");
        }
        await Linking.openURL(authUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSignOut() {
    setAuthLoading(true);
    setError("");
    try {
      await signOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign out failed");
    } finally {
      setAuthLoading(false);
    }
  }

  const isAuthenticated = !!user?.authenticated;

  return (
    <>
      <Stack.Screen options={{ title: "Profile" }} />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Profile</Text>

        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : isAuthenticated ? (
          <View style={styles.card}>
            <Text style={styles.label}>Signed in</Text>
            <Text style={styles.value}>{user?.name || "Unknown user"}</Text>
            <Text style={styles.subValue}>{user?.email || "No email provided"}</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.label}>Not signed in</Text>
            <Text style={styles.subValue}>
              Tap a provider to open browser sign-in, then come back and refresh session.
            </Text>
          </View>
        )}

        {!!error && <Text style={styles.error}>{error}</Text>}

        {!isAuthenticated ? (
          <>
            <Pressable
              onPress={() => handleSignIn("google")}
              disabled={authLoading}
              style={[styles.button, authLoading && styles.buttonDisabled]}
            >
              <Text style={styles.buttonText}>Continue with Google</Text>
            </Pressable>

            <Pressable
              onPress={() => handleSignIn("github")}
              disabled={authLoading}
              style={[styles.button, authLoading && styles.buttonDisabled]}
            >
              <Text style={styles.buttonText}>Continue with GitHub</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.card}>
            <Text style={styles.label}>Favorited cards</Text>
            {favoritesLoading ? (
              <ActivityIndicator color="#fff" />
            ) : favorites.length === 0 ? (
              <Text style={styles.subValue}>No favorites yet.</Text>
            ) : (
              <View style={styles.favoriteGrid}>
                {favorites.map((favorite) => (
                  <View key={favorite.id} style={[styles.favoriteCard, { width: favoriteCardWidth }]}>
                    {favorite.image ? (
                      <Image source={{ uri: favorite.image }} style={styles.favoriteImage} />
                    ) : (
                      <View style={styles.favoriteImageFallback}>
                        <Text style={styles.favoriteImageFallbackText}>No image</Text>
                      </View>
                    )}
                    <Text style={styles.favoriteName} numberOfLines={2}>
                      {favorite.name || favorite.cardId}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        <Pressable
          onPress={async () => {
            setError("");
            await refreshAuth();
          }}
          disabled={loading || authLoading}
          style={[styles.secondaryButton, (loading || authLoading) && styles.buttonDisabled]}
        >
          <Text style={styles.secondaryButtonText}>Refresh Session</Text>
        </Pressable>

        <Pressable
          onPress={handleSignOut}
          disabled={!isAuthenticated || authLoading}
          style={[styles.dangerButton, (!isAuthenticated || authLoading) && styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>Sign Out</Text>
        </Pressable>
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
    gap: 10,
  },
  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 6,
  },
  card: {
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 8,
    backgroundColor: "#1b1b1b",
    padding: 12,
    marginBottom: 6,
  },
  label: {
    color: "#ddd",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  value: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  subValue: {
    color: "#aaa",
    fontSize: 12,
    marginTop: 2,
  },
  error: {
    color: "#ff9696",
    marginBottom: 2,
  },
  button: {
    backgroundColor: "#2f6df5",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  secondaryButton: {
    backgroundColor: "#2a2a2a",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  dangerButton: {
    backgroundColor: "#8f2c2c",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
  secondaryButtonText: {
    color: "#ddd",
    fontWeight: "700",
  },
  favoriteGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  favoriteCard: {
    minWidth: 0,
  },
  favoriteImage: {
    width: "100%",
    aspectRatio: 0.72,
    borderRadius: 6,
    backgroundColor: "#2a2a2a",
  },
  favoriteImageFallback: {
    width: "100%",
    aspectRatio: 0.72,
    borderRadius: 6,
    backgroundColor: "#262626",
    borderWidth: 1,
    borderColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
  favoriteImageFallbackText: {
    color: "#8f8f8f",
    fontSize: 11,
    fontWeight: "600",
  },
  favoriteName: {
    color: "#ddd",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 6,
  },
});