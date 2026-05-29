import React from "react";
import {
  Text as RNText,
  TextProps,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  View,
  ViewStyle,
  StyleProp,
} from "react-native";
import { colors, fonts, radius, shadow } from "@/src/theme";

export function Text({ style, weight = "body", ...props }: TextProps & { weight?: keyof typeof fonts }) {
  return <RNText {...props} style={[{ fontFamily: fonts[weight], color: colors.text }, style]} />;
}

type BtnProps = {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  icon?: React.ReactNode;
};

export function Button({ title, onPress, variant = "primary", loading, disabled, testID, style, icon }: BtnProps) {
  const isPrimary = variant === "primary";
  const isOutline = variant === "outline";
  const isGhost = variant === "ghost";
  const bg = isPrimary ? colors.primary : variant === "secondary" ? colors.secondary : "transparent";
  const fg = isPrimary ? "#fff" : isOutline ? colors.primary : colors.text;
  return (
    <TouchableOpacity
      testID={testID}
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.btn,
        { backgroundColor: bg, opacity: disabled ? 0.5 : 1 },
        isOutline && { borderWidth: 2, borderColor: colors.primary },
        isPrimary && shadow.soft,
        isGhost && { paddingVertical: 8 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.btnInner}>
          {icon}
          <RNText style={[styles.btnText, { color: fg }]}>{title}</RNText>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 54,
    borderRadius: radius.full,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  btnInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  btnText: { fontFamily: fonts.bodyBold, fontSize: 16 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
});
