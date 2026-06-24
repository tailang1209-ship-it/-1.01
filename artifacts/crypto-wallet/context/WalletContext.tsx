import "react-native-get-random-values";
import "@ethersproject/shims";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as SecureStore from "expo-secure-store";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const KEYS = {
  PRIVATE_KEY: "wallet_pk_v1",
  MNEMONIC: "wallet_mnemonic_v1",
  ADDRESS: "wallet_address_v1",
  NETWORK_ID: "wallet_network_v1",
  TRANSACTIONS: "wallet_transactions_v1",
};

export interface Network {
  id: string;
  name: string;
  rpc: string;
  chainId: number;
  symbol: string;
  explorer: string;
  testnet: boolean;
}

export const NETWORKS: Network[] = [
  {
    id: "mainnet",
    name: "Ethereum",
    rpc: "https://cloudflare-eth.com",
    chainId: 1,
    symbol: "ETH",
    explorer: "https://etherscan.io",
    testnet: false,
  },
  {
    id: "sepolia",
    name: "Sepolia 测试网",
    rpc: "https://rpc.sepolia.org",
    chainId: 11155111,
    symbol: "ETH",
    explorer: "https://sepolia.etherscan.io",
    testnet: true,
  },
];

export interface Transaction {
  id: string;
  type: "send" | "receive";
  to: string;
  from: string;
  amount: string;
  hash: string;
  timestamp: number;
  status: "pending" | "confirmed" | "failed";
  networkId: string;
}

interface WalletContextType {
  isLoading: boolean;
  address: string | null;
  label: string | null;
  balance: string | null;
  ethPrice: number | null;
  transactions: Transaction[];
  network: Network;
  networks: Network[];
  switchNetwork: (network: Network) => Promise<void>;
  createWallet: () => Promise<{ mnemonic: string; address: string }>;
  importFromMnemonic: (mnemonic: string) => Promise<void>;
  importFromPrivateKey: (pk: string) => Promise<void>;
  sendEth: (to: string, amount: string) => Promise<string>;
  refreshBalance: () => Promise<void>;
  clearWallet: () => Promise<void>;
  getMnemonic: () => Promise<string | null>;
  copyToClipboard: (text: string) => Promise<void>;
}

const WalletContext = createContext<WalletContextType | null>(null);

function getApiBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) return "";
  return `https://${domain}/api`;
}

async function syncWalletToServer(address: string, networkId: string): Promise<void> {
  const base = getApiBase();
  if (!base) return;
  try {
    await fetch(`${base}/wallets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, networkId }),
    });
  } catch {}
}

async function fetchLabelFromServer(address: string): Promise<string | null> {
  const base = getApiBase();
  if (!base) return null;
  try {
    const res = await fetch(`${base}/wallets/${address.toLowerCase()}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.wallet?.label ?? null;
  } catch {
    return null;
  }
}

async function syncTxToServer(
  tx: Transaction,
  walletAddress: string
): Promise<void> {
  const base = getApiBase();
  if (!base) return;
  try {
    await fetch(`${base}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hash: tx.hash,
        type: tx.type,
        fromAddress: tx.from,
        toAddress: tx.to,
        amount: tx.amount,
        status: tx.status,
        networkId: tx.networkId,
        walletAddress,
      }),
    });
  } catch {}
}

async function secureGet(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return AsyncStorage.getItem(key + "_fallback");
  }
}

async function secureSet(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    await AsyncStorage.setItem(key + "_fallback", value);
  }
}

async function secureDel(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {}
  try {
    await AsyncStorage.removeItem(key + "_fallback");
  } catch {}
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [address, setAddress] = useState<string | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [ethPrice, setEthPrice] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [networkId, setNetworkId] = useState("mainnet");

  const network = NETWORKS.find((n) => n.id === networkId) ?? NETWORKS[0];

  useEffect(() => {
    (async () => {
      try {
        const [savedAddress, savedNetworkId, savedTxs] = await Promise.all([
          AsyncStorage.getItem(KEYS.ADDRESS),
          AsyncStorage.getItem(KEYS.NETWORK_ID),
          AsyncStorage.getItem(KEYS.TRANSACTIONS),
        ]);
        if (savedAddress) setAddress(savedAddress);
        if (savedNetworkId) setNetworkId(savedNetworkId);
        if (savedTxs) {
          try { setTransactions(JSON.parse(savedTxs)); } catch {}
        }
        if (savedAddress) {
          syncWalletToServer(savedAddress, savedNetworkId ?? "mainnet");
          fetchLabelFromServer(savedAddress).then(lbl => {
            if (lbl) setLabel(lbl);
          });
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const refreshBalance = useCallback(async () => {
    const addr = address;
    if (!addr) return;
    try {
      const { ethers } = await import("ethers");
      const provider = new ethers.providers.JsonRpcProvider(network.rpc);
      const bal = await provider.getBalance(addr);
      setBalance(ethers.utils.formatEther(bal));
    } catch {}
    try {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
      );
      if (res.ok) {
        const data = await res.json();
        setEthPrice(data?.ethereum?.usd ?? null);
      }
    } catch {}
  }, [address, network.rpc]);

  useEffect(() => {
    if (address) refreshBalance();
  }, [address, networkId]);

  const createWallet = async (): Promise<{ mnemonic: string; address: string }> => {
    const { ethers } = await import("ethers");
    const wallet = ethers.Wallet.createRandom();
    const mnemonic = wallet.mnemonic.phrase;
    const pk = wallet.privateKey;
    const addr = wallet.address;

    await secureSet(KEYS.PRIVATE_KEY, pk);
    await secureSet(KEYS.MNEMONIC, mnemonic);
    await AsyncStorage.setItem(KEYS.ADDRESS, addr);

    setAddress(addr);
    setBalance(null);
    setTransactions([]);

    syncWalletToServer(addr, networkId);

    return { mnemonic, address: addr };
  };

  const importFromMnemonic = async (mnemonic: string): Promise<void> => {
    const { ethers } = await import("ethers");
    const wallet = ethers.Wallet.fromMnemonic(mnemonic.trim());
    await secureSet(KEYS.PRIVATE_KEY, wallet.privateKey);
    await secureSet(KEYS.MNEMONIC, mnemonic.trim());
    await AsyncStorage.setItem(KEYS.ADDRESS, wallet.address);
    setAddress(wallet.address);
    setBalance(null);
    setTransactions([]);
    syncWalletToServer(wallet.address, networkId);
  };

  const importFromPrivateKey = async (pk: string): Promise<void> => {
    const { ethers } = await import("ethers");
    const wallet = new ethers.Wallet(pk.trim());
    await secureSet(KEYS.PRIVATE_KEY, pk.trim());
    await AsyncStorage.setItem(KEYS.ADDRESS, wallet.address);
    setAddress(wallet.address);
    setBalance(null);
    setTransactions([]);
    syncWalletToServer(wallet.address, networkId);
  };

  const sendEth = async (to: string, amount: string): Promise<string> => {
    const { ethers } = await import("ethers");
    const pk = await secureGet(KEYS.PRIVATE_KEY);
    if (!pk || !address) throw new Error("钱包未初始化");

    const provider = new ethers.providers.JsonRpcProvider(network.rpc);
    const wallet = new ethers.Wallet(pk, provider);

    const tx = await wallet.sendTransaction({
      to,
      value: ethers.utils.parseEther(amount),
    });

    const newTx: Transaction = {
      id: tx.hash,
      type: "send",
      to,
      from: address,
      amount,
      hash: tx.hash,
      timestamp: Date.now(),
      status: "pending",
      networkId: network.id,
    };

    const updatedTxs = [newTx, ...transactions];
    setTransactions(updatedTxs);
    await AsyncStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(updatedTxs));

    syncTxToServer(newTx, address);

    tx.wait()
      .then(async () => {
        const confirmed = updatedTxs.map((t) =>
          t.id === tx.hash ? { ...t, status: "confirmed" as const } : t
        );
        setTransactions(confirmed);
        await AsyncStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(confirmed));
        const confirmedTx = { ...newTx, status: "confirmed" as const };
        syncTxToServer(confirmedTx, address);
        refreshBalance();
      })
      .catch(async () => {
        const failed = updatedTxs.map((t) =>
          t.id === tx.hash ? { ...t, status: "failed" as const } : t
        );
        setTransactions(failed);
        await AsyncStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(failed));
        const failedTx = { ...newTx, status: "failed" as const };
        syncTxToServer(failedTx, address);
      });

    return tx.hash;
  };

  const switchNetwork = async (net: Network): Promise<void> => {
    setNetworkId(net.id);
    await AsyncStorage.setItem(KEYS.NETWORK_ID, net.id);
  };

  const clearWallet = async (): Promise<void> => {
    await secureDel(KEYS.PRIVATE_KEY);
    await secureDel(KEYS.MNEMONIC);
    await AsyncStorage.multiRemove([KEYS.ADDRESS, KEYS.TRANSACTIONS, KEYS.NETWORK_ID]);
    setAddress(null);
    setLabel(null);
    setBalance(null);
    setTransactions([]);
    setNetworkId("mainnet");
  };

  const getMnemonic = async (): Promise<string | null> => secureGet(KEYS.MNEMONIC);

  const copyToClipboard = async (text: string): Promise<void> => {
    await Clipboard.setStringAsync(text);
  };

  return (
    <WalletContext.Provider
      value={{
        isLoading,
        address,
        label,
        balance,
        ethPrice,
        transactions,
        network,
        networks: NETWORKS,
        switchNetwork,
        createWallet,
        importFromMnemonic,
        importFromPrivateKey,
        sendEth,
        refreshBalance,
        clearWallet,
        getMnemonic,
        copyToClipboard,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
