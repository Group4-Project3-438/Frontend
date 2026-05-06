import { Pressable, Text, View } from "react-native";
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
        headerRight: () => {
          if (loading) {
            return <Text style={{ fontSize: 12 }}>...</Text>;
          }

          return (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginRight: 8 }}>
              <Pressable onPress={() => router.push("/lists" as any)}>
                <Text style={{ fontSize: 12, fontWeight: "700" }}>Lists</Text>
              </Pressable>
              <Pressable onPress={() => router.push("/profile")}>
                <Text style={{ fontSize: 12, fontWeight: "700" }}>
                  {user?.authenticated ? "Profile" : "Sign In"}
                </Text>
              </Pressable>
            </View>
          );
        },
      }}
    />
  );
}
