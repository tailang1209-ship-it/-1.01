import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useWallet, Network } from "@/context/WalletContext";

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const {
    address,
    network,
    networks,
    switchNetwork,
    clearWallet,
    getMnemonic,
    copyToClipboard,
  } = useWallet();

  const [showMnemonic, setShowMnemonic] = useState(false);
  const [mnemonic, setMnemonic] = useState<string[]>([]);
  const [showNetworks, setShowNetworks] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const adminUrl = process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/admin`
    : null;

  const handleOpenAdmin = async () => {
    if (!adminUrl) {
      Alert.alert("提示", "管理后台地址未配置");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Linking.openURL(adminUrl);
  };

  const handleCopyAddress = async () => {
    if (!address) return;
    await copyToClipboard(address);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2500);
  };

  const handleShowMnemonic = () => {
    Alert.alert(
      "查看助记词",
      "助记词是恢复钱包的唯一凭证，请确保周围无人并在安全环境下查看",
      [
        { text: "取消", style: "cancel" },
        {
          text: "我已知晓，继续",
          style: "destructive",
          onPress: async () => {
            const m = await getMnemonic();
            if (m) {
              setMnemonic(m.split(" "));
              setShowMnemonic(true);
            } else {
              Alert.alert("提示", "该钱包通过私钥导入，无助记词");
            }
          },
        },
      ]
    );
  };

  const handleRemoveWallet = () => {
    Alert.alert(
      "删除钱包",
      "这将从设备上删除所有钱包数据。如果没有备份助记词，资产将无法找回！",
      [
        { text: "取消", style: "cancel" },
        {
          text: "确认删除",
          style: "destructive",
          onPress: async () => {
            await clearWallet();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            router.replace("/onboarding");
          },
        },
      ]
    );
  };

  const Section = ({ title }: { title: string }) => (
    <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
      {title}
    </Text>
  );

  const Row = ({
    label,
    value,
    onPress,
    danger,
    icon,
  }: {
    label: string;
    value?: string;
    onPress: () => void;
    danger?: boolean;
    icon?: string;
  }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? colors.secondary : colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      {icon && <Text style={styles.rowIcon}>{icon}</Text>}
      <Text
        style={[
          styles.rowLabel,
          { color: danger ? colors.destructive : colors.foreground },
        ]}
      >
        {label}
      </Text>
      <View style={styles.rowRight}>
        {value && (
          <Text
            style={[styles.rowValue, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {value}
          </Text>
        )}
        <Text style={[styles.chevron, { color: colors.mutedForeground }]}>›</Text>
      </View>
    </Pressable>
  );

  return (
    <>
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: bottomPad + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Section title="钱包" />
        <View style={styles.group}>
          <Row
            icon="📋"
            label="复制地址"
            value={
              address
                ? `${address.slice(0, 8)}...${address.slice(-6)}`
                : "—"
            }
            onPress={handleCopyAddress}
          />
          {copiedAddress && (
            <Text style={[styles.copiedNote, { color: colors.success }]}>
              已复制到剪贴板
            </Text>
          )}
          <Row
            icon="🔑"
            label="查看助记词"
            onPress={handleShowMnemonic}
          />
        </View>

        <Section title="网络" />
        <View style={styles.group}>
          <Row
            icon="⛓"
            label="当前网络"
            value={network.name}
            onPress={() => setShowNetworks(true)}
          />
        </View>

        <Section title="管理" />
        <View style={styles.group}>
          <Row
            icon="🔐"
            label="管理后台"
            value={adminUrl ? "浏览器打开" : "未配置"}
            onPress={handleOpenAdmin}
          />
        </View>

        <Section title="危险操作" />
        <View style={styles.group}>
          <Row
            icon="🗑"
            label="删除钱包"
            onPress={handleRemoveWallet}
            danger
          />
        </View>

        <Text style={[styles.version, { color: colors.mutedForeground }]}>
          CryptoVault v1.0.0 · 去中心化热钱包
        </Text>
      </ScrollView>

      <Modal
        visible={showMnemonic}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setShowMnemonic(false)}
      >
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              我的助记词
            </Text>
            <Pressable onPress={() => setShowMnemonic(false)}>
              <Text style={[styles.closeBtn, { color: colors.primary }]}>关闭</Text>
            </Pressable>
          </View>

          <View
            style={[
              styles.warningBanner,
              { backgroundColor: colors.destructive + "18", borderColor: colors.destructive + "50" },
            ]}
          >
            <Text style={[styles.warningBannerText, { color: colors.destructive }]}>
              ⚠ 请勿截图或分享给任何人
            </Text>
          </View>

          <View style={styles.mnemonicGrid}>
            {mnemonic.map((word, i) => (
              <View
                key={i}
                style={[
                  styles.wordCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.wordIndex, { color: colors.mutedForeground }]}>
                  {i + 1}
                </Text>
                <Text style={[styles.wordText, { color: colors.foreground }]}>
                  {word}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showNetworks}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setShowNetworks(false)}
      >
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              选择网络
            </Text>
            <Pressable onPress={() => setShowNetworks(false)}>
              <Text style={[styles.closeBtn, { color: colors.primary }]}>完成</Text>
            </Pressable>
          </View>

          {networks.map((n: Network) => (
            <Pressable
              key={n.id}
              onPress={async () => {
                await switchNetwork(n);
                setShowNetworks(false);
              }}
              style={({ pressed }) => [
                styles.networkRow,
                {
                  backgroundColor:
                    n.id === network.id
                      ? colors.primary + "20"
                      : pressed
                      ? colors.secondary
                      : colors.card,
                  borderColor:
                    n.id === network.id ? colors.primary + "60" : colors.border,
                },
              ]}
            >
              <View>
                <Text style={[styles.networkName, { color: colors.foreground }]}>
                  {n.name}
                </Text>
                <Text style={[styles.networkChainId, { color: colors.mutedForeground }]}>
                  Chain ID: {n.chainId} · {n.symbol}
                </Text>
              </View>
              {n.id === network.id && (
                <Text style={[styles.checkmark, { color: colors.primary }]}>✓</Text>
              )}
            </Pressable>
          ))}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 16,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  group: {
    borderRadius: 16,
    overflow: "hidden",
    gap: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderWidth: 0,
    borderBottomWidth: 1,
    gap: 12,
  },
  rowIcon: {
    fontSize: 20,
    width: 28,
    textAlign: "center",
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: "50%",
  },
  rowValue: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  chevron: {
    fontSize: 20,
  },
  copiedNote: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  version: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 16,
  },
  modal: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  closeBtn: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  warningBanner: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  warningBannerText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  mnemonicGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  wordCard: {
    width: "30%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  wordIndex: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    minWidth: 16,
  },
  wordText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  networkRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  networkName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  networkChainId: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  checkmark: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
});
