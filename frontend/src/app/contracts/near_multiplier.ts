// import { connect, Contract, keyStores, WalletConnection } from "near-api-js";

// const config = {
//   networkId: "testnet",
//   keyStore: new keyStores.BrowserLocalStorageKeyStore(),
//   nodeUrl: "https://rpc.testnet.near.org",
//   walletUrl: "https://wallet.testnet.near.org",
//   helperUrl: "https://helper.testnet.near.org",
//   explorerUrl: "https://explorer.testnet.near.org",
// };

// export class NearMultiplier {
//   constructor(private contract: Contract) {}

//   static async init(accountId: string): Promise<NearMultiplier> {
//     const near = await connect(config);
//     const walletConnection = new WalletConnection(near, "solvium-multiplier");
//     const contract = new Contract(
//       walletConnection.account(),
//       "YOUR_CONTRACT_ID.testnet",
//       {
//         viewMethods: ["get_deposits"],
//         changeMethods: ["deposit"],
//       }
//     );
//     return new NearMultiplier(contract);
//   }

//   async deposit(amount: string) {
//     return await this.contract.deposit({
//       args: {},
//       amount
//     });
//   }

//   async getDeposits(accountId: string) {
//     return await this.contract.get_deposits({ account_id: accountId });
//   }
// }
