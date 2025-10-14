"use client";

import { useEffect, useRef, useState } from "react";
import { usePrivateKeyWallet } from "@/contexts/PrivateKeyWalletContext";
import { ArrowLeft, QrCode, Search, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAccountInventory } from "@/lib/nearblocks";
import { DEFAULT_TOKENS } from "@/lib/tokens";

interface SendFlowProps {
  onClose: () => void;
  onSuccess: () => void;
}

type SendStep = "amount" | "recipient" | "confirm";

const SendFlow = ({ onClose, onSuccess }: SendFlowProps) => {
  const [step, setStep] = useState<SendStep>("amount");
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
          { symbol: "NEAR", name: "NEAR", kind: "native" },
          ...known,
          ...uniqMap.values(),
        ];
        setAvailableTokens(tokens);
      } catch (e) {
        // On failure, keep NEAR only
        setAvailableTokens([{ symbol: "NEAR", name: "NEAR", kind: "native" }]);
      }
    })();
  }, [accountId]);

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
    if (step === "amount") {
      setStep("recipient");
    } else if (step === "recipient") {
      // Move to confirm step and refresh NEAR price just before showing
      setError(null);
      if (!amount || !recipient) return;
      if (recipientValid === false) {
        setError("Recipient account does not exist");
        return;
      }
      if (recipientValid === null && !verifyingRecipient) {
        setError("Please wait for recipient verification");
        return;
      }
      fetchNearPrice();
      setStep("confirm");
    } else if (step === "confirm") {
      // Execute transfer from confirm step
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
        onSuccess();
      } catch (e: any) {
        setError(e?.message || "Failed to send");
      } finally {
        setSubmitting(false);
      }
    }
  };

  if (step === "amount") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27] z-50 overflow-y-auto pb-20">
        <div className="max-w-md mx-auto min-h-screen pb-6">
          <div className="px-4 pt-6">
            <div className="flex items-center justify-between mb-8">
              <Button
                variant="ghost"
                className="text-white hover:bg-white/10 p-2"
                onClick={onClose}
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back
              </Button>
              <h1
                className="text-3xl font-bold text-white tracking-wider"
                style={{
                  fontFamily: "monospace",
                  letterSpacing: "0.2em",
                  textShadow: "0 0 10px rgba(255,255,255,0.5)",
                }}
              >
                SEND
              </h1>
              <div className="w-20" />
            </div>

            <div className="space-y-6">
              <div className="text-center space-y-4">
                <div className="text-white/50 text-sm">Enter Amount</div>
                <div className="flex items-center justify-center gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.0"
                    value={amount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    className="text-white text-4xl font-light min-w-[200px] text-center bg-transparent outline-none focus:border-cyan-500"
                  />
                </div>
                <button className="px-6 py-2 bg-[#0075EA] text-white rounded-full text-sm font-medium hover:bg-cyan-600 transition-colors">
                  Max
                </button>
              </div>

              <div className="mt-8">
                <div className="text-white/70 text-sm mb-3">Asset</div>
                <button
                  type="button"
                  onClick={() => setTokenSelectorOpen(true)}
                  className="w-full bg-[#1a1f3a] rounded-2xl p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm">
                        {selectedToken.symbol.slice(0, 2)}
                      </span>
                    </div>
                    <div className="text-left">
                      <div className="text-white font-medium">
                        {selectedToken.name}
                      </div>
                      <div className="text-white/50 text-xs">
                        {selectedToken.kind === "native"
                          ? "Native"
                          : selectedToken.address}
                      </div>
                    </div>
                  </div>
                  <div className="text-white/60 text-sm">Change</div>
                </button>

                {tokenSelectorOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                    <div className="bg-[#0f1535] w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-4">
                      <div className="text-white font-semibold mb-3">
                        Select asset
                      </div>
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {availableTokens.map((t) => {
                          const numericBal =
                            typeof t.balance === "string"
                              ? parseFloat(t.balance)
                              : (t.balance as number | undefined) ?? 0;
                          const isDisabled =
                            t.kind === "ft" &&
                            (isNaN(numericBal) || numericBal <= 0);
                          return (
                            <button
                              key={`${t.address || t.symbol}`}
                              onClick={() => {
                                if (isDisabled) return;
                                setSelectedToken(t);
                                setTokenSelectorOpen(false);
                              }}
                              disabled={isDisabled}
                              className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${
                                isDisabled
                                  ? "opacity-40 cursor-not-allowed"
                                  : "hover:bg-white/5"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                                  <span className="text-white font-bold text-sm">
                                    {t.symbol.slice(0, 2)}
                                  </span>
                                </div>
                                <div className="text-left">
                                  <div className="text-white font-medium">
                                    {t.name}
                                  </div>
                                  <div className="text-white/50 text-xs">
                                    {t.kind === "native" ? "Native" : t.address}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                {t.balance !== undefined && (
                                  <div className="text-white text-xs">
                                    {String(t.balance)} {t.symbol}
                                  </div>
                                )}
                                {selectedToken.symbol === t.symbol && (
                                  <div className="text-cyan-400 text-xs">
                                    Selected
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex justify-end mt-3">
                        <Button
                          onClick={() => setTokenSelectorOpen(false)}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          Close
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4 mt-12">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleNumberClick(num.toString())}
                    className="h-16 text-white text-2xl font-light hover:bg-white/10 rounded-xl transition-colors"
                  >
                    {num}
                  </button>
                ))}
                <button
                  onClick={() => handleNumberClick(".")}
                  className="h-16 text-white text-2xl font-light hover:bg-white/10 rounded-xl transition-colors"
                >
                  .
                </button>
                <button
                  onClick={() => handleNumberClick("0")}
                  className="h-16 text-white text-2xl font-light hover:bg-white/10 rounded-xl transition-colors"
                >
                  0
                </button>
                <button
                  onClick={handleBackspace}
                  className="h-16 text-white hover:bg-white/10 rounded-xl transition-colors flex items-center justify-center"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                </button>
              </div>

              <button
                onClick={handleConfirm}
                disabled={!amount}
                className="w-full py-4 bg-[#0075EA] text-white rounded-full text-lg font-medium hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-8"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === "recipient") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27] z-50 overflow-y-auto">
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
        <div className="max-w-md mx-auto min-h-screen pb-6">
          <div className="px-4 pt-6">
            <div className="flex items-center justify-between mb-8">
              <Button
                variant="ghost"
                className="text-white hover:bg-white/10 p-2"
                onClick={() => setStep("amount")}
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back
              </Button>
              <h1
                className="text-3xl font-bold text-white tracking-wider"
                style={{
                  fontFamily: "monospace",
                  letterSpacing: "0.2em",
                  textShadow: "0 0 10px rgba(255,255,255,0.5)",
                }}
              >
                SEND
              </h1>
              <div className="w-20" />
            </div>

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

  if (step === "confirm") {
    const normalized = amount.trim();
    const tokenLabel =
      selectedToken.kind === "native"
        ? "NEAR"
        : `${selectedToken.symbol} (${selectedToken.address})`;
    const fiatValue =
      selectedToken.kind === "native" && nearPriceUsd
        ? (Number(normalized || 0) * nearPriceUsd).toFixed(2)
        : null;
    const feeNote =
      selectedToken.kind === "native"
        ? "Network fee (gas)"
        : "Gas + 1 yoctoNEAR";
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27] z-50 overflow-y-auto">
        <div className="max-w-md mx-auto min-h-screen pb-6">
          <div className="px-4 pt-6">
            <div className="flex items-center justify-between mb-8">
              <Button
                variant="ghost"
                className="text-white hover:bg:white/10 p-2"
                onClick={() => setStep("recipient")}
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back
              </Button>
              <h1
                className="text-3xl font-bold text-white tracking-wider"
                style={{
                  fontFamily: "monospace",
                  letterSpacing: "0.2em",
                  textShadow: "0 0 10px rgba(255,255,255,0.5)",
                }}
              >
                CONFIRM
              </h1>
              <div className="w-20" />
            </div>

            <div className="space-y-6">
              <div className="bg-[#0f1535] rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between text-white/80">
                  <span>Recipient</span>
                  <span className="text-white">{recipient.trim()}</span>
                </div>
                <div className="flex items-center justify-between text-white/80">
                  <span>Token</span>
                  <span className="text-white">{tokenLabel}</span>
                </div>
                <div className="flex items-center justify-between text-white/80">
                  <span>Amount</span>
                  <span className="text-white">{normalized}</span>
                </div>
                <div className="flex items-center justify-between text-white/80">
                  <span>Estimated Fee</span>
                  <span className="text-white">{feeNote}</span>
                </div>
                {selectedToken.kind === "native" && (
                  <div className="flex items-center justify-between text-white/80">
                    <span>Fiat (USD)</span>
                    <span className="text-white">
                      {priceLoading ? "..." : fiatValue ? `$${fiatValue}` : "-"}
                    </span>
                  </div>
                )}
              </div>

              {error && (
                <div className="text-red-400 text-sm mt-2">{error}</div>
              )}

              <button
                onClick={handleConfirm}
                disabled={submitting}
                className="w-full py-4 bg-[#0075EA] text-white rounded-full text-lg font-medium hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-4"
              >
                {submitting ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default SendFlow;
