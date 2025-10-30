"use client";

import { useEffect, useRef, useState } from "react";
import { usePrivateKeyWallet } from "@/contexts/PrivateKeyWalletContext";
import { useWalletPortfolioContext } from "@/contexts/WalletPortfolioContext";
import { ArrowLeft, QrCode, Search, CheckCircle, XCircle, Check, X, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAccountInventory } from "@/lib/nearblocks";
import { DEFAULT_TOKENS } from "@/lib/tokens";

interface SendFlowProps {
  onClose: () => void;
  onSuccess: () => void;
}

type SendStep = "selectRecipient" | "selectToken" | "enterAmount" | "confirmed";

const SendFlow = ({ onClose, onSuccess }: SendFlowProps) => {
  const [step, setStep] = useState<SendStep>("selectRecipient");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyingRecipient, setVerifyingRecipient] = useState(false);
  const [recipientValid, setRecipientValid] = useState<boolean | null>(null);
  const {
    sendNearNative,
    verifyRecipient,
    accountId,
    sendFungibleToken,
    checkTokenRegistrationFor,
    registerTokenFor,
  } = usePrivateKeyWallet();
  const { nearBalance } = useWalletPortfolioContext();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Live NEAR price (USD) for confirmation fiat value
  const [nearPriceUsd, setNearPriceUsd] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const fetchNearPrice = async () => {
    try {
      setPriceLoading(true);
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=near&vs_currencies=usd",
        { cache: "no-store" }
      );
      const data = await res.json().catch(() => null);
      const p = Number(data?.near?.usd);
      if (!isNaN(p) && p > 0) setNearPriceUsd(p);
    } catch {
      // ignore price failures
    } finally {
      setPriceLoading(false);
    }
  };

  // Simple token selector state
  type Token = {
    symbol: string;
    name: string;
    kind: "native" | "ft";
    address?: string;
    balance?: string | number;
    rawAmount?: string;
    decimals?: number;
  };
  const [tokenSelectorOpen, setTokenSelectorOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<Token>({
    symbol: "NEAR",
    name: "NEAR",
    kind: "native",
  });

  // Update selectedToken with NEAR balance when available
  useEffect(() => {
    if (selectedToken.kind === "native" && nearBalance) {
      setSelectedToken((prev) => ({
        ...prev,
        balance: nearBalance,
      }));
    }
  }, [nearBalance, selectedToken.kind]);
  const [availableTokens, setAvailableTokens] = useState<Token[]>([
    { symbol: "NEAR", name: "NEAR", kind: "native" },
  ]);

  // Helper to format raw amount by decimals -> human string
  const formatByDecimals = (
    raw: string | number | undefined,
    decimals?: number
  ): string => {
    if (raw === undefined || raw === null) return "0";
    const rawStr = String(raw);
    const d = typeof decimals === "number" && decimals >= 0 ? decimals : 0;
    if (d === 0) return rawStr;
    const negative = rawStr.startsWith("-");
    const digits = negative ? rawStr.slice(1) : rawStr;
    const padded = digits.padStart(d + 1, "0");
    const i = padded.length - d;
    const whole = padded.slice(0, i);
    const frac = padded.slice(i).replace(/0+$/, "");
    const out = frac ? `${whole}.${frac}` : whole;
    return negative ? `-${out}` : out;
  };

  // Helper to truncate long addresses
  const truncateAddress = (address: string, maxLength: number = 20): string => {
    if (!address || address.length <= maxLength) return address;
    const start = address.slice(0, Math.floor(maxLength / 2));
    const end = address.slice(-Math.floor(maxLength / 2));
    return `${start}...${end}`;
  };

  // Load token inventory for selector
  useEffect(() => {
    (async () => {
      const acc = accountId as string | null;
      if (!acc) return;
      try {
        const inv = await getAccountInventory(acc);
        // Nearblocks inventory: prefer inventory.fts shape
        const fts =
          (Array.isArray((inv as any)?.fts) && (inv as any).fts) || [];

        const mapped: Token[] = (fts as Array<any>)
          .filter(Boolean)
          .map((t: any) => {
            const decimals: number | undefined = t?.ft_meta?.decimals;
            const raw =
              t?.amount ||
              t?.balance ||
              t?.quantity ||
              t?.total ||
              t?.balance_formatted;
            const balance = formatByDecimals(raw, decimals);
            return {
              symbol:
                t?.ft_meta?.symbol ||
                t?.symbol ||
                t?.token ||
                t?.ticker ||
                "FT",
              name:
                t?.ft_meta?.name ||
                t?.name ||
                t?.token ||
                t?.contract ||
                "Fungible Token",
              kind: "ft" as const,
              address: t?.contract || t?.token_contract || t?.token,
              balance,
              rawAmount: raw ? String(raw) : undefined,
              decimals,
            };
          })
          .filter((t) => {
            // Hide tokens with zero balance
            const balance = parseFloat(t.balance || "0");
            if (balance <= 0) return false;

            // Hide any bridged tokens (.e tokens or factory.bridge.near)
            const tokenId = t.address || "";
            if (
              tokenId.includes(".e") ||
              tokenId.includes("factory.bridge.near")
            ) {
              return false;
            }

            return true;
          });

        // Deduplicate by address+symbol
        const uniqMap = new Map<string, Token>();
        for (const m of mapped) {
          const key = `${m.address || m.symbol}`;
          if (!uniqMap.has(key)) uniqMap.set(key, m);
        }

        // Merge known defaults (USDC/USDT) so they appear even if not held
        const known: Token[] = DEFAULT_TOKENS.filter(
          (k) => k.kind === "ft"
        ).map((k) => ({
          symbol: k.symbol,
          name: k.name,
          kind: "ft" as const,
          address: k.address,
          balance: k.symbol === "NEAR" ? undefined : undefined,
          decimals: k.decimals,
        }));
        const tokens: Token[] = [
          {
            symbol: "NEAR",
            name: "NEAR",
            kind: "native",
            balance: nearBalance || "0",
          },
          ...known,
          ...uniqMap.values(),
        ];
        setAvailableTokens(tokens);
      } catch (e) {
        // On failure, keep NEAR only
        setAvailableTokens([{ symbol: "NEAR", name: "NEAR", kind: "native" }]);
      }
    })();
  }, [accountId, nearBalance]);

  // Address book (localStorage)
  type Contact = { name: string; address: string; avatar?: string };
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const addressBookKey = "wallet_address_book";
  useEffect(() => {
    try {
      const raw = localStorage.getItem(addressBookKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setContacts(parsed);
      }
    } catch {
      // ignore
    }
  }, []);
  const persistContacts = (items: Contact[]) => {
    setContacts(items);
    try {
      localStorage.setItem(addressBookKey, JSON.stringify(items));
    } catch {
      // ignore
    }
  };
  const handleSaveContact = () => {
    const addr = recipient.trim();
    if (!addr) return;
    // Basic account id pattern check to avoid empty/garbage saves
    if (!/^[a-zA-Z0-9._-]+$/.test(addr)) return;
    const exists = contacts.some(
      (c) => c.address.toLowerCase() === addr.toLowerCase()
    );
    if (exists) return;
    const defaultName = addr.includes(".") ? addr.split(".")[0] : addr;
    const next = [{ name: defaultName, address: addr }, ...contacts].slice(
      0,
      100
    );
    persistContacts(next);
  };

  const handleNumberClick = (num: string) => {
    if (num === "." && amount.includes(".")) return;
    setAmount((prev) => prev + num);
  };

  const handleBackspace = () => {
    setAmount((prev) => prev.slice(0, -1));
  };

  // Allow typing amount with physical keyboard (desktop) or mobile keyboard
  const handleAmountChange = (value: string) => {
    // Accept only digits and one optional decimal point, up to 24 fractional places
    if (/^\d*(?:\.\d{0,24})?$/.test(value)) {
      setAmount(value);
    }
  };

  const handleMaxClick = () => {
    if (selectedToken.balance !== undefined) {
      setAmount(String(selectedToken.balance));
    }
  };

  const handleRecipientChange = async (value: string) => {
    setRecipient(value);
    setRecipientValid(null);

    // Only verify if the recipient looks like a valid NEAR account ID
    if (value.trim() && /^[a-zA-Z0-9._-]+$/.test(value.trim())) {
      setVerifyingRecipient(true);
      try {
        const isValid = await verifyRecipient(value.trim());
        setRecipientValid(isValid);
      } catch (error) {
        console.error("Error verifying recipient:", error);
        setRecipientValid(false);
      } finally {
        setVerifyingRecipient(false);
      }
    }
  };

  const stopScanner = () => {
    setScannerOpen(false);
    setScannerError(null);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const startScanner = async () => {
    setScannerError(null);
    try {
      // Check support for camera
      if (!navigator.mediaDevices?.getUserMedia) {
        setScannerError("Camera access is not supported on this device.");
        setScannerOpen(true);
        return;
      }

      setScannerOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (e: any) {
      setScannerError(e?.message || "Failed to start camera");
      setScannerOpen(true);
    }
  };

  useEffect(() => {
    if (!scannerOpen) return;

    let cancelled = false;
    let rafId = 0;

    // Use native BarcodeDetector if available
    // @ts-ignore
    const SupportedDetector: any = (window as any).BarcodeDetector;
    const detector = SupportedDetector
      ? // @ts-ignore
        new SupportedDetector({ formats: ["qr_code"] })
      : null;

    const scan = async () => {
      try {
        if (cancelled || !videoRef.current) return;
        if (detector && videoRef.current.readyState >= 2) {
          const results = await detector.detect(videoRef.current as any);
          if (results && results.length > 0) {
            const value = results[0]?.rawValue || results[0]?.rawText;
            if (value) {
              // Extract address if a transfer URL was scanned, otherwise use raw value
              const matched = /transfer\/(.+)$/i.exec(value);
              const addr = matched ? matched[1] : value;
              await handleRecipientChange(addr.trim());
              stopScanner();
              return;
            }
          }
        }
      } catch (e) {
        // Swallow errors to keep scanning
      }
      rafId = requestAnimationFrame(scan);
    };

    rafId = requestAnimationFrame(scan);

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [scannerOpen]);

  const handleConfirm = async () => {
    if (step === "selectRecipient") {
      // Validate recipient before moving to token selection
      setError(null);
      if (!recipient) return;
      if (recipientValid === false) {
        setError("Recipient account does not exist");
        return;
      }
      if (recipientValid === null && !verifyingRecipient) {
        setError("Please wait for recipient verification");
        return;
      }
      setStep("selectToken");
    } else if (step === "selectToken") {
      // Token selected, move to amount entry
      setStep("enterAmount");
    } else if (step === "enterAmount") {
      // Execute transfer from amount step
      setError(null);
      if (!amount || !recipient) return;
      const normalized = amount.trim();
      if (!/^\d*(?:\.\d+)?$/.test(normalized)) {
        setError("Invalid amount");
        return;
      }
      const [w = "0", f = ""] = normalized.split(".");
      const frac24 = (f + "0".repeat(24)).slice(0, 24);
      const yocto = (
        BigInt(w) * BigInt(10) ** BigInt(24) +
        BigInt(frac24)
      ).toString();
      try {
        setSubmitting(true);
        let txResult: any = null;
        if (selectedToken.kind === "native") {
          txResult = await sendNearNative(recipient.trim(), yocto);
        } else {
          const tokenAddr = selectedToken.address || "";
          // Ensure recipient storage registration for the FT
          let shouldSend = true;
          try {
            const isReg = await checkTokenRegistrationFor(
              tokenAddr,
              recipient.trim()
            );
            if (!isReg) shouldSend = false;
          } catch (e) {
            shouldSend = false;
          }
          if (!shouldSend) {
            setError(
              "Recipient not registered for this token. Please ask them to call storage_deposit on the token contract."
            );
            setSubmitting(false);
            return;
          }
          txResult = await sendFungibleToken(
            tokenAddr,
            recipient.trim(),
            normalized,
            selectedToken.decimals
          );
        }
        try {
          // Notify listeners for post-send UI refresh
          window.dispatchEvent(
            new CustomEvent("wallet:sent", {
              detail: {
                to: recipient.trim(),
                token: selectedToken,
                amount: normalized,
                tx: txResult,
              },
            })
          );
        } catch {}
        // Show confirmed modal
        setStep("confirmed");
      } catch (e: any) {
        setError(e?.message || "Failed to send");
      } finally {
        setSubmitting(false);
      }
    }
  };

  // Screen 1: Select Recipient (First Screen)
  if (step === "selectRecipient") {
    return (
      <div className="fixed inset-0 bg-[#0a0b2e] z-50 flex flex-col">
        {scannerOpen && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="relative w-full max-w-md bg-[#0f1535] rounded-2xl p-4">
              <div className="text-white mb-2 font-medium">Scan QR Code</div>
              <div className="relative rounded-lg overflow-hidden bg-black">
                <video
                  ref={videoRef}
                  className="w-full h-72 object-cover"
                  playsInline
                  muted
                />
                <div className="absolute inset-0 border-2 border-cyan-400/60 m-8 rounded-xl pointer-events-none" />
              </div>
              {scannerError && (
                <div className="text-red-400 text-sm mt-2">{scannerError}</div>
              )}
              <div className="flex justify-end mt-3">
                <Button
                  onClick={stopScanner}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
        {/* Fixed Header */}
        <div className="px-4 py-4 border-b border-white/5 flex items-center gap-3">
          <button onClick={onClose} className="text-white flex items-center gap-1">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">Back</span>
          </button>
          <h1
            className="text-xl font-bold text-white tracking-[0.2em] flex-1 text-center"
            style={{
              fontFamily: "'Press Start 2P', monospace",
              textShadow: "0 0 15px rgba(99, 102, 241, 0.5)",
            }}
          >
            SEND
          </h1>
          <div className="w-16"></div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 pt-4 pb-24">

            <div className="space-y-6">
              <div>
                <div className="text-[#0075EA] text-sm mb-3">Send To</div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Enter recipient address"
                    value={recipient}
                    onChange={(e) => handleRecipientChange(e.target.value)}
                    className={`w-full bg-[#1a1f3a] text-white/50 rounded-xl px-4 py-3 pr-12 outline-none focus:ring-2 ${
                      recipientValid === true
                        ? "focus:ring-green-500 border-green-500"
                        : recipientValid === false
                        ? "focus:ring-red-500 border-red-500"
                        : "focus:ring-cyan-500"
                    }`}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {verifyingRecipient && (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-cyan-500 border-t-transparent" />
                    )}
                    {recipientValid === true && !verifyingRecipient && (
                      <div className="text-green-500">
                        <CheckCircle className="w-5 h-5" />
                      </div>
                    )}
                    {recipientValid === false && !verifyingRecipient && (
                      <div className="text-red-500">
                        <XCircle className="w-5 h-5" />
                      </div>
                    )}
                    <button
                      className="text-[#0075EA]"
                      onClick={startScanner}
                      title="Scan QR"
                    >
                      <QrCode className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                {recipientValid === false && recipient.trim() && (
                  <div className="text-red-500 text-sm mt-2">
                    Account does not exist
                  </div>
                )}
                {recipientValid === true && recipient.trim() && (
                  <div className="text-green-500 text-sm mt-2">
                    Account verified
                  </div>
                )}
                <button
                  className="text-[#0075EA] text-sm mt-2 flex items-center gap-1 disabled:opacity-40"
                  onClick={handleSaveContact}
                  disabled={!recipient.trim() || verifyingRecipient}
                >
                  <span className="text-lg">+</span> Save to address book
                </button>
              </div>

              <div>
                <div className="text-white text-sm mb-3">Address Book</div>
                <div className="relative mb-4">
                  <input
                    type="text"
                    placeholder="Search recipient"
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    className="w-full bg-[#1a1f3a] text-white/50 rounded-xl px-4 py-3 pr-12 outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 w-5 h-5" />
                </div>

                <div className="space-y-3">
                  {contacts.length > 0 ? (
                    contacts
                      .filter((c) => {
                        const q = contactSearch.trim().toLowerCase();
                        if (!q) return true;
                        return (
                          c.name.toLowerCase().includes(q) ||
                          c.address.toLowerCase().includes(q)
                        );
                      })
                      .map((contact, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleRecipientChange(contact.address)}
                          className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-colors"
                        >
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-orange-400 flex-shrink-0" />
                          <div className="text-left">
                            <div className="text-white font-medium">
                              {contact.name}
                            </div>
                            <div className="text-white/50 text-sm">
                              {contact.address}
                            </div>
                          </div>
                        </button>
                      ))
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-white/50 text-sm mb-2">
                        No saved contacts
                      </div>
                      <div className="text-white/30 text-xs">
                        Enter a wallet address manually or save contacts for
                        quick access
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="text-red-400 text-sm mt-2">{error}</div>
              )}
              <button
                onClick={handleConfirm}
                disabled={!recipient || submitting || recipientValid === false}
                className="w-full py-4 bg-[#0075EA] text-white rounded-full text-lg font-medium hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-8"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render token selection modal
  if (step === "selectToken") {
    const showTokenModal = true;
    
    return (
      <>
        {/* Recipient Screen (always rendered) */}
        <div 
          className={`fixed inset-0 bg-[#0a0b2e] z-50 flex flex-col ${showTokenModal ? 'cursor-pointer' : ''}`}
          onClick={() => {
            if (showTokenModal) {
              setStep("selectRecipient");
            }
          }}
        >
          {scannerOpen && !showTokenModal && (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 pointer-events-auto">
              <div className="relative w-full max-w-md bg-[#0f1535] rounded-2xl p-4">
                <div className="text-white mb-2 font-medium">Scan QR Code</div>
                <div className="relative rounded-lg overflow-hidden bg-black">
                  <video
                    ref={videoRef}
                    className="w-full h-72 object-cover"
                    playsInline
                    muted
                  />
                  <div className="absolute inset-0 border-2 border-cyan-400/60 m-8 rounded-xl pointer-events-none" />
                </div>
                {scannerError && (
                  <div className="text-red-400 text-sm mt-2">{scannerError}</div>
                )}
                <div className="flex justify-end mt-3">
                  <Button
                    onClick={stopScanner}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          {/* Fixed Header */}
          <div className="px-4 py-4 border-b border-white/5 flex items-center gap-3">
            <button onClick={onClose} className="text-white flex items-center gap-1 pointer-events-auto">
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm">Back</span>
            </button>
            <h1
              className="text-xl font-bold text-white tracking-[0.2em] flex-1 text-center"
              style={{
                fontFamily: "'Press Start 2P', monospace",
                textShadow: "0 0 15px rgba(99, 102, 241, 0.5)",
              }}
            >
              SEND
            </h1>
            <div className="w-16"></div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 pt-4 pb-24">
              <div className="space-y-6">
                <div>
                  <div className="text-[#0075EA] text-sm mb-3">Send To</div>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Enter recipient address"
                      value={recipient}
                      onChange={(e) => handleRecipientChange(e.target.value)}
                      className={`w-full bg-[#1a1d3f] text-white/50 rounded-xl px-4 py-3 pr-12 outline-none focus:ring-2 pointer-events-auto ${
                        recipientValid === true
                          ? "focus:ring-green-500 border-green-500"
                          : recipientValid === false
                          ? "focus:ring-red-500 border-red-500"
                          : "focus:ring-cyan-500"
                      }`}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-auto">
                      {verifyingRecipient && (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-cyan-500 border-t-transparent" />
                      )}
                      {recipientValid === true && !verifyingRecipient && (
                        <div className="text-green-500">
                          <CheckCircle className="w-5 h-5" />
                        </div>
                      )}
                      {recipientValid === false && !verifyingRecipient && (
                        <div className="text-red-500">
                          <XCircle className="w-5 h-5" />
                        </div>
                      )}
                      <button
                        className="text-[#0075EA]"
                        onClick={startScanner}
                        title="Scan QR"
                      >
                        <QrCode className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  {recipientValid === false && recipient.trim() && (
                    <div className="text-red-500 text-sm mt-2">
                      Account does not exist
                    </div>
                  )}
                  {recipientValid === true && recipient.trim() && (
                    <div className="text-green-500 text-sm mt-2">
                      Account verified
                    </div>
                  )}
                  <button
                    className="text-[#0075EA] text-sm mt-2 flex items-center gap-1 disabled:opacity-40 pointer-events-auto"
                    onClick={handleSaveContact}
                    disabled={!recipient.trim() || verifyingRecipient}
                  >
                    <span className="text-lg">+</span> Add this to your address book
                  </button>
                </div>

                <div>
                  <div className="text-white text-sm mb-3">Address Book</div>
                  <div className="relative mb-4">
                    <input
                      type="text"
                      placeholder="Search recipient"
                      value={contactSearch}
                      onChange={(e) => setContactSearch(e.target.value)}
                      className="w-full bg-[#1a1d3f] text-white/50 rounded-xl px-4 py-3 pr-12 outline-none focus:ring-2 focus:ring-cyan-500 pointer-events-auto"
                    />
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 w-5 h-5" />
                  </div>

                  <div className="space-y-3">
                    {contacts.length > 0 ? (
                      contacts
                        .filter((c) => {
                          const q = contactSearch.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            c.name.toLowerCase().includes(q) ||
                            c.address.toLowerCase().includes(q)
                          );
                        })
                        .map((contact, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleRecipientChange(contact.address)}
                            className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-colors pointer-events-auto"
                          >
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-orange-400 flex-shrink-0" />
                            <div className="text-left">
                              <div className="text-white font-medium">
                                {contact.name}
                              </div>
                              <div className="text-white/50 text-sm">
                                {contact.address}
                              </div>
                            </div>
                          </button>
                        ))
                    ) : (
                      <div className="text-center py-8">
                        <div className="text-white/50 text-sm mb-2">
                          No saved contacts
                        </div>
                        <div className="text-white/30 text-xs">
                          Enter a wallet address manually or save contacts for
                          quick access
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="text-red-400 text-sm mt-2">{error}</div>
                )}
                <button
                  onClick={handleConfirm}
                  disabled={!recipient || submitting || recipientValid === false}
                  className="w-full py-4 bg-[#0075EA] text-white rounded-full text-lg font-medium hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-8 pointer-events-auto"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Token Selection Modal - Compact Bottom Sheet */}
        {showTokenModal && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 pb-20">
            <div 
              className="bg-[#0a0b2e] w-[95%] max-w-md mx-auto rounded-t-2xl flex flex-col max-h-[60vh] mb-2"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Progress Bar */}
              <div className="w-full h-1 bg-white/10 rounded-t-2xl overflow-hidden">
                <div className="h-full w-1/3 bg-white"></div>
              </div>

              {/* Modal Header */}
              <div className="px-3 py-2.5 border-b border-white/5 flex items-center justify-between">
                <h2 className="text-white text-sm font-medium">Select Token</h2>
                <button
                  onClick={() => setStep("selectRecipient")}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto">
                <div className="px-3 pt-2.5 pb-3 space-y-2.5">
                  {/* Search Section */}
                  <div>
                    <div className="text-white text-[10px] mb-1.5">Search</div>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search token"
                        className="w-full bg-[#1a1d3f] text-white/60 rounded-lg px-3 py-1.5 pr-9 outline-none text-xs border border-white/10"
                      />
                      <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/50 w-3.5 h-3.5" />
                    </div>
                  </div>

                  {/* Token List */}
                  <div className="space-y-1">
                    {availableTokens.map((t) => {
                      const numericBal =
                        typeof t.balance === "string"
                          ? parseFloat(t.balance)
                          : (t.balance as number | undefined) ?? 0;
                      const usdValue = numericBal > 0 ? (numericBal * 29.56).toFixed(2) : "0.00";
                      
                      return (
                        <button
                          key={`${t.address || t.symbol}`}
                          onClick={() => {
                            setSelectedToken(t);
                            setStep("enterAmount");
                          }}
                          className="w-full flex items-center justify-between p-2 hover:bg-white/5 rounded-lg transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center">
                              <span className="text-white font-bold text-[10px]">
                                {t.symbol.slice(0, 2)}
                              </span>
                            </div>
                            <div className="text-left">
                              <div className="text-white font-semibold text-xs">
                                {t.symbol}
                              </div>
                              <div className="text-white/50 text-[9px]">
                                {t.name}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-white font-bold text-[10px]">
                              {numericBal.toFixed(7)}
                            </div>
                            <div className="text-white/50 text-[9px]">
                              (${usdValue})
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Screen 3: Enter Amount
  if (step === "enterAmount") {
    const numericBal =
      typeof selectedToken.balance === "string"
        ? parseFloat(selectedToken.balance)
        : (selectedToken.balance as number | undefined) ?? 0;
    const usdValue = numericBal > 0 ? (numericBal * 3000).toFixed(0) : "0";
    
    return (
      <div className="fixed inset-0 bg-[#0a0b2e] z-50 flex flex-col">
        {/* Progress Bar */}
        <div className="w-full h-1 bg-white/10">
          <div className="h-full w-full bg-white"></div>
        </div>

        {/* Fixed Header */}
        <div className="px-3 py-3 border-b border-white/5 flex items-center gap-2">
          <button onClick={() => setStep("selectToken")} className="text-white flex items-center gap-0.5">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-xs">Back</span>
          </button>
          <h1
            className="text-base font-bold text-white tracking-[0.2em] flex-1 text-center"
            style={{
              fontFamily: "'Press Start 2P', monospace",
              textShadow: "0 0 15px rgba(99, 102, 241, 0.5)",
            }}
          >
            SEND
          </h1>
          <div className="w-12"></div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-3 sm:px-4 md:px-6 pt-3 pb-24 space-y-3 max-w-md mx-auto">
            {/* Amount Input */}
            <div className="text-center space-y-2">
              <div className="text-white/60 text-xs sm:text-sm">Enter Amount</div>
              <div className="flex items-center justify-center">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="|"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className="text-white text-3xl sm:text-4xl md:text-5xl font-light w-full text-center bg-transparent outline-none"
                />
              </div>
              <button
                onClick={handleMaxClick}
                className="px-5 py-1.5 sm:px-6 sm:py-2 bg-blue-600 text-white rounded-full text-xs sm:text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Max
              </button>
            </div>

            {/* Available Balance */}
            <div>
              <div className="text-white/60 text-xs sm:text-sm mb-2">Available Balance</div>
              <div className="bg-[#1a1d3f] rounded-2xl p-3 sm:p-4 flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-xs sm:text-sm">
                      {selectedToken.symbol.slice(0, 2)}
                    </span>
                  </div>
                  <div>
                    <div className="text-white font-semibold text-xs sm:text-sm">
                      {selectedToken.symbol}
                    </div>
                    <div className="text-white/50 text-[10px] sm:text-xs">
                      {selectedToken.name}
                    </div>
                  </div>
                  <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400 ml-1" />
                </div>
                <div className="text-right">
                  <div className="text-white font-bold text-xs sm:text-sm">
                    {numericBal.toFixed(6)}
                  </div>
                  <div className="text-white/50 text-[10px] sm:text-xs">
                    (${usdValue})
                  </div>
                </div>
              </div>
            </div>

            {/* Number Pad */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-3 md:gap-4 mt-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  onClick={() => handleNumberClick(num.toString())}
                  className="h-14 sm:h-16 md:h-18 text-white text-xl sm:text-2xl md:text-3xl font-light hover:bg-white/10 rounded-lg transition-colors"
                >
                  {num}
                </button>
              ))}
              <button
                onClick={() => handleNumberClick(".")}
                className="h-14 sm:h-16 md:h-18 text-white text-xl sm:text-2xl md:text-3xl font-light hover:bg-white/10 rounded-lg transition-colors"
              >
                .
              </button>
              <button
                onClick={() => handleNumberClick("0")}
                className="h-14 sm:h-16 md:h-18 text-white text-xl sm:text-2xl md:text-3xl font-light hover:bg-white/10 rounded-lg transition-colors"
              >
                0
              </button>
              <button
                onClick={handleBackspace}
                className="h-14 sm:h-16 md:h-18 text-white hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center"
              >
                <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            {/* Confirm Button */}
            <button
              onClick={handleConfirm}
              disabled={!amount || submitting}
              className="w-full py-3 sm:py-4 bg-blue-500 text-white rounded-2xl text-sm sm:text-base font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-3"
            >
              {submitting ? "Sending..." : "Confirm"}
            </button>
          </div>
        </div>

        {/* Error Modal */}
        {error && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
            <div className="bg-[#1a1d3f] rounded-2xl p-6 w-[90%] max-w-sm overflow-hidden">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <XCircle className="w-6 h-6 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold text-base mb-1 break-words">Transaction Error</h3>
                  <p className="text-white/70 text-sm break-words">{error}</p>
                </div>
              </div>
              <button
                onClick={() => setError(null)}
                className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Screen 4: Transaction Confirmed Modal
  if (step === "confirmed") {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
        <div className="bg-[#1a1d3f] rounded-2xl p-6 w-[90%] max-w-sm relative">
          <button
            onClick={onSuccess}
            className="absolute top-4 right-4 text-white/60 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="text-center space-y-6">
            <h2 className="text-white text-xl font-semibold">
              Transaction Confirmed
            </h2>
            
            <div className="flex items-center justify-center">
              <div className="w-24 h-24 rounded-full border-4 border-blue-500 flex items-center justify-center">
                <Check className="w-12 h-12 text-blue-500" />
              </div>
            </div>
            
            <button
              onClick={onSuccess}
              className="w-full py-3 bg-blue-500 text-white rounded-xl text-sm font-semibold hover:bg-blue-600 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default SendFlow;
