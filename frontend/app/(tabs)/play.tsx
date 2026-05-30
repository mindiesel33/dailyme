import React, { useCallback, useState } from "react";
import { View, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useI18n } from "@/src/i18n";
import { Text, Button, Card } from "@/src/components/ui";
import { colors, fonts, spacing, radius } from "@/src/theme";

type Category = { key: string; label: string };

export default function Play() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState<any>(null);
  const [trivia, setTrivia] = useState<any>(null);
  const [challenge, setChallenge] = useState<any>(null);
  const [wager, setWager] = useState<any>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  const load = useCallback(async () => {
    try {
      const [q, tr, ch, w, cats] = await Promise.all([
        api.get(`/daily/question?lang=${lang}`),
        api.get(`/daily/trivia?lang=${lang}`),
        api.get(`/weekly/challenge?lang=${lang}`),
        api.get("/weekly/wager"),
        api.get(`/daily/trivia/categories?lang=${lang}`),
      ]);
      setQuestion(q);
      setTrivia(tr);
      setChallenge(ch);
      setWager(w.wager);
      setCategories(cats.categories);
    } catch (e) {
      console.log("play load error", e);
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAwareScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: 140 }}
      bottomOffset={20}
      showsVerticalScrollIndicator={false}
    >
      <Text weight="heading" style={styles.title}>
        {t("play.title")}
      </Text>
      <Text weight="body" style={styles.subtitle}>
        {t("play.subtitle")}
      </Text>

      <WagerCard wager={wager} userId={user?.user_id} reload={load} t={t} />
      <QuestionCard question={question} userId={user?.user_id} reload={load} t={t} lang={lang} />
      <TriviaCard trivia={trivia} categories={categories} reload={load} t={t} lang={lang} />
      <ChallengeCard challenge={challenge} reload={load} t={t} lang={lang} />
    </KeyboardAwareScrollView>
  );
}

function WagerCard({ wager, userId, reload, t }: any) {
  const [stake, setStake] = useState("");
  const [busy, setBusy] = useState(false);

  const propose = async () => {
    if (stake.trim().length < 3) {
      Alert.alert(t("play.setStake"), t("play.setStakeMsg"));
      return;
    }
    setBusy(true);
    try {
      await api.post("/weekly/wager", { stake: stake.trim() });
      setStake("");
      reload();
    } catch (e: any) {
      Alert.alert(t("play.couldntPropose"), e.message);
    } finally {
      setBusy(false);
    }
  };

  const respond = async (action: "accept" | "decline") => {
    setBusy(true);
    try {
      await api.post(`/weekly/wager/${action}`);
      reload();
    } catch (e: any) {
      Alert.alert(t("common.oops"), e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={[styles.card, { backgroundColor: colors.text }]}>
      <View style={styles.rowBetween}>
        <View style={styles.rowGap}>
          <Ionicons name="trophy" size={18} color={colors.sunshine} />
          <Text weight="bodyBold" style={{ color: "#fff", fontSize: 16 }}>
            {t("play.wagerTitle")}
          </Text>
        </View>
        <View style={styles.weekTag}>
          <Text weight="bodySemi" style={{ color: colors.sunshine, fontSize: 11 }}>
            {t("play.monSun")}
          </Text>
        </View>
      </View>

      {!wager || wager.status === "declined" ? (
        <View style={{ marginTop: spacing.md }}>
          <Text weight="body" style={styles.wagerHint}>
            {t("play.noWager")}
          </Text>
          <TextInput
            value={stake}
            onChangeText={setStake}
            placeholder={t("play.wagerPlaceholder")}
            placeholderTextColor="rgba(255,255,255,0.4)"
            style={styles.wagerInput}
            testID="wager-input"
          />
          <Button title={t("play.proposeWager")} onPress={propose} loading={busy} testID="propose-wager-btn" style={{ marginTop: spacing.sm }} />
        </View>
      ) : wager.status === "pending" ? (
        <View style={{ marginTop: spacing.md }}>
          <Text weight="bodySemi" style={styles.wagerStake}>
            “{wager.stake}”
          </Text>
          {wager.can_respond ? (
            <View style={styles.rowGap}>
              <Button title={t("play.accept")} onPress={() => respond("accept")} loading={busy} testID="accept-wager-btn" style={{ flex: 1 }} />
              <Button title={t("play.decline")} variant="secondary" onPress={() => respond("decline")} testID="decline-wager-btn" style={{ flex: 1 }} />
            </View>
          ) : (
            <View style={styles.rowGap}>
              <Ionicons name="hourglass-outline" size={16} color="rgba(255,255,255,0.7)" />
              <Text weight="body" style={{ color: "rgba(255,255,255,0.7)" }}>
                {t("play.waitingAccept")}
              </Text>
            </View>
          )}
        </View>
      ) : (
        <View style={{ marginTop: spacing.md }}>
          <View style={[styles.rowGap, { marginBottom: 4 }]}>
            <Ionicons name="checkmark-circle" size={16} color={colors.moss} />
            <Text weight="bodySemi" style={{ color: colors.moss }}>
              {t("play.wagerOn")}
            </Text>
          </View>
          <Text weight="bodySemi" style={styles.wagerStake}>
            “{wager.stake}”
          </Text>
        </View>
      )}
    </Card>
  );
}

function QuestionCard({ question, userId, reload, t, lang }: any) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  if (!question) return null;

  const answers = question.answers || {};
  const partnerId = Object.keys(answers).find((k) => k !== userId);
  const myAnswer = question.my_answer;

  const submit = async () => {
    if (text.trim().length < 1) return;
    setBusy(true);
    try {
      await api.post(`/daily/question/answer?lang=${lang}`, { answer: text.trim() });
      setText("");
      reload();
    } catch (e: any) {
      Alert.alert(t("common.oops"), e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={styles.card}>
      <View style={styles.rowBetween}>
        <View style={styles.rowGap}>
          <Ionicons name="chatbubble-ellipses" size={18} color={colors.terracotta} />
          <Text weight="bodyBold" style={styles.cardKicker}>
            {t("play.dailyQuestion")}
          </Text>
        </View>
        <Text weight="body" style={styles.justForFun}>
          {t("play.justForFun")}
        </Text>
      </View>
      <Text weight="headingSemi" style={styles.questionText}>
        {question.question}
      </Text>

      {myAnswer ? (
        <View style={styles.answerBlock}>
          <Text weight="caption" style={styles.answerLabel}>
            {t("play.you")}
          </Text>
          <Text weight="body" style={styles.answerText}>
            {myAnswer}
          </Text>
        </View>
      ) : (
        <View style={styles.answerRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t("play.answerPlaceholder")}
            placeholderTextColor={colors.textMuted}
            style={styles.qInput}
            testID="question-input"
          />
          <TouchableOpacity style={styles.sendBtn} onPress={submit} disabled={busy} testID="question-send-btn">
            {busy ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="arrow-up" size={20} color="#fff" />}
          </TouchableOpacity>
        </View>
      )}

      {partnerId && (
        <View style={[styles.answerBlock, { backgroundColor: colors.background }]}>
          <Text weight="caption" style={styles.answerLabel}>
            {t("play.partner")}
          </Text>
          <Text weight="body" style={styles.answerText}>
            {myAnswer ? answers[partnerId] : t("play.answerToReveal")}
          </Text>
        </View>
      )}
    </Card>
  );
}

function TriviaCard({ trivia, categories, reload, t, lang }: any) {
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  const generate = async (catKey: string) => {
    setBusy(true);
    setPicked(catKey);
    try {
      await api.post("/daily/trivia/generate", { category: catKey, lang });
      reload();
    } catch (e: any) {
      Alert.alert(t("play.couldntTrivia"), e.message);
    } finally {
      setBusy(false);
    }
  };

  const answer = async (idx: number) => {
    setBusy(true);
    try {
      await api.post(`/daily/trivia/answer?lang=${lang}`, { choice_index: idx });
      reload();
    } catch (e: any) {
      Alert.alert(t("common.oops"), e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={styles.card}>
      <View style={styles.rowBetween}>
        <View style={styles.rowGap}>
          <Ionicons name="bulb" size={18} color={colors.sunshine} />
          <Text weight="bodyBold" style={styles.cardKicker}>
            {t("play.dailyTrivia")}
          </Text>
        </View>
        <View style={styles.pointTag}>
          <Text weight="bodySemi" style={{ color: colors.primaryDark, fontSize: 11 }}>
            {t("play.pt1")}
          </Text>
        </View>
      </View>

      {!trivia?.exists ? (
        <View style={{ marginTop: spacing.sm }}>
          <Text weight="body" style={styles.triviaHint}>
            {t("play.pickCategory")}
          </Text>
          <View style={styles.catWrap}>
            {categories.map((c: Category) => (
              <TouchableOpacity
                key={c.key}
                style={[styles.catChip, picked === c.key && busy && { opacity: 0.5 }]}
                onPress={() => generate(c.key)}
                disabled={busy}
                testID={`trivia-cat-${c.key}`}
              >
                <Text weight="bodySemi" style={styles.catText}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {busy && <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />}
        </View>
      ) : (
        <View style={{ marginTop: spacing.sm }}>
          <View style={styles.catBadge}>
            <Text weight="bodySemi" style={{ color: colors.primaryDark, fontSize: 12 }}>
              {trivia.category}
            </Text>
          </View>
          <Text weight="headingSemi" style={styles.questionText}>
            {trivia.question}
          </Text>
          {trivia.options.map((opt: string, i: number) => {
            const answered = trivia.my_answer != null;
            const myChoice = trivia.my_answer?.choice_index;
            const isCorrect = trivia.correct_index === i;
            const isMine = myChoice === i;
            let bg = colors.background;
            let border = colors.border;
            if (answered) {
              if (isCorrect) {
                bg = "rgba(129,178,154,0.18)";
                border = colors.moss;
              } else if (isMine) {
                bg = colors.primaryLight;
                border = colors.primary;
              }
            }
            return (
              <TouchableOpacity
                key={i}
                style={[styles.option, { backgroundColor: bg, borderColor: border }]}
                disabled={answered || busy}
                onPress={() => answer(i)}
                testID={`trivia-option-${i}`}
              >
                <Text weight="body" style={styles.optionText}>
                  {opt}
                </Text>
                {answered && isCorrect && <Ionicons name="checkmark-circle" size={18} color={colors.moss} />}
                {answered && isMine && !isCorrect && <Ionicons name="close-circle" size={18} color={colors.primary} />}
              </TouchableOpacity>
            );
          })}
          {trivia.my_answer != null && (
            <Text weight="bodySemi" style={styles.triviaResult}>
              {trivia.my_answer.correct ? t("play.triviaCorrect") : t("play.triviaWrong")}
            </Text>
          )}
        </View>
      )}
    </Card>
  );
}

function ChallengeCard({ challenge, reload, t, lang }: any) {
  const [busy, setBusy] = useState(false);
  if (!challenge) return null;
  const mine = challenge.mine;

  const act = async (action: "accept" | "decline" | "complete") => {
    setBusy(true);
    try {
      await api.post(`/weekly/challenge/${action}?lang=${lang}`);
      reload();
    } catch (e: any) {
      Alert.alert(t("common.oops"), e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={[styles.card, { backgroundColor: colors.primaryLight, borderColor: colors.secondary }]}>
      <View style={styles.rowBetween}>
        <View style={styles.rowGap}>
          <Ionicons name="gift" size={18} color={colors.primaryDark} />
          <Text weight="bodyBold" style={[styles.cardKicker, { color: colors.primaryDark }]}>
            {t("play.mission")}
          </Text>
        </View>
        <View style={[styles.pointTag, { backgroundColor: "#fff" }]}>
          <Text weight="bodySemi" style={{ color: colors.primaryDark, fontSize: 11 }}>
            {t("play.pts5")}
          </Text>
        </View>
      </View>
      <Text weight="body" style={styles.challengeSub}>
        {t("play.missionSub")}
      </Text>

      <View style={styles.challengeBox}>
        <Text weight="headingSemi" style={styles.challengeText}>
          {mine.challenge_text}
        </Text>
      </View>

      {mine.status === "pending" && (
        <View style={styles.rowGap}>
          <Button title={t("play.acceptMission")} onPress={() => act("accept")} loading={busy} testID="accept-challenge-btn" style={{ flex: 1 }} />
          <Button title={t("play.skip")} variant="outline" onPress={() => act("decline")} testID="decline-challenge-btn" style={{ flex: 1 }} />
        </View>
      )}
      {mine.status === "accepted" && (
        <Button title={t("play.markDone")} onPress={() => act("complete")} loading={busy} testID="complete-challenge-btn" icon={<Ionicons name="checkmark" size={18} color="#fff" />} />
      )}
      {mine.status === "completed" && (
        <View style={styles.statusBanner}>
          <Ionicons name="checkmark-circle" size={18} color={colors.moss} />
          <Text weight="bodySemi" style={{ color: colors.moss }}>
            {t("play.missionComplete")}
          </Text>
        </View>
      )}
      {mine.status === "declined" && (
        <View style={styles.statusBanner}>
          <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          <Text weight="bodySemi" style={{ color: colors.textMuted }}>
            {t("play.skipped")}
          </Text>
        </View>
      )}

      <View style={styles.partnerReveal}>
        {challenge.partner_revealed ? (
          <>
            <Text weight="caption" style={{ color: colors.primaryDark, letterSpacing: 1 }}>
              {t("play.partnerDid")}
            </Text>
            <Text weight="body" style={styles.revealText} testID="partner-revealed">
              {challenge.partner_revealed.challenge_text}
            </Text>
          </>
        ) : (
          <View style={styles.rowGap}>
            <Ionicons name="eye-off-outline" size={16} color={colors.textMuted} />
            <Text weight="body" style={{ color: colors.textMuted, fontSize: 13, flex: 1 }}>
              {t("play.partnerSecret")}
            </Text>
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  title: { fontSize: 30, color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.lg },
  card: { marginBottom: spacing.md },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowGap: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardKicker: { color: colors.text, fontSize: 15 },
  justForFun: { color: colors.textMuted, fontSize: 12, fontStyle: "italic" },
  pointTag: { backgroundColor: colors.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  weekTag: { backgroundColor: "rgba(242,204,143,0.18)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  questionText: { fontSize: 19, lineHeight: 26, color: colors.text, marginTop: spacing.sm, marginBottom: spacing.md },
  answerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  qInput: { flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: 18, paddingVertical: 12, fontSize: 15, fontFamily: fonts.body, color: colors.text },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  answerBlock: { backgroundColor: colors.primaryLight, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  answerLabel: { fontSize: 11, color: colors.primaryDark, letterSpacing: 1, marginBottom: 4 },
  answerText: { fontSize: 15, color: colors.text, lineHeight: 21 },
  wagerHint: { color: "rgba(255,255,255,0.7)", fontSize: 14, marginBottom: spacing.sm },
  wagerInput: { backgroundColor: "rgba(255,255,255,0.1)", borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 14, color: "#fff", fontSize: 15, fontFamily: fonts.body },
  wagerStake: { color: "#fff", fontSize: 17, marginBottom: spacing.md, lineHeight: 24 },
  triviaHint: { color: colors.textSecondary, fontSize: 14, marginBottom: spacing.sm },
  catWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catChip: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999 },
  catText: { color: colors.text, fontSize: 13 },
  catBadge: { alignSelf: "flex-start", backgroundColor: colors.primaryLight, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, marginBottom: 4 },
  option: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1.5, borderRadius: radius.md, padding: spacing.md, marginBottom: 8 },
  optionText: { fontSize: 15, color: colors.text, flex: 1 },
  triviaResult: { fontSize: 15, color: colors.text, marginTop: 4, textAlign: "center" },
  challengeSub: { color: colors.primaryDark, fontSize: 13, marginTop: 6, marginBottom: spacing.md },
  challengeBox: { backgroundColor: "#fff", borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  challengeText: { fontSize: 18, lineHeight: 25, color: colors.text },
  statusBanner: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center", paddingVertical: 8 },
  partnerReveal: { borderTopWidth: 1, borderTopColor: colors.secondary, marginTop: spacing.md, paddingTop: spacing.md },
  revealText: { fontSize: 15, color: colors.text, marginTop: 4, lineHeight: 21 },
});
