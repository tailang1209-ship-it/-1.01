import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useWallet, Transaction } from "@/context/WalletContext";

function formatBalance(bal: string | null): string {
  if (!bal) return "0.0000";
  return parseFloat(bal).toFixed(4);
}

function formatUSD(bal: string | null, price: number | null): string {
  if (!bal || !price) return "—";
  const usd = parseFloat(bal) * price;
  return usd.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function formatAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  });
}

function TxPreview({
  tx,
  address,
}: {
  tx: Transaction;
  address: string | null;
}) {
  const colors = useColors();
  const isSend =
    tx.type === "send" ||
    tx.from?.toLowerCase() === address?.toLowerCase();

  return (
    <View
      style={[
        styles.txRow,
        { borderBottomColor: colors.border },
      ]}
    >
      <View
        style={[
          styles.txIcon,
          {
            backgroundColor: isSend
              ? colors.destructive + "20"
              : colors.success + "20",
          },
        ]}
      >
        <Text
          style={{
            fontSize: 18,
            color: isSend ? colors.destructive : colors.success,
            fontFamily: "Inter_700Bold",
          }}
        >
          {isSend ? "↑" : "↓"}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.txTypeText, { color: colors.foreground }]}>
          {isSend
            ? `发送至 ${formatAddress(tx.to)}`
            : `接收自 ${formatAddress(tx.from)}`}
        </Text>
        <Text style={[styles.txDateText, { color: colors.mutedForeground }]}>
          {formatDate(tx.timestamp)} ·{" "}
          {tx.status === "confirmed"
            ? "已确认"
            : tx.status === "failed"
            ? "失败"
            : "待确认"}
        </Text>
      </View>
      <Text
        style={[
          styles.txAmtText,
          { color: isSend ? colors.destructive : colors.success },
        ]}
      >
        {isSend ? "-" : "+"}
        {parseFloat(tx.amount).toFixed(4)}
      </Text>
    </View>
  );
}

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useColors();
  const { address, label, balance, ethPrice, transactions, network, refreshBalance } =
    useWallet();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshBalance();
    setRefreshing(false);
  }, [refreshBalance]);

  const recentTxs = transactions.slice(0, 5);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: bottomPad + 100 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    >
      <LinearGradient
        colors={["#141530", "#0A0B14"]}
        style={[styles.header, { paddingTop: topPad + 16 }]}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.networkLabel, { color: colors.mutedForeground }]}>
              {network.name}
            </Text>
            {label ? (
              <>
                <Text style={[styles.addressText, { color: colors.foreground }]}>
                  {label}
                </Text>
                {address && (
                  <Text style={[styles.networkLabel, { color: colors.mutedForeground, marginTop: 2 }]}>
                    {formatAddress(address)}
                  </Text>
                )}
              </>
            ) : (
              address && (
                <Text style={[styles.addressText, { color: colors.foreground }]}>
                  {formatAddress(address)}
                </Text>
              )
            )}
          </View>
          <View style={[styles.networkDotBadge, { backgroundColor: colors.primary + "25" }]}>
            <View style={[styles.dot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.dotLabel, { color: colors.primary }]}>在线</Text>
          </View>
        </View>

        <View style={styles.balanceArea}>
          {balance === null ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <Text style={[styles.balanceETH, { color: colors.foreground }]}>
                {formatBalance(balance)}{" "}
                <Text style={[styles.balanceSymbol, { color: colors.mutedForeground }]}>
                  {network.symbol}
                </Text>
              </Text>
              <Text style={[styles.balanceUSD, { color: colors.mutedForeground }]}>
                {formatUSD(balance, ethPrice)}
              </Text>
            </>
          )}
        </View>

        <View style={styles.actionRow}>
          {[
            { label: "发送", icon: "↑", route: "/(tabs)/send" as const, color: colors.primary },
            { label: "接收", icon: "↓", route: "/(tabs)/receive" as const, color: colors.success },
          ].map((a) => (
            <Pressable
              key={a.label}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(a.route);
              }}
              style={({ pressed }) => [
                styles.actionBtn,
                {
                  backgroundColor: a.color + "20",
                  borderColor: a.color + "40",
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <Text style={[styles.actionIcon, { color: a.color }]}>{a.icon}</Text>
              <Text style={[styles.actionLabel, { color: a.color }]}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      </LinearGradient>

      <View style={styles.body}>
        <View
          style={[
            styles.assetCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.assetRow}>
            <View style={[styles.assetIcon, { backgroundColor: "#627EEA20" }]}>
              <Text style={styles.assetIconText}>Ξ</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.assetName, { color: colors.foreground }]}>
                Ethereum
              </Text>
              <Text style={[styles.assetNetwork, { color: colors.mutedForeground }]}>
                {network.name}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[styles.assetBalance, { color: colors.foreground }]}>
                {formatBalance(balance)} ETH
              </Text>
              {ethPrice && (
                <Text style={[styles.assetUSD, { color: colors.mutedForeground }]}>
                  ${ethPrice.toLocaleString()}
                  <Text style={{ color: colors.success }}> /ETH</Text>
                </Text>
              )}
            </View>
          </View>
        </View>

        <View
          style={[
            styles.section,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              最近交易
            </Text>
            {transactions.length > 0 && (
              <Pressable onPress={() => router.push("/(tabs)/history")}>
                <Text style={[styles.sectionMore, { color: colors.primary }]}>
                  全部
                </Text>
              </Pressable>
            )}
          </View>

          {recentTxs.length === 0 ? (
            <View style={styles.emptyTx}>
              <Text style={[styles.emptyTxText, { color: colors.mutedForeground }]}>
                暂无交易记录
              </Text>
            </View>
          ) : (
            recentTxs.map((tx) => (
              <TxPreview key={tx.id} tx={tx} address={address} />
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    gap: 20,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  networkLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.5,
  },
  addressText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
  networkDotBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  balanceArea: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  balanceETH: {
    fontSize: 42,
    fontFamily: "Inter_700Bold",
    letterSpacing: -1,
  },
  balanceSymbol: {
    fontSize: 22,
    fontFamily: "Inter_400Regular",
  },
  balanceUSD: {
    fontSize: 18,
    fontFamily: "Inter_400Regular",
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionIcon: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  actionLabel: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },
  assetCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  assetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  assetIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  assetIconText: {
    fontSize: 22,
    color: "#627EEA",
    fontFamily: "Inter_700Bold",
  },
  assetName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  assetNetwork: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  assetBalance: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  assetUSD: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  section: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  sectionMore: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  emptyTx: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyTxText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  txIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  txTypeText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  txDateText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  txAmtText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
});
