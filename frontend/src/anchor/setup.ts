// import { IdlAccounts, Program } from "@coral-xyz/anchor";
// import { clusterApiUrl, Connection, PublicKey } from "@solana/web3.js";
// import { IDL, SolanaMultiplier } from "./idl";

// const programId = new PublicKey("8KHNnUhz31tvoqkGjuhxuVYgYT1s7bm3VyneyU5aC2A7");
// const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

// // Initialize the program interface with the IDL, program ID, and connection.
// // This setup allows us to interact with the on-chain program using the defined interface.
// export const program = new Program<SolanaMultiplier>(IDL, programId, {
//   connection,
// });

// export const [counterPDA] = PublicKey.findProgramAddressSync(
//   [Buffer.from("counter")],
//   program.programId,
// );

// // This is just a TypeScript type for the Counter data structure based on the IDL
// // We need this so TypeScript doesn't yell at us
// export type CounterData = IdlAccounts<SolanaMultiplier>["counter"];
