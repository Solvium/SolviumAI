// src/hooks/useMultiChain.ts
import { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import * as solanaWeb3 from "@solana/web3.js";
import * as nearAPI from "near-api-js";
import TonWeb from "tonweb";

export type ChainType = "EVM" | "Solana" | "NEAR" | "TON";

interface WalletInfo {
  address: string;
  chainId?: string | number;
  balance?: string;
  connected: boolean;
}

interface TransactionParams {
  chain: ChainType;
  method: string;
  contractAddress?: string;
  args?: any[];
  value?: string;
  gasLimit?: string;
}

interface ChainConfig {
  EVM: {
    rpcUrl: string;
    chainId: number;
  };
  Solana: {
    rpcUrl: string;
    network: "mainnet-beta" | "testnet" | "devnet";
  };
  NEAR: {
    networkId: string;
    nodeUrl: string;
  };
  TON: {
    endpoint: string;
  };
}

export const useMultiChain = (config: ChainConfig) => {
  const [activeChain, setActiveChain] = useState<ChainType>("EVM");
  const [walletInfo, setWalletInfo] = useState<WalletInfo>({
    address: "",
    connected: false,
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get supported wallets for the active chain
  const getSupportedWallets = useCallback(() => {
    switch (activeChain) {
      case "EVM":
        return ["MetaMask", "WalletConnect"];
      case "Solana":
        return ["Phantom", "Solflare"];
      case "NEAR":
        return ["NEAR Wallet"];
      case "TON":
        return ["TON Wallet", "Tonkeeper"];
      default:
        return [];
    }
  }, [activeChain]);

  // Connect wallet based on chain and wallet type
  const connectWallet = useCallback(
    async (walletType: string) => {
      setIsConnecting(true);
      setError(null);

      try {
        if (activeChain === "EVM") {
          if (walletType === "MetaMask") {
            ///@ts-ignore
            if (window.ethereum) {
              ///@ts-ignore
              const provider = new ethers.BrowserProvider(window.ethereum);
              await provider.send("eth_requestAccounts", []);
              const signer = await provider.getSigner();
              const address = await signer.getAddress();
              const balance = ethers.formatEther(
                await provider.getBalance(address)
              );
              const network = await provider.getNetwork();

              setWalletInfo({
                address,
                chainId: network.chainId.toString(),
                balance,
                connected: true,
              });
            } else {
              throw new Error("MetaMask is not installed");
            }
          }
          // Implement WalletConnect similarly
        } else if (activeChain === "Solana") {
          ///@ts-ignore
          if (walletType === "Phantom" && window.solana) {
            const connection = new solanaWeb3.Connection(config.Solana.rpcUrl);
            ///@ts-ignore
            const resp = await window.solana.connect();
            const balance = await connection.getBalance(resp.publicKey);

            setWalletInfo({
              address: resp.publicKey.toString(),
              balance: (balance / solanaWeb3.LAMPORTS_PER_SOL).toString(),
              connected: true,
            });
          } else {
            throw new Error("Phantom wallet is not installed");
          }
          // Implement Solflare similarly
        } else if (activeChain === "NEAR") {
          // NEAR wallet connects differently - typically redirects to wallet site
          const { connect, keyStores, WalletConnection } = nearAPI;
          const keyStore = new keyStores.BrowserLocalStorageKeyStore();

          const nearConnection = await connect({
            networkId: config.NEAR.networkId,
            keyStore,
            nodeUrl: config.NEAR.nodeUrl,
          });

          const walletConnection = new WalletConnection(
            nearConnection,
            "your-app-name"
          );

          if (!walletConnection.isSignedIn()) {
            walletConnection.requestSignIn({
              contractId: "your-contract.near",
              successUrl: window.location.origin,
              failureUrl: window.location.origin,
              keyType: "ed25519",
            });
            return; // Will redirect
          }

          const accountId = walletConnection.getAccountId();
          const account = await nearConnection.account(accountId);
          const balance = await account.getAccountBalance();

          setWalletInfo({
            address: accountId,
            balance: balance.available,
            connected: true,
          });
        } else if (activeChain === "TON") {
          if (walletType === "TON Wallet") {
            // Example using TonConnect
            const tonweb = new TonWeb(
              new TonWeb.HttpProvider(config.TON.endpoint)
            );

            // This is simplified - actual implementation would use TON Connect SDK
            // and handle connection flow accordingly
            // const provider = window.tonProtocol;
            // if (provider) {
            //   await provider.connect();
            //   const address = await provider.getAddress();

            //   setWalletInfo({
            //     address,
            //     connected: true,
            //   });
            // } else {
            //   throw new Error("TON wallet extension not found");
            // }
          }
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to connect wallet"
        );
        console.error("Wallet connection error:", err);
      } finally {
        setIsConnecting(false);
      }
    },
    [activeChain, config]
  );

  // Disconnect current wallet
  const disconnectWallet = useCallback(() => {
    setWalletInfo({
      address: "",
      connected: false,
    });

    // Additional chain-specific disconnect logic if needed
    // For example, some wallets may need to call specific methods
  }, []);

  // Send transaction through the active wallet
  const sendTransaction = useCallback(
    async ({
      chain,
      method,
      contractAddress,
      args = [],
      value = "0",
      gasLimit,
    }: TransactionParams) => {
      if (!walletInfo.connected) {
        throw new Error("Wallet not connected");
      }

      if (chain !== activeChain) {
        throw new Error(
          `Active chain (${activeChain}) doesn't match requested chain (${chain})`
        );
      }

      try {
        if (chain === "EVM") {
          ///@ts-ignore
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();

          if (contractAddress) {
            // Contract interaction
            const abi = [
              "function " +
                method +
                "(" +
                args.map(() => "address").join(",") +
                ")",
            ];
            const contract = new ethers.Contract(contractAddress, abi, signer);

            const tx = await contract[method](...args, {
              value: value ? ethers.parseEther(value) : "0",
              gasLimit: gasLimit ? BigInt(gasLimit) : undefined,
            });

            return await tx.wait();
          } else {
            // Simple transfer
            const tx = await signer.sendTransaction({
              to: args[0],
              value: ethers.parseEther(value),
            });

            return await tx.wait();
          }
        } else if (chain === "Solana") {
          const connection = new solanaWeb3.Connection(config.Solana.rpcUrl);

          if (method === "transfer" && args.length >= 2) {
            const destinationPubkey = new solanaWeb3.PublicKey(args[0]);
            const lamports = args[1] * solanaWeb3.LAMPORTS_PER_SOL;

            const transaction = new solanaWeb3.Transaction().add(
              solanaWeb3.SystemProgram.transfer({
                fromPubkey: new solanaWeb3.PublicKey(walletInfo.address),
                toPubkey: destinationPubkey,
                lamports,
              })
            );

            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = new solanaWeb3.PublicKey(walletInfo.address);

            ///@ts-ignore
            const signed = await window.solana.signTransaction(transaction);
            const signature = await connection.sendRawTransaction(
              signed.serialize()
            );

            return await connection.confirmTransaction(signature);
          }
          // Implement other Solana contract interactions
        }

        // NEAR and TON implementations would follow similar patterns
        // but with their specific APIs
      } catch (err) {
        console.error("Transaction error:", err);
        throw err;
      }
    },
    [activeChain, walletInfo, config]
  );

  // Change active chain
  const switchChain = useCallback(
    (newChain: ChainType) => {
      if (walletInfo.connected) {
        // Disconnect current wallet before switching
        disconnectWallet();
      }
      setActiveChain(newChain);
    },
    [disconnectWallet, walletInfo.connected]
  );

  return {
    activeChain,
    walletInfo,
    isConnecting,
    error,
    getSupportedWallets,
    connectWallet,
    disconnectWallet,
    sendTransaction,
    switchChain,
  };
};
