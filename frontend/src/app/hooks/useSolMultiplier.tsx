import { useEffect, useState, useCallback } from "react";
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Keypair,
} from "@solana/web3.js";
import {
  Program,
  AnchorProvider,
  web3,
  utils,
  BN,
  Idl,
} from "@coral-xyz/anchor";
import { useWallet } from "@solana/wallet-adapter-react";

// Define the IDL types
interface DepositInfo {
  id: BN;
  amount: BN;
  multiplier: BN;
  startTime: BN;
  active: boolean;
}

interface ProgramData {
  owner: PublicKey;
  totalContractDeposits: BN;
  multiplierFactor: number;
}

interface UserDeposits {
  totalDeposits: BN;
  deposits: DepositInfo[];
  lastDepositId: BN;
}

interface FormattedProgramData {
  owner: string;
  totalContractDeposits: number;
  multiplierFactor: number;
}

interface FormattedDepositInfo {
  id: number;
  amount: number;
  multiplier: number;
  startTime: Date;
  active: boolean;
}

interface FormattedUserDeposits {
  totalDeposits: number;
  deposits: FormattedDepositInfo[];
  lastDepositId: number;
}

// Import the IDL
const idl: Idl = {
  version: "0.1.0",
  name: "solvium_multiplier",
  instructions: [
    {
      name: "initialize",
      accounts: [
        { name: "owner", isMut: true, isSigner: true },
        { name: "programData", isMut: true, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [{ name: "multiplierFactor", type: "u32" }],
    },
    {
      name: "deposit",
      accounts: [
        { name: "user", isMut: true, isSigner: true },
        { name: "programData", isMut: true, isSigner: false },
        { name: "userDeposits", isMut: true, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [{ name: "amount", type: "u64" }],
    },
    {
      name: "adminWithdraw",
      accounts: [
        { name: "owner", isMut: true, isSigner: true },
        { name: "programData", isMut: true, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [{ name: "amount", type: "u64" }],
    },
    {
      name: "updateMultiplierFactor",
      accounts: [
        { name: "owner", isMut: true, isSigner: true },
        { name: "programData", isMut: true, isSigner: false },
      ],
      args: [{ name: "newFactor", type: "u32" }],
    },
  ],
  accounts: [
    {
      name: "ProgramData",
      type: {
        kind: "struct",
        fields: [
          { name: "owner", type: "publicKey" },
          { name: "totalContractDeposits", type: "u64" },
          { name: "multiplierFactor", type: "u32" },
        ],
      },
    },
    {
      name: "UserDeposits",
      type: {
        kind: "struct",
        fields: [
          { name: "totalDeposits", type: "u64" },
          { name: "deposits", type: { vec: { defined: "DepositInfo" } } },
          { name: "lastDepositId", type: "u64" },
        ],
      },
    },
  ],
  types: [
    {
      name: "DepositInfo",
      type: {
        kind: "struct",
        fields: [
          { name: "id", type: "u64" },
          { name: "amount", type: "u64" },
          { name: "multiplier", type: "u64" },
          { name: "startTime", type: "i64" },
          { name: "active", type: "bool" },
        ],
      },
    },
  ],
  errors: [
    { code: 6000, name: "DepositTooLow", msg: "Deposit amount is too low" },
    { code: 6001, name: "Unauthorized", msg: "Unauthorized access" },
    { code: 6002, name: "InvalidAmount", msg: "Invalid amount" },
    {
      code: 6003,
      name: "InsufficientReserve",
      msg: "Insufficient reserve balance",
    },
  ],
};

// Program ID
const PROGRAM_ID = "8KHNnUhz31tvoqkGjuhxuVYgYT1s7bm3VyneyU5aC2A7";

interface SolviumMultiplierType {
  programData: FormattedProgramData | null;
  userDeposits: FormattedUserDeposits | null;
  isLoading: boolean;
  error: string | null;
  initialize: (multiplierFactor: number) => Promise<string>;
  deposit: (amount: number) => Promise<string>;
  adminWithdraw: (amount: number) => Promise<string>;
  updateMultiplierFactor: (newFactor: number) => Promise<string>;
  fetchProgramData: () => Promise<FormattedProgramData | undefined>;
  fetchUserDeposits: () => Promise<FormattedUserDeposits | undefined>;
}

export const useSolviumMultiplier = (): SolviumMultiplierType => {
  const wallet = useWallet();
  const [programData, setProgramData] = useState<FormattedProgramData | null>(
    null
  );
  const [userDeposits, setUserDeposits] =
    useState<FormattedUserDeposits | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Create a connection to the Solana cluster
  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );

  const getProgram = useCallback(() => {
    if (!wallet.publicKey) return null;

    const provider = new AnchorProvider(connection, wallet as any, {
      preflightCommitment: "confirmed",
    });

    return new Program(idl, new PublicKey(PROGRAM_ID), provider);
  }, [wallet.publicKey, connection]);

  // Get program data PDA
  const getProgramDataPDA = useCallback((): PublicKey | null => {
    const program = getProgram();
    if (!program) return null;

    return PublicKey.findProgramAddressSync(
      [Buffer.from("program-data")],
      program.programId
    )[0];
  }, [getProgram]);

  // Get user deposits PDA
  const getUserDepositsPDA = useCallback((): PublicKey | null => {
    const program = getProgram();
    if (!program || !wallet.publicKey) return null;

    return PublicKey.findProgramAddressSync(
      [Buffer.from("user-deposits"), wallet.publicKey.toBuffer()],
      program.programId
    )[0];
  }, [getProgram, wallet.publicKey]);

  // Initialize the program
  const initialize = async (multiplierFactor: number): Promise<string> => {
    try {
      setIsLoading(true);
      setError(null);

      const program = getProgram();
      if (!program) throw new Error("Program not found");

      const programDataPDA = getProgramDataPDA();
      if (!programDataPDA) throw new Error("Program data PDA not found");
      if (!wallet.publicKey) throw new Error("No wallet address found");

      const tx = await program.methods
        .initialize(multiplierFactor)
        .accounts({
          owner: wallet.publicKey,
          programData: programDataPDA,

          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await fetchProgramData();
      return tx;
    } catch (err: any) {
      console.error("Error initializing program:", err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Deposit funds
  const deposit = async (amount: number): Promise<string> => {
    try {
      setIsLoading(true);
      setError(null);

      const program = getProgram();
      if (!program) throw new Error("Program not found");

      const programDataPDA = getProgramDataPDA();
      if (!programDataPDA) throw new Error("Program data PDA not found");

      const userDepositsPDA = getUserDepositsPDA();
      if (!userDepositsPDA) throw new Error("User deposits PDA not found");
      if (!wallet.publicKey) throw new Error("No wallet address found");

      // Convert amount from SOL to lamports
      const lamports = new BN(amount * LAMPORTS_PER_SOL);

      const tx = await program.methods
        .deposit(lamports)
        .accounts({
          user: wallet.publicKey,
          programData: programDataPDA,
          userDeposits: userDepositsPDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await fetchUserDeposits();
      await fetchProgramData();
      return tx;
    } catch (err: any) {
      console.error("Error depositing funds:", err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Admin withdraw
  const adminWithdraw = async (amount: number): Promise<string> => {
    try {
      setIsLoading(true);
      setError(null);

      const program = getProgram();
      if (!program) throw new Error("Program not found");

      const programDataPDA = getProgramDataPDA();
      if (!programDataPDA) throw new Error("Program data PDA not found");
      if (!wallet.publicKey) throw new Error("No wallet address found");

      // Convert amount from SOL to lamports
      const lamports = new BN(amount * LAMPORTS_PER_SOL);

      const tx = await program.methods
        .adminWithdraw(lamports)
        .accounts({
          owner: wallet.publicKey,
          programData: programDataPDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await fetchProgramData();
      return tx;
    } catch (err: any) {
      console.error("Error withdrawing funds:", err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Update multiplier factor
  const updateMultiplierFactor = async (newFactor: number): Promise<string> => {
    try {
      setIsLoading(true);
      setError(null);

      const program = getProgram();
      if (!program) throw new Error("Program not found");

      const programDataPDA = getProgramDataPDA();
      if (!programDataPDA) throw new Error("Program data PDA not found");
      if (!wallet.publicKey) throw new Error("No wallet address found");

      const tx = await program.methods
        .updateMultiplierFactor(newFactor)
        .accounts({
          owner: wallet.publicKey,
          programData: programDataPDA,
        })
        .rpc();

      await fetchProgramData();
      return tx;
    } catch (err: any) {
      console.error("Error updating multiplier factor:", err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch program data
  const fetchProgramData = async (): Promise<
    FormattedProgramData | undefined
  > => {
    try {
      setIsLoading(true);
      setError(null);

      const program = getProgram();
      if (!program) return;

      const programDataPDA = getProgramDataPDA();
      if (!programDataPDA) return;

      const data = (await program.account.programData.fetch(
        programDataPDA
      )) as unknown as ProgramData;

      // Format the data
      const formattedData: FormattedProgramData = {
        owner: data.owner.toString(),
        totalContractDeposits:
          data.totalContractDeposits.toNumber() / LAMPORTS_PER_SOL,
        multiplierFactor: data.multiplierFactor,
      };

      setProgramData(formattedData);
      return formattedData;
    } catch (err: any) {
      console.error("Error fetching program data:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch user deposits
  const fetchUserDeposits = async (): Promise<
    FormattedUserDeposits | undefined
  > => {
    try {
      setIsLoading(true);
      setError(null);

      const program = getProgram();
      if (!program) return;

      const userDepositsPDA = getUserDepositsPDA();
      if (!userDepositsPDA) return;

      const data = (await program.account.userDeposits.fetch(
        userDepositsPDA
      )) as unknown as UserDeposits;

      const d: FormattedDepositInfo[] = [];
      data.deposits.map((deposit) => {
        const date = (Number(deposit?.startTime) + 604800) * 1000;
        if (date > Date.now())
          d.push({
            id: deposit.id.toNumber(),
            amount: deposit.amount.toNumber() / LAMPORTS_PER_SOL,
            multiplier: deposit.multiplier.toNumber(),
            startTime: new Date(deposit.startTime.toNumber() * 1000),
            active: deposit.active,
          });
      });

      const formattedDeposits: FormattedUserDeposits = {
        totalDeposits: data.totalDeposits.toNumber() / LAMPORTS_PER_SOL,
        deposits: d,
        lastDepositId: data.lastDepositId.toNumber(),
      };

      setUserDeposits(formattedDeposits);
      return formattedDeposits;
    } catch (err: any) {
      console.error("Error fetching user deposits:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Load data when wallet connects
  useEffect(() => {
    if (wallet.publicKey) {
      fetchProgramData();
      fetchUserDeposits();
    } else {
      setProgramData(null);
      setUserDeposits(null);
    }
  }, [wallet.publicKey]);

  return {
    // State
    programData,
    userDeposits,
    isLoading,
    error,

    // Methods
    initialize,
    deposit,
    adminWithdraw,
    updateMultiplierFactor,
    fetchProgramData,
    fetchUserDeposits,
  };
};
