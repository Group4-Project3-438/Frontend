import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { AuthProvider, useAuth } from "./auth-context";

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

function RootNavigator() {
  const router = useRouter();
  const { user, loading } = useAuth();

  return (
    <Stack
      screenOptions={{
        headerTitle: () => {
          if (loading) {
            return <Text style={{ fontSize: 12 }}>...</Text>;
          }

          return (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.navScroller}>
              <View style={styles.navRow}>
                <Pressable onPress={() => router.push("/" as any)} style={styles.navItem}>
                  <Text style={styles.navText}>Home</Text>
                </Pressable>
                <Pressable onPress={() => router.push("/chatrooms" as any)} style={styles.navItem}>
                  <Text style={styles.navText}>Chatrooms</Text>
                </Pressable>
                <Pressable onPress={() => router.push("/lists" as any)} style={styles.navItem}>
                  <Text style={styles.navText}>Lists</Text>
                </Pressable>
                <Pressable onPress={() => router.push("/profile")} style={styles.navItem}>
                  <Text style={styles.navText}>{user?.authenticated ? "Profile" : "Sign In"}</Text>
                </Pressable>
              </View>
            </ScrollView>
          );
        },
      }}
    />
  );
}

const styles = StyleSheet.create({
  navScroller: {
    paddingRight: 4,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  navItem: {
    minHeight: 28,
    borderRadius: 12,
    paddingHorizontal: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f2f2f2",
  },
  navText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1e1e1e",
  },
});
