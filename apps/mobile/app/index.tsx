import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { supabase } from "../src/lib/supabase";
import { api } from "../src/lib/api";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [health, setHealth] = useState("…");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .health()
      .then((r) => setHealth(r.data?.service ?? "ok"))
      .catch(() => setHealth("API offline"));

    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSessionEmail(data.session?.user.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSessionEmail(session?.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn() {
    if (!supabase) {
      setError("Set EXPO_PUBLIC_SUPABASE_* in .env");
      return;
    }
    setBusy(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (err) setError(err.message);
  }

  async function signUp() {
    if (!supabase) {
      setError("Set EXPO_PUBLIC_SUPABASE_* in .env");
      return;
    }
    setBusy(true);
    setError("");
    const { error: err } = await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (err) setError(err.message);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FinanceApp</Text>
      <Text style={styles.muted}>API: {health}</Text>

      {sessionEmail ? (
        <>
          <Text style={styles.ok}>Signed in as {sessionEmail}</Text>
          <Pressable style={styles.btnSecondary} onPress={() => supabase?.auth.signOut()}>
            <Text style={styles.btnTextLight}>Sign out</Text>
          </Pressable>
        </>
      ) : (
        <>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="Email"
            placeholderTextColor="#9db0d0"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            secureTextEntry
            placeholder="Password"
            placeholderTextColor="#9db0d0"
            value={password}
            onChangeText={setPassword}
          />
          {busy ? (
            <ActivityIndicator color="#14b8a6" />
          ) : (
            <View style={styles.row}>
              <Pressable style={styles.btn} onPress={signIn}>
                <Text style={styles.btnText}>Sign in</Text>
              </Pressable>
              <Pressable style={styles.btnSecondary} onPress={signUp}>
                <Text style={styles.btnTextLight}>Sign up</Text>
              </Pressable>
            </View>
          )}
        </>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.hint}>
        Log into Expo CLI on your machine: npx expo login
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b1220", padding: 24, justifyContent: "center", gap: 12 },
  title: { color: "#e8eefc", fontSize: 28, fontWeight: "700" },
  muted: { color: "#9db0d0", marginBottom: 8 },
  ok: { color: "#14b8a6" },
  error: { color: "#f87171" },
  hint: { color: "#64748b", marginTop: 24, fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    padding: 12,
    color: "#e8eefc",
    backgroundColor: "#0f172a",
  },
  row: { flexDirection: "row", gap: 10 },
  btn: { backgroundColor: "#14b8a6", padding: 12, borderRadius: 12, flex: 1, alignItems: "center" },
  btnSecondary: {
    backgroundColor: "#1e293b",
    padding: 12,
    borderRadius: 12,
    flex: 1,
    alignItems: "center",
  },
  btnText: { color: "#042f2e", fontWeight: "700" },
  btnTextLight: { color: "#e8eefc", fontWeight: "600" },
});
