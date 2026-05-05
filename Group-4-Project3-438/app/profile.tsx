import { useState } from "react";
import {View, Text, TextInput, Image, Pressable, StyleSheet, FlatList,} from "react-native";
import * as ImagePicker from "expo-image-picker";

const TAG_OPTIONS = [
  "Pokemon",
  "Yugioh",
  "Riftfall",
  "Magic the Gathering",
  "Looking to Play",
  "Looking to Sell",
  "Looking to Buy",
];

export default function Profile() {
  const [image, setImage] = useState<string | null>(null);
  const [username, setUsername] = useState("Player 1");
  const [tags, setTags] = useState<string[]>([]);
  const [favoriteCards, setFavoriteCards] = useState<string[]>([
    "Charizard",
    "Black Lotus",
  ]);
  const [newCard, setNewCard] = useState("");
  const [editing, setEditing] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : [...prev, tag]
    );
  };

  const addCard = () => {
    if (!newCard.trim()) return;
    setFavoriteCards((prev) => [...prev, newCard.trim()]);
    setNewCard("");
  };

  const removeCard = (card: string) => {
    setFavoriteCards((prev) => prev.filter((c) => c !== card));
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{username}</Text>

        <Pressable
          onPress={() => setEditing((e) => !e)}
          style={styles.editBtn}
        >
          <Text style={styles.editText}>
            {editing ? "Done" : "Edit"}
          </Text>
        </Pressable>
      </View>

      {/* Avatar */}
      <Pressable onPress={editing ? pickImage : undefined}>
        <Image
          source={
            image
              ? { uri: image }
              : require("../assets/images/default-avatar.jpg")
          }
          style={styles.avatar}
        />
      </Pressable>

      {/* Username */}
      {editing ? (
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
        />
      ) : (
        <Text style={styles.username}>{username}</Text>
      )}

      {/* Tags */}
      <Text style={styles.section}>Tags</Text>

      <View style={styles.tagContainer}>
        {(editing ? TAG_OPTIONS : tags).map((tag) => (
          <Pressable
            key={tag}
            onPress={() => editing && toggleTag(tag)}
            style={[
              styles.tag,
              tags.includes(tag) && styles.tagActive,
            ]}
          >
            <Text
              style={
                tags.includes(tag)
                  ? styles.tagTextActive
                  : styles.tagText
              }
            >
              {tag}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Favorite Cards */}
      <Text style={styles.section}>Favorite Cards</Text>

      {editing && (
        <View style={styles.row}>
          <TextInput
            value={newCard}
            onChangeText={setNewCard}
            placeholder="Add card"
            placeholderTextColor="#888"
            style={styles.input}
          />
          <Pressable onPress={addCard} style={styles.addBtn}>
            <Text style={{ color: "#fff" }}>Add</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={favoriteCards}
        keyExtractor={(item) => item}
        numColumns={2}
        columnWrapperStyle={{ gap: 10 }}
        renderItem={({ item }) => (
          <Pressable
            onLongPress={() => editing && removeCard(item)}
            style={styles.card}
          >
            <Text style={styles.cardText}>{item}</Text>
            {editing && (
              <Text style={styles.removeHint}>hold to remove</Text>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b1220",
    padding: 16,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
  },

  editBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#3b82f6",
    borderRadius: 6,
  },

  editText: {
    color: "#fff",
    fontWeight: "600",
  },

  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignSelf: "center",
    marginVertical: 10,
  },

  username: {
    color: "#fff",
    fontSize: 18,
    textAlign: "center",
    marginBottom: 10,
  },

  input: {
    backgroundColor: "#111a2e",
    borderWidth: 1,
    borderColor: "#1f2a44",
    color: "#fff",
    padding: 10,
    borderRadius: 8,
    marginVertical: 6,
  },

  section: {
    color: "#aaa",
    marginTop: 10,
    marginBottom: 6,
    fontWeight: "600",
  },

  tagContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },

  tag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#1f2a44",
    borderRadius: 20,
  },

  tagActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },

  tagText: {
    color: "#ccc",
    fontSize: 12,
  },

  tagTextActive: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },

  row: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },

  addBtn: {
    backgroundColor: "#3b82f6",
    padding: 10,
    borderRadius: 6,
  },

  card: {
    flex: 1,
    backgroundColor: "#111a2e",
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },

  cardText: {
    color: "#fff",
    fontWeight: "600",
  },

  removeHint: {
    color: "#888",
    fontSize: 10,
    marginTop: 4,
  },
});