import { StyleSheet, Text, View } from "react-native";

export default function Payments() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Payments</Text>
      <Text style={styles.text}>
        BNPL payment page will be developed next.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7FAFB",
    alignItems: "center",
    justifyContent: "center",
  },

  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#17313C",
  },

  text: {
    marginTop: 10,
    color: "#84969E",
  },
});