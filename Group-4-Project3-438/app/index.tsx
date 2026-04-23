import { Text, View, Pressable } from "react-native";
import { Stack, useRouter } from "expo-router";

export default function Index() {
  const router = useRouter();
  return ( <>
    <Stack.Screen
      options={{
        headerRight: () => (
          <Pressable
            onPress={() => {
              router.push("/profile");
            }}
            style={{ marginRight: 15 }}
          >
            <Text style={{ fontWeight: "bold" }}>Profile</Text>
          </Pressable>
        ),
      }}
    />

    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text>This is where all the cards will be... eventually!</Text>
    </View>
  </>
  );
}
