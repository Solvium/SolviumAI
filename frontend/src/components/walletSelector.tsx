import { useEffect, useMemo, useState } from "react";
import { TonConnectButton } from "@tonconnect/ui-react";
import { XMarkIcon } from "@heroicons/react/24/solid";
import { useWallet } from "@/app/contexts/WalletContext";

const UnifiedWalletConnector = () => {
  const [showNetworkModal, setShowNetworkModal] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<"TON" | "NEAR" | null>(
    "NEAR"
  );
  const {
    connect: connectNear,
    disconnect: disconnectNear,
    state: { isConnected, accountId, selector },
  } = useWallet();

  const isWalletConnected = useMemo(() => {
    if (isConnected) {
      return isConnected;
    }
    if (selectedNetwork === "TON") {
      return true;
    }
    return false;
  }, [isConnected, selectedNetwork]);

  const handleNetworkSelect = (network: "TON" | "NEAR") => {
    setSelectedNetwork(network);
    setShowNetworkModal(false);
    if (network === "NEAR") {
      if (!isConnected) {
        connectNear();
      }
    }
    // TON uses its own button component
  };

  const handleDisconnect = () => {
    if (selectedNetwork === "NEAR") {
      disconnectNear();
    }
    setSelectedNetwork(null);
  };

  // Show connected state if already connected
  //   const renderWalletButton = () => {
  //     if (isConnected && selectedNetwork === "NEAR") {
  //       return (
  //         <div className="relative group">
  //           <button
  //             onClick={handleDisconnect}
  //             className="px-6 py-3 bg-[#010c18] text-white rounded-lg
  //                      border-2 border-blue-500 hover:border-red-500
  //                      transition-colors duration-200"
  //           >
  //             {accountId
  //               ? `NEAR: ${accountId.slice(0, 6)}...${accountId.slice(-4)}`
  //               : "Connected"}
  //           </button>
  //         </div>
  //       );
  //     }

  //     if (selectedNetwork === "TON") {
  //       return (
  //         <div className="relative group">
  //           <TonConnectButton />
  //         </div>
  //       );
  //     }
  //     return (
  //       <button
  //         onClick={() => setShowNetworkModal(true)}
  //         className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600
  //                  text-white rounded-lg shadow-lg hover:scale-105
  //                  transition-transform duration-200"
  //       >
  //         Connect Wallet
  //       </button>
  //     );
  //   };

  const renderWalletButton = () => {
    // If already connected, show connected state
    if (isWalletConnected) {
      return (
        <div className="relative group">
          <button
            onClick={handleDisconnect}
            className="px-6 py-3 bg-[#010c18] text-white rounded-lg
                       border-2 border-blue-500 hover:border-red-500
                       transition-colors duration-200"
          >
            {accountId
              ? `NEAR: ${accountId.slice(0, 6)}...${accountId.slice(-4)}`
              : "Connected"}
          </button>
        </div>
      );

      if (selectedNetwork === "TON") {
        return (
          <div className="relative group">
            <TonConnectButton />
          </div>
        );
      }
    }

    // Show connect button only if no wallet is connected
    return (
      <button
        onClick={() => setShowNetworkModal(true)}
        className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600
                 text-white rounded-lg shadow-lg hover:scale-105
                 transition-transform duration-200"
      >
        Connect Wallet
      </button>
    );
  };
  //   return (
  //     <div>
  //       {!selectedNetwork ? (
  //         <button
  //           onClick={() => setShowNetworkModal(true)}
  //           className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600
  //                    text-white rounded-lg shadow-lg hover:scale-105
  //                    transition-transform duration-200"
  //         >
  //           Connect Wallet
  //         </button>
  //       ) : selectedNetwork === "TON" ? (
  //         <div className="relative group">
  //           <TonConnectButton />
  //         </div>
  //       ) : (
  //         <div className="relative group">
  //           <button
  //             onClick={handleDisconnect}
  //             className="px-6 py-3 bg-[#010c18] text-white rounded-lg
  //                      border-2 border-blue-500 hover:border-red-500
  //                      transition-colors duration-200"
  //           >
  //             Disconnect {nearState.accountId}
  //           </button>
  //         </div>
  //       )}

  //       {showNetworkModal && (
  //         <div className="fixed inset-0 p-4 bg-black bg-opacity-50 flex items-center justify-center z-[2500]">
  //           <div className="bg-[#010c18] p-6 rounded-lg border-2 border-blue-80">
  //             <h3 className="text-xl text-white mb-4">Select Network</h3>
  //             <div className="flex gap-4">
  //               <button
  //                 onClick={() => handleNetworkSelect("TON")}
  //                 className="px-4 py-2 bg-blue-600 text-white rounded"
  //               >
  //                 TON
  //               </button>
  //               <button
  //                 onClick={() => handleNetworkSelect("NEAR")}
  //                 className="px-4 py-2 bg-blue-600 text-white rounded"
  //               >
  //                 NEAR
  //               </button>
  //             </div>
  //             <button
  //               onClick={() => setShowNetworkModal(false)}
  //               className="mt-4 px-4 py-2 text-gray-400 hover:text-white"
  //             >
  //               Cancel
  //             </button>
  //           </div>
  //         </div>
  //       )}
  //     </div>
  //   );
  // };

  //   return (
  //     <div>
  //       {!selectedWallet ? (
  //         <button
  //           onClick={() => setShowModal(true)}
  //           className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600
  //                    text-white rounded-lg shadow-lg hover:scale-105
  //                    transition-transform duration-200"
  //         >
  //           Connect Wallet
  //         </button>
  //       ) : selectedWallet === "TON" ? (
  //         <div className="relative group">
  //           <TonConnectButton />
  //           <button
  //             onClick={handleDisconnect}
  //             className="absolute -top-2 -right-2 p-1 bg-red-500 rounded-full
  //                      opacity-0 group-hover:opacity-100 transition-opacity"
  //           >
  //             <XMarkIcon className="h-4 w-4 text-white" />
  //           </button>
  //         </div>
  //       ) : (
  //         <div className="relative group">
  //           <button
  //             onClick={handleDisconnect}
  //             className="px-6 py-3 bg-[#010c18] text-white rounded-lg
  //                      border-2 border-blue-500 hover:border-red-500
  //                      transition-colors duration-200"
  //           >
  //             {accountId
  //               ? `NEAR: ${accountId.slice(0, 6)}...${accountId.slice(-4)}`
  //               : "Connected"}
  //           </button>
  //         </div>
  //       )}

  //       {showModal && (
  //         <div
  //           className="fixed z-[1000] inset-0 bg-black/70 backdrop-blur-sm
  //                       flex items-center justify-center
  //                       animate-fadeIn"
  //         >
  //           <div
  //             className="bg-[#010c18] border-4 border-blue-500 p-8 rounded-2xl
  //                         shadow-2xl transform transition-all
  //                         animate-slideIn"
  //           >
  //             <h2 className="text-2xl text-white mb-6 font-bold">
  //               Select Wallet
  //             </h2>
  //             <div className="flex gap-6">
  //               <WalletOption
  //                 name="TON"
  //                 onClick={() => handleWalletSelect("TON")}
  //                 icon="/ton-icon.svg"
  //               />
  //               <WalletOption
  //                 name="NEAR"
  //                 onClick={() => handleWalletSelect("NEAR")}
  //                 icon="/near-icon.svg"
  //               />
  //             </div>
  //           </div>
  //         </div>
  //       )}
  //     </div>
  //   );
  // };
  return (
    <div>
      {renderWalletButton()}

      {showNetworkModal && (
        <div className="fixed inset-0 p-4 bg-black bg-opacity-50 flex items-center justify-center z-[2500]">
          <div className="bg-[#010c18] p-6 rounded-lg border-2 border-blue-80">
            <h3 className="text-xl text-white mb-4">Select Network</h3>
            <div className="flex gap-4">
              <button
                onClick={() => handleNetworkSelect("NEAR")}
                className="px-4 py-2 bg-blue-600 text-white rounded"
              >
                NEAR
              </button>
            </div>
            <button
              onClick={() => setShowNetworkModal(false)}
              className="mt-4 px-4 py-2 text-gray-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const WalletOption = ({
  name,
  onClick,
  icon,
}: {
  name: string;
  onClick: () => void;
  icon: string;
}) => (
  <button
    onClick={onClick}
    className="p-6 border-2 border-blue-500 rounded-xl
               hover:border-purple-500 transition-colors duration-200
               flex flex-col items-center gap-4 min-w-[140px]"
  >
    <img src={icon} alt={name} className="w-12 h-12" />
    <span className="text-white font-medium">{name} Wallet</span>
  </button>
);

export default UnifiedWalletConnector;
