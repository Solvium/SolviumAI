import { REF_ENV, REF_INDEXER_URL, REF_NODE_URL } from "@/config/ref";

// Global variable to track if Ref SDK has been initialized
let isRefInitialized = false;

export async function initializeRefSDK() {
  if (isRefInitialized) {
    console.log("[ref-init] Ref SDK already initialized, skipping...");
    return;
  }

  try {
    // Load the Ref SDK
    const { init_env, getConfig } = await loadRefSdk();

    // Get environment configuration
    const env = REF_ENV || process.env.NEAR_ENV || "mainnet";
    const nodeUrl = REF_NODE_URL || "https://rpc.intea.rs";
    const indexerUrl = REF_INDEXER_URL || "";

    console.log(`[ref-init] Initializing Ref Finance SDK:`);
    console.log(`  - Environment: ${env}`);
    console.log(`  - Node URL: ${nodeUrl}`);
    console.log(`  - Indexer URL: ${indexerUrl || "default"}`);

    // Set environment variables that the SDK might use
    if (typeof process !== "undefined") {
      process.env.NEAR_NODE_URL = nodeUrl;
      process.env.NEXT_PUBLIC_NEAR_NODE_URL = nodeUrl;
      process.env.REF_NODE_URL = nodeUrl;
      process.env.NEAR_RPC_URL = nodeUrl;
      process.env.NEAR_ENDPOINT = nodeUrl;
    }

    // Initialize the Ref SDK with custom RPC
    init_env(env, indexerUrl, nodeUrl);

    // Get the configuration to verify it was set correctly
    const config = getConfig(env);

    console.log(`[ref-init] Ref SDK initialized successfully:`);
    console.log(`  - Network ID: ${config.networkId}`);
    console.log(`  - Actual Node URL: ${config.nodeUrl}`);
    console.log(`  - Wallet URL: ${config.walletUrl}`);
    console.log(`  - Using Intea RPC: ${config.nodeUrl?.includes("intea.rs")}`);

    isRefInitialized = true;
    return config;
  } catch (error) {
    console.error("[ref-init] Failed to initialize Ref SDK:", error);
    throw error instanceof Error
      ? error
      : new Error("Failed to initialize Ref SDK");
  }
}

async function loadRefSdk() {
  // Prefer CJS build to avoid React-bound ESM in server runtime
  try {
    // CommonJS entry
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const cjs: any = await import(
      /* webpackIgnore: true */ "@ref-finance/ref-sdk/dist/index.js"
    );
    console.log(`[ref-init] Loaded CJS version of Ref Finance SDK`);
    return cjs?.default || cjs;
  } catch (e) {
    console.log(
      `[ref-init] CJS load failed, trying ESM:`,
      e instanceof Error ? e.message : String(e)
    );
  }

  const esm: any = await import("@ref-finance/ref-sdk");
  return esm?.default || esm;
}

// Export a function to check if Ref SDK is initialized
export function isRefSDKInitialized(): boolean {
  return isRefInitialized;
}

// Export a function to get the current configuration
export async function getRefConfig() {
  if (!isRefInitialized) {
    await initializeRefSDK();
  }

  const { getConfig } = await loadRefSdk();
  const env = REF_ENV || process.env.NEAR_ENV || "mainnet";
  return getConfig(env);
}
