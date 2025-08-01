// import { useNearWallet } from "../hooks/useNearWallet";
// import { WALLET_CONFIG } from "../config/wallet";

// export function WalletConnector() {
//   const {
//     connectWallet,
//     disconnectWallet,
//     connected,
//     accountId,
//     loading,
//     error,
//   } = useNearWallet();

//   if (loading) {
//     return <div>Loading...</div>;
//   }

//   if (error) {
//     return <div>Error: {error.message}</div>;
//   }

//   return (
//     <button
//       onClick={connected ? disconnectWallet : connectWallet}
//       className="wallet-button"
//     >
//       {connected ? `Disconnect ${accountId}` : "Connect NEAR"}
//     </button>
//   );
// }
