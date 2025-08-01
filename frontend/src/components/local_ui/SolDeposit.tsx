// "use client";

// import { useState, FormEvent, ChangeEvent, useEffect } from "react";
// import { useWallet } from "@solana/wallet-adapter-react";
// import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
// import { useSolviumMultiplier } from "@/app/hooks/useSolMultiplier";

// // Modal component
// export function SolDepositModal({
//   isOpen,
//   onClose,
// }: {
//   isOpen: boolean;
//   onClose: () => void;
// }) {
//   const wallet = useWallet();
//   const [depositAmount, setDepositAmount] = useState<string>("");
//   const [withdrawAmount, setWithdrawAmount] = useState<string>("");
//   const [newFactor, setNewFactor] = useState<string>("");
//   const [txSignature, setTxSignature] = useState<string>("");

//   const {
//     programData,
//     userDeposits,
//     isLoading,
//     error,
//     initialize,
//     deposit,
//     adminWithdraw,
//     updateMultiplierFactor,
//   } = useSolviumMultiplier();

//   const handleDeposit = async (e: FormEvent) => {
//     e.preventDefault();
//     try {
//       const amount = parseFloat(depositAmount);
//       if (isNaN(amount) || amount <= 0) {
//         alert("Please enter a valid amount");
//         return;
//       }

//       const signature = await deposit(amount);
//       setTxSignature(signature);
//       setDepositAmount("");
//     } catch (err) {
//       console.error("Deposit error:", err);
//     }
//   };

//   const handleWithdraw = async (e: FormEvent) => {
//     e.preventDefault();
//     try {
//       const amount = parseFloat(withdrawAmount);
//       if (isNaN(amount) || amount <= 0) {
//         alert("Please enter a valid amount");
//         return;
//       }

//       const signature = await adminWithdraw(amount);
//       setTxSignature(signature);
//       setWithdrawAmount("");
//     } catch (err) {
//       console.error("Withdraw error:", err);
//     }
//   };

//   const handleUpdateFactor = async (e: FormEvent) => {
//     e.preventDefault();
//     try {
//       const factor = parseInt(newFactor);
//       if (isNaN(factor) || factor <= 0) {
//         alert("Please enter a valid factor");
//         return;
//       }

//       const signature = await updateMultiplierFactor(factor);
//       setTxSignature(signature);
//       setNewFactor("");
//     } catch (err) {
//       console.error("Update factor error:", err);
//     }
//   };

//   const isOwner = programData?.owner === wallet.publicKey?.toString();

//   if (!isOpen) return null;

//   return (
//     <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//       <div className="bg-black border-blue-80 border-[2px] w-[85%] rounded-lg p-8 max-w-4xl max-h-[90vh] overflow-y-auto">
//         <div className="flex justify-between items-center mb-6">
//           <h1 className="text-2xl font-bold">Solvium Multiplier</h1>
//           <button
//             onClick={onClose}
//             className="text-gray-500 hover:text-gray-700"
//           >
//             <svg
//               className="w-6 h-6"
//               fill="none"
//               stroke="currentColor"
//               viewBox="0 0 24 24"
//             >
//               <path
//                 strokeLinecap="round"
//                 strokeLinejoin="round"
//                 strokeWidth="2"
//                 d="M6 18L18 6M6 6l12 12"
//               ></path>
//             </svg>
//           </button>
//         </div>

//         {/* Wallet Connection */}
//         <div className="mb-6">
//           <WalletMultiButton />
//         </div>

//         {wallet.connected && (
//           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-5">
//             {/* Deposit Form */}
//             <div className="p-4 border rounded">
//               <h2 className="text-xl font-semibold mb-4">Make a Deposit</h2>
//               <form onSubmit={handleDeposit}>
//                 <div className="mb-4">
//                   <label className="block mb-2 ">Amount (SOL)</label>
//                   <input
//                     type="number"
//                     step="0.01"
//                     value={depositAmount}
//                     onChange={(e: ChangeEvent<HTMLInputElement>) =>
//                       setDepositAmount(e.target.value)
//                     }
//                     className="w-full p-2 border rounded text-black"
//                     required
//                   />
//                 </div>
//                 <button
//                   type="submit"
//                   className="w-full p-2 bg-blue-600 text-white rounded hover:bg-blue-700"
//                   disabled={isLoading}
//                 >
//                   {isLoading ? "Processing..." : "Deposit"}
//                 </button>
//               </form>
//             </div>

//             {/* Admin Section */}
//             {isOwner && (
//               <div className="p-4 border rounded">
//                 <h2 className="text-xl font-semibold mb-4">Admin Controls</h2>

//                 {/* Withdraw Form */}
//                 <form onSubmit={handleWithdraw} className="mb-6">
//                   <h3 className="text-lg font-medium mb-2">Withdraw Funds</h3>
//                   <div className="mb-4">
//                     <label className="block mb-2">Amount (SOL)</label>
//                     <input
//                       type="number"
//                       step="0.01"
//                       value={withdrawAmount}
//                       onChange={(e: ChangeEvent<HTMLInputElement>) =>
//                         setWithdrawAmount(e.target.value)
//                       }
//                       className="w-full p-2 border rounded"
//                       required
//                     />
//                   </div>
//                   <button
//                     type="submit"
//                     className="w-full p-2 bg-green-600 text-white rounded hover:bg-green-700"
//                     disabled={isLoading}
//                   >
//                     {isLoading ? "Processing..." : "Withdraw"}
//                   </button>
//                 </form>

//                 {/* Update Factor Form */}
//                 <form onSubmit={handleUpdateFactor}>
//                   <h3 className="text-lg font-medium mb-2">
//                     Update Multiplier Factor
//                   </h3>
//                   <div className="mb-4">
//                     <label className="block mb-2">New Factor</label>
//                     <input
//                       type="number"
//                       value={newFactor}
//                       onChange={(e: ChangeEvent<HTMLInputElement>) =>
//                         setNewFactor(e.target.value)
//                       }
//                       className="w-full p-2 border rounded"
//                       required
//                     />
//                   </div>
//                   <button
//                     type="submit"
//                     className="w-full p-2 bg-purple-600 text-white rounded hover:bg-purple-700"
//                     disabled={isLoading}
//                   >
//                     {isLoading ? "Processing..." : "Update Factor"}
//                   </button>
//                 </form>
//               </div>
//             )}
//           </div>
//         )}

//         {error && (
//           <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
//             Error: {error}
//           </div>
//         )}

//         {isLoading && <p>Loading...</p>}

//         {/* Program Info */}
//         {programData && (
//           <div className="mb-6 p-4 border rounded">
//             <h2 className="text-xl font-semibold mb-2">Program Info</h2>
//             <p>Owner: {programData.owner}</p>
//             <p>
//               Total Contract Deposits: {programData.totalContractDeposits} SOL
//             </p>
//             <p>Multiplier Factor: {programData.multiplierFactor}</p>
//           </div>
//         )}

//         {/* User Deposits */}
//         {userDeposits && (
//           <div className="mb-6 p-4 border rounded">
//             <h2 className="text-xl font-semibold mb-2">Your Deposits</h2>
//             <p>Total Deposits: {userDeposits.totalDeposits} SOL</p>

//             {userDeposits.deposits.length > 0 ? (
//               <div className="mt-4">
//                 <h3 className="text-lg font-medium mb-2">Deposit History</h3>
//                 <div className="overflow-x-auto">
//                   <table className="min-w-full">
//                     <thead>
//                       <tr>
//                         <th className="px-4 py-2 text-left">ID</th>
//                         <th className="px-4 py-2 text-left">Amount (SOL)</th>
//                         <th className="px-4 py-2 text-left">Multiplier</th>
//                         <th className="px-4 py-2 text-left">Start Time</th>
//                         <th className="px-4 py-2 text-left">Status</th>
//                       </tr>
//                     </thead>
//                     <tbody>
//                       {userDeposits.deposits.map((deposit: any) => (
//                         <tr key={deposit.id}>
//                           <td className="px-4 py-2">{deposit.id}</td>
//                           <td className="px-4 py-2">{deposit.amount}</td>
//                           <td className="px-4 py-2">{deposit.multiplier}</td>
//                           <td className="px-4 py-2">
//                             {deposit.startTime.toLocaleString()}
//                           </td>
//                           <td className="px-4 py-2">
//                             {deposit.active ? "Active" : "Inactive"}
//                           </td>
//                         </tr>
//                       ))}
//                     </tbody>
//                   </table>
//                 </div>
//               </div>
//             ) : (
//               <p className="mt-2">No deposits yet</p>
//             )}
//           </div>
//         )}

//         {/* Transaction Result */}
//         {txSignature && (
//           <div className="mt-6 p-4  rounded">
//             <p className="font-medium">Transaction successful!</p>
//             <p className="text-sm break-all mt-2">Signature: {txSignature}</p>
//             <a
//               href={`https://explorer.solana.com/tx/${txSignature}`}
//               target="_blank"
//               rel="noopener noreferrer"
//               className="text-blue-600 hover:underline mt-2 inline-block"
//             >
//               View on Solana Explorer
//             </a>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// // Main component with modal trigger button
// export default function SolDepositButton() {
//   const [isModalOpen, setIsModalOpen] = useState(false);

//   const openModal = () => setIsModalOpen(true);
//   const closeModal = () => setIsModalOpen(false);

//   return (
//     <div>
//       <button
//         onClick={openModal}
//         className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
//       >
//         Open Solvium Multiplier
//       </button>
//       <SolDepositModal isOpen={isModalOpen} onClose={closeModal} />
//     </div>
//   );
// }

import { useState, FormEvent, ChangeEvent, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import {
  Check,
  X,
  ChevronRight,
  Wallet,
  CreditCard,
  Settings,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSolviumMultiplier } from "@/app/hooks/useSolMultiplier";

// Modal component
export function SolDepositModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const wallet = useWallet();
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [newFactor, setNewFactor] = useState<string>("");
  const [txSignature, setTxSignature] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"deposit" | "admin" | "info">(
    "deposit"
  );

  const {
    programData,
    deposit,
    isLoading,
    error,
    adminWithdraw,
    updateMultiplierFactor,
    userDeposits,
  } = useSolviumMultiplier();

  const handleDeposit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const amount = parseFloat(depositAmount);
      if (isNaN(amount) || amount <= 0) {
        alert("Please enter a valid amount");
        return;
      }

      const signature = await deposit(amount);
      setTxSignature(signature);
      setDepositAmount("");
    } catch (err) {
      console.error("Deposit error:", err);
    }
  };

  const handleWithdraw = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const amount = parseFloat(withdrawAmount);
      if (isNaN(amount) || amount <= 0) {
        alert("Please enter a valid amount");
        return;
      }

      const signature = await adminWithdraw(amount);
      setTxSignature(signature);
      setWithdrawAmount("");
    } catch (err) {
      console.error("Withdraw error:", err);
    }
  };

  const handleUpdateFactor = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const factor = parseInt(newFactor);
      if (isNaN(factor) || factor <= 0) {
        alert("Please enter a valid factor");
        return;
      }

      const signature = await updateMultiplierFactor(factor);
      setTxSignature(signature);
      setNewFactor("");
    } catch (err) {
      console.error("Update factor error:", err);
    }
  };

  const isOwner = programData?.owner === wallet.publicKey?.toString();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h1 className="text-2xl font-bold">Solvium Multiplier</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="md:w-64 border-r bg-muted/30">
            <div className="p-4">
              <WalletMultiButton />
            </div>

            <nav className="px-2 py-4">
              <button
                onClick={() => setActiveTab("deposit")}
                className={cn(
                  "flex items-center w-full px-4 py-3 mb-2 rounded-lg text-left transition-colors",
                  activeTab === "deposit"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                )}
              >
                <Wallet className="mr-3 h-5 w-5" />
                <span className="font-medium">Deposit</span>
              </button>

              {isOwner && (
                <button
                  onClick={() => setActiveTab("admin")}
                  className={cn(
                    "flex items-center w-full px-4 py-3 mb-2 rounded-lg text-left transition-colors",
                    activeTab === "admin"
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  )}
                >
                  <Settings className="mr-3 h-5 w-5" />
                  <span className="font-medium">Admin Controls</span>
                </button>
              )}

              <button
                onClick={() => setActiveTab("info")}
                className={cn(
                  "flex items-center w-full px-4 py-3 mb-2 rounded-lg text-left transition-colors",
                  activeTab === "info"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                )}
              >
                <CreditCard className="mr-3 h-5 w-5" />
                <span className="font-medium">Info & History</span>
              </button>
            </nav>

            {/* Program Info Summary */}
            {programData && (
              <div className="p-4 border-t">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  Program Summary
                </h3>
                <div className="text-sm">
                  <div className="flex justify-between mb-1">
                    <span>Total Deposits:</span>
                    <span className="font-medium">
                      {programData.totalContractDeposits.toFixed(2)} SOL
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Multiplier:</span>
                    <span className="font-medium">
                      {programData.multiplierFactor}x
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {error && <ErrorNotification message={error} />}

            {isLoading ? (
              <div className="flex justify-center items-center h-[100%] ">
                <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <>
                {/* Deposit Tab */}
                {activeTab === "deposit" && wallet.connected && (
                  <div className="space-y-6">
                    <div className="bg-card border rounded-xl p-6 shadow-sm">
                      <h2 className="text-xl font-semibold mb-4">
                        Make a Deposit
                      </h2>
                      <form onSubmit={handleDeposit}>
                        <div className="mb-4">
                          <label className="block text-sm font-medium mb-2">
                            Amount (SOL)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              value={depositAmount}
                              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                setDepositAmount(e.target.value)
                              }
                              className=" text-black p-2 w-full"
                              placeholder="Enter amount"
                              required
                            />
                          </div>
                        </div>

                        <div className="bg-muted/50 p-4 rounded-lg mb-6">
                          <div className="flex justify-between mb-2">
                            <span className="text-sm">Current Multiplier:</span>
                            <span className="font-medium">
                              {programData?.multiplierFactor}x
                            </span>
                          </div>
                          {depositAmount &&
                            !isNaN(parseFloat(depositAmount)) && (
                              <div className="flex justify-between">
                                <span className="text-sm">
                                  Potential Returns:
                                </span>
                                <span className="font-medium text-primary">
                                  {(
                                    parseFloat(depositAmount) *
                                    100 *
                                    (programData?.multiplierFactor ?? 0)
                                  ).toFixed(1)}
                                  x
                                </span>
                              </div>
                            )}
                        </div>

                        <Button
                          type="submit"
                          className="w-full"
                          disabled={isLoading}
                        >
                          {isLoading ? "Processing..." : "Deposit SOL"}
                        </Button>
                      </form>
                    </div>

                    {/* User Deposit Summary */}
                    {userDeposits && (
                      <div className="bg-muted/30 rounded-xl p-6 border">
                        <h3 className="font-medium mb-3">
                          Your Deposit Summary
                        </h3>
                        <div className="flex justify-between mb-2">
                          <span>Total Deposited:</span>
                          <span className="font-semibold">
                            {userDeposits.totalDeposits} SOL
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Active Deposits:</span>
                          <span className="font-semibold">
                            {
                              userDeposits.deposits.filter((d) => d.active)
                                .length
                            }
                          </span>
                        </div>

                        <Button
                          variant="outline"
                          className="w-full mt-4"
                          onClick={() => setActiveTab("info")}
                        >
                          View Full History
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Admin Tab */}
                {activeTab === "admin" && isOwner && wallet.publicKey && (
                  <div className="space-y-6">
                    {/* Withdraw Form */}
                    <div className="bg-card border rounded-xl p-6 shadow-sm">
                      <h2 className="text-xl font-semibold mb-4">
                        Withdraw Funds
                      </h2>
                      <form onSubmit={handleWithdraw}>
                        <div className="mb-4">
                          <label className="block text-sm font-medium mb-2">
                            Amount (SOL)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              value={withdrawAmount}
                              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                setWithdrawAmount(e.target.value)
                              }
                              className="pr-16"
                              placeholder="Enter amount"
                              required
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                              SOL
                            </span>
                          </div>
                        </div>
                        <Button
                          type="submit"
                          variant="outline"
                          className="w-full"
                          disabled={isLoading}
                        >
                          {isLoading ? "Processing..." : "Withdraw Funds"}
                        </Button>
                      </form>
                    </div>

                    {/* Update Factor Form */}
                    <div className="bg-card border rounded-xl p-6 shadow-sm">
                      <h2 className="text-xl font-semibold mb-4">
                        Update Multiplier Factor
                      </h2>
                      <form onSubmit={handleUpdateFactor}>
                        <div className="mb-4">
                          <label className="block text-sm font-medium mb-2">
                            New Multiplier Factor
                          </label>
                          <input
                            type="number"
                            value={newFactor}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                              setNewFactor(e.target.value)
                            }
                            placeholder="Enter new factor"
                            required
                          />
                        </div>
                        <div className="bg-muted/50 p-4 rounded-lg mb-6">
                          <div className="flex justify-between mb-2">
                            <span className="text-sm">Current Factor:</span>
                            <span className="font-medium">
                              {programData?.multiplierFactor}x
                            </span>
                          </div>
                          {newFactor && !isNaN(parseInt(newFactor)) && (
                            <div className="flex justify-between">
                              <span className="text-sm">New Factor:</span>
                              <span className="font-medium">{newFactor}x</span>
                            </div>
                          )}
                        </div>
                        <Button
                          type="submit"
                          className="w-full"
                          disabled={isLoading}
                        >
                          {isLoading ? "Processing..." : "Update Factor"}
                        </Button>
                      </form>
                    </div>
                  </div>
                )}

                {/* Info & History Tab */}
                {activeTab === "info" && (
                  <div className="space-y-6">
                    {/* Program Info */}
                    {/* {programData && (
                      <div className="bg-card border rounded-xl p-6 shadow-sm">
                        <h2 className="text-xl font-semibold mb-4">
                          Program Information
                        </h2>
                        <div className="space-y-3">
                          <div className="flex justify-between pb-2 border-b">
                            <span className="text-muted-foreground">Owner</span>
                            <span className="font-medium truncate max-w-[250px]">
                              {programData.owner}
                            </span>
                          </div>
                          <div className="flex justify-between pb-2 border-b">
                            <span className="text-muted-foreground">
                              Total Contract Deposits
                            </span>
                            <span className="font-medium">
                              {programData.totalContractDeposits} SOL
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Multiplier Factor
                            </span>
                            <span className="font-medium">
                              {programData.multiplierFactor}x
                            </span>
                          </div>
                        </div>
                      </div>
                    )} */}

                    {/* User Deposits */}
                    {userDeposits && (
                      <div className="bg-card border rounded-xl p-6 shadow-sm">
                        <h2 className="text-xl font-semibold mb-4">
                          Your Deposits
                        </h2>
                        <div className="flex justify-between mb-6 p-3 bg-muted/50 rounded-lg">
                          <span>Total Deposits:</span>
                          <span className="font-bold">
                            {userDeposits.totalDeposits.toFixed(3)} SOL
                          </span>
                        </div>

                        {userDeposits.deposits.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b">
                                  <th className="py-3 px-4 text-left font-medium text-muted-foreground">
                                    ID
                                  </th>
                                  <th className="py-3 px-4 text-left font-medium text-muted-foreground">
                                    Amount
                                  </th>
                                  <th className="py-3 px-4 text-left font-medium text-muted-foreground">
                                    Multiplier
                                  </th>
                                  <th className="py-3 px-4 text-left font-medium text-muted-foreground">
                                    Date
                                  </th>
                                  <th className="py-3 px-4 text-left font-medium text-muted-foreground">
                                    Status
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {userDeposits.deposits.map((deposit: any) => (
                                  <tr
                                    key={deposit.id}
                                    className="border-b last:border-b-0"
                                  >
                                    <td className="py-3 px-4">{deposit.id}</td>
                                    <td className="py-3 px-4">
                                      {deposit.amount} SOL
                                    </td>
                                    <td className="py-3 px-4">
                                      {deposit.multiplier}x
                                    </td>
                                    <td className="py-3 px-4">
                                      {deposit.startTime.toLocaleDateString()}
                                    </td>
                                    <td className="py-3 px-4">
                                      <span
                                        className={cn(
                                          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                                          deposit.active
                                            ? "bg-green-100 text-green-800"
                                            : "bg-gray-100 text-gray-800"
                                        )}
                                      >
                                        {deposit.active ? (
                                          <>
                                            <Check className="mr-1 h-3 w-3" />
                                            Active
                                          </>
                                        ) : (
                                          "Inactive"
                                        )}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <p>No deposits yet</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Not Connected */}
                {!wallet.connected && (
                  <div className="flex flex-col items-center justify-center h-[40vh]">
                    <div className="text-center mb-6">
                      <h2 className="text-xl font-semibold mb-2">
                        Connect Your Wallet
                      </h2>
                      <p className="text-muted-foreground mb-6">
                        Please connect your Solana wallet to use this
                        application
                      </p>
                      <WalletMultiButton />
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Transaction Result */}
            {txSignature && !isLoading && (
              <div className="mt-6 p-4 bg-green-100/10 border border-green-200/20 rounded-lg">
                <div className="flex items-start">
                  <div className="flex-shrink-0 bg-green-100 rounded-full p-1">
                    <Check className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="ml-3">
                    <p className="font-medium">Transaction successful!</p>
                    <p className="text-sm text-muted-foreground break-all mt-1">
                      Signature: {txSignature}
                    </p>
                    <a
                      href={`https://explorer.solana.com/tx/${txSignature}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline mt-2 inline-flex items-center text-sm"
                    >
                      View on Solana Explorer
                      <ChevronRight className="ml-1 h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ErrorNotificationProps {
  message: string;
  onDismiss?: () => void;
  autoClose?: boolean;
  duration?: number;
}

const ErrorNotification = ({
  message,
  onDismiss,
  autoClose = true,
  duration = 5000,
}: ErrorNotificationProps) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (autoClose && message) {
      const timer = setTimeout(() => {
        setVisible(false);
        if (onDismiss) onDismiss();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [message, autoClose, duration, onDismiss]);

  if (!message || !visible) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-4 rounded-lg shadow-md",
        "bg-destructive/10 border border-destructive/20 text-destructive",
        "animate-in fade-in slide-in-from-top-2 duration-300",
        "w-full"
      )}
    >
      <AlertTriangle className="h-5 w-5 flex-shrink-0" />
      <p className="text-sm flex-1">{message}</p>
      {onDismiss && (
        <button
          onClick={() => {
            setVisible(false);
            onDismiss();
          }}
          className="p-1 rounded-full hover:bg-destructive/10"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
