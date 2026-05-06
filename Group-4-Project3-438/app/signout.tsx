import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useAuth } from "./auth-context";

export default function SignOutScreen() {
  const router = useRouter();
  const { user, signOut, refreshAuth } = useAuth();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  async function handleSignOut() {
    setWorking(true);
    setError("");
    try {
      await signOut();
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign out failed");
    } finally {
      setWorking(false);
    }
  }

  async function handleRefresh() {
    setWorking(true);
    setError("");
    try {
      await refreshAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setWorking(false);
    }
  }

  const label = user?.name?.trim() || user?.email?.trim() || "Unknown";
  const isSignedIn = !!user?.authenticated;

  return (
    <>
      <Stack.Screen options={{ title: "Account" }} />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Account</Text>
        <View style={styles.card}>
          <Text style={styles.label}>{isSignedIn ? "Signed in" : "Signed out"}</Text>
          <Text style={styles.value}>{isSignedIn ? label : "No active session"}</Text>
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          onPress={handleRefresh}
          disabled={working}
          style={[styles.secondaryButton, working && styles.buttonDisabled]}
        >
          {working ? <ActivityIndicator color="#ddd" /> : <Text style={styles.secondaryButtonText}>Refresh Session</Text>}
        </Pressable>

        <Pressable
          onPress={handleSignOut}
          disabled={working || !isSignedIn}
          style={[styles.dangerButton, (working || !isSignedIn) && styles.buttonDisabled]}
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
  error: {
    color: "#ff9696",
    marginBottom: 2,
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
});
