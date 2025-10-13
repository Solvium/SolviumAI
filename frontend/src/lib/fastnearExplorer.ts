export interface FastnearAccountTxRow {
  account_id: string;
  signer_id: string;
  transaction_hash: string;
  tx_block_height: number;
  tx_block_timestamp: number;
}

export interface FastnearAccountResponse {
  account_txs: FastnearAccountTxRow[];
  total_txs?: number;
  transactions?: any[];
}

export async function getAccountTxnsFastnear(
  accountId: string,
  maxBlockHeight?: number
): Promise<FastnearAccountResponse | null> {
  try {
    const res = await fetch(`/api/wallet?action=fastnear-explorer-account`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(
        maxBlockHeight
          ? { account_id: accountId, max_block_height: maxBlockHeight }
          : { account_id: accountId }
      ),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error("getAccountTxnsFastnear error", e);
    return null;
  }
}
