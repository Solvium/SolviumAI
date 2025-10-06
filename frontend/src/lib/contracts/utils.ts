import TonWeb from "tonweb";
import { Address } from "tonweb/dist/types/utils/address";

const readIntFromBitString = (bs: any, cursor: any, bits: any) => {
  let n = BigInt(0);
  for (let i = 0; i < bits; i++) {
    n *= BigInt(2);
    n += BigInt(bs.get(cursor + i));
  }
  return n;
};

const parseAddress = (cell: any): Address | null => {
  let n = readIntFromBitString(cell.bits, 3, 8);
  if (n > BigInt(127)) {
    n = n - BigInt(256);
  }
  const hashPart = readIntFromBitString(cell.bits, 3 + 8, 256);
  if (n.toString(10) + ":" + hashPart.toString(16) === "0:0") return null;
  const s = n.toString(10) + ":" + hashPart.toString(16).padStart(64, "0");
  return new TonWeb.Address(s);
};

export async function getJettonWalletBalance(
  tonweb: any,
  jettonWalletAddress: string
): Promise<any> {
  /* BN */
  try {
    const jettonWalletData = await tonweb.provider.call2(
      jettonWalletAddress,
      "get_wallet_data"
    );
    const balance = jettonWalletData[0];
    return balance;
  } catch (e: any) {
    if (e.result.exit_code === -13) {
      return decToBN(0);
    } else {
      throw e;
    }
  }
}

export async function getJettonWalletData(
  tonweb: any,
  jettonWalletAddress: string
) {
  const jettonWalletData = await tonweb.provider.call2(
    jettonWalletAddress,
    "get_wallet_data"
  );

  const balance = jettonWalletData[0];
  const ownerAddress = parseAddress(jettonWalletData[1]);
  const jettonMinterAddress = parseAddress(jettonWalletData[2]);
  const jettonWalletCode = jettonWalletData[3];

  return {
    balance,
    ownerAddress,
    jettonMinterAddress,
    jettonWalletCode,
  };
}

export async function getJettonWalletAddress({
  tonweb,
  userTonAddress,
  tokenAddress,
}: {
  tonweb: any;
  userTonAddress: Address;
  tokenAddress: string;
}): Promise<Address | null> {
  const cell = new TonWeb.boc.Cell();

  cell.bits.writeAddress(userTonAddress);

  const getWalletAddressResponse = await tonweb.provider.call2(
    tokenAddress,
    "get_wallet_address",
    [["tvm.Slice", bytesToBase64(await cell.toBoc(false))]]
  );
  const jettonWalletAddress = parseAddress(getWalletAddressResponse);
  return jettonWalletAddress;
}

export const bytesToBase64 = (bytes: Uint8Array): string => {
  checkNull(bytes);
  const a = Buffer.from(bytes).toString("base64");
  const b = TonWeb.utils.bytesToBase64(bytes);
  if (a !== b) throw new Error("bytesToBase64");
  return a;
};

export const decToBN = (dec: string | number) /* BN */ => {
  checkNull(dec);
  const bn = new TonWeb.utils.BN(dec);
  const bigInt = BigInt(dec);
  checkBN(bn, bigInt);
  return bn;
};

export const checkNull = (a: any): void => {
  if (a === null || a === undefined || a === "" || a === "0x")
    throw new Error("checkNull");
  if (typeof a === "number" && isNaN(a)) throw new Error("checkNaN");
};

const checkBN = (bn: any, bigInt: any): void => {
  if (bn.toString(2) !== bigInt.toString(2)) throw new Error("checkBN");
  if (bn.toString(10) !== bigInt.toString(10)) throw new Error("checkBN");
  if (bn.toString(16) !== bigInt.toString(16)) throw new Error("checkBN");
};
