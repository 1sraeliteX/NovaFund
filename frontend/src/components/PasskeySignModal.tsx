"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Fingerprint, Check, Loader2 } from "lucide-react";
import { signWithPasskey, type PasskeySignError, type TransactionSummary } from "@/lib/passkey";

type ModalState = "idle" | "pending" | "success" | "biometric_error" | "transaction_error";

interface PasskeySignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (signedTxXDR: string) => void;
  onError?: (error: PasskeySignError) => void;
  transactionSummary: TransactionSummary;
  rawTransactionXDR: string;
}

/**
 * Inline SVG icons matching the existing app design
 */
const FingerprintIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
    <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
    <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
    <path d="M2 12a10 10 0 0 1 18-6" />
    <path d="M2 16h.01" />
    <path d="M21.8 16c.2-2 .131-5.354 0-6" />
    <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
    <path d="M8.65 22c.21-.66.45-1.32.57-2" />
    <path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
  </svg>
);

export const PasskeySignModal: React.FC<PasskeySignModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onError,
  transactionSummary,
  rawTransactionXDR,
}) => {
  const [state, setState] = useState<ModalState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [signedXDR, setSignedXDR] = useState<string>("");
  const modalRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);
  const lastFocusableRef = useRef<HTMLButtonElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setState("idle");
      setErrorMessage("");
      setSignedXDR("");
    }
  }, [isOpen]);

  // Auto-dismiss on success
  useEffect(() => {
    if (state === "success" && signedXDR) {
      const timer = setTimeout(() => {
        onSuccess(signedXDR);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [state, signedXDR, onSuccess]);

  // Focus trap and Escape key handling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Only allow Escape when in idle or error states
      if (event.key === "Escape") {
        if (state === "idle" || state === "biometric_error" || state === "transaction_error") {
          onClose();
        }
        return;
      }

      // Focus trap
      if (event.key === "Tab") {
        const focusableElements = modalRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusableElements || focusableElements.length === 0) return;

        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            event.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            event.preventDefault();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    
    // Focus first element when modal opens
    const timer = setTimeout(() => {
      firstFocusableRef.current?.focus();
    }, 100);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timer);
    };
  }, [isOpen, state, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleSign = useCallback(async () => {
    setState("pending");
    setErrorMessage("");

    try {
      const signed = await signWithPasskey(rawTransactionXDR);
      setSignedXDR(signed);
      setState("success");
    } catch (error) {
      const passkeyError = error as PasskeySignError;
      
      if (passkeyError.code === "BIOMETRIC_CANCELLED" || passkeyError.code === "BIOMETRIC_FAILED") {
        setState("biometric_error");
        setErrorMessage(passkeyError.message);
      } else {
        setState("transaction_error");
        setErrorMessage(passkeyError.message);
      }
      
      onError?.(passkeyError);
    }
  }, [rawTransactionXDR, onError]);

  const handleRetry = useCallback(() => {
    handleSign();
  }, [handleSign]);

  const handleBackdropClick = useCallback(() => {
    // Only close when in idle or error states
    if (state === "idle" || state === "biometric_error" || state === "transaction_error") {
      onClose();
    }
  }, [state, onClose]);

  // Don't render if not open
  if (!isOpen) return null;

  const canClose = state === "idle" || state === "biometric_error" || state === "transaction_error";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="presentation"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={handleBackdropClick}
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative w-full max-w-md mx-4 rounded-3xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="passkey-modal-title"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2
                id="passkey-modal-title"
                className="text-xl font-semibold text-white"
              >
                Confirm Transaction
              </h2>
              {canClose && (
                <button
                  ref={firstFocusableRef}
                  type="button"
                  onClick={onClose}
                  className="rounded-full p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Transaction Summary Card */}
            <div className="mb-6 rounded-2xl border border-white/5 bg-white/5 p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-[0.4em] text-white/50">Action</span>
                  <span className="text-sm font-medium text-white">{transactionSummary.action}</span>
                </div>
                
                {transactionSummary.amount && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-[0.4em] text-white/50">Amount</span>
                    <span className="text-sm font-medium text-purple-300">{transactionSummary.amount}</span>
                  </div>
                )}
                
                {transactionSummary.recipient && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-[0.4em] text-white/50">Recipient</span>
                    <span className="text-sm font-medium text-white">{transactionSummary.recipient}</span>
                  </div>
                )}
                
                {transactionSummary.fee && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-[0.4em] text-white/50">Fee</span>
                    <span className="text-sm font-medium text-white/70">{transactionSummary.fee}</span>
                  </div>
                )}
              </div>
            </div>

            {/* STATE 1: IDLE */}
            {state === "idle" && (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={handleSign}
                  className="w-full rounded-2xl border border-white/10 bg-gradient-to-r from-purple-500 to-purple-400 px-6 py-4 text-base font-semibold text-slate-950 shadow-lg shadow-purple-500/40 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900 inline-flex items-center justify-center gap-3"
                >
                  <FingerprintIcon />
                  Sign with Biometrics
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full text-center text-sm text-white/50 transition hover:text-white/80 focus:outline-none focus:underline"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* STATE 2: PENDING */}
            {state === "pending" && (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <Loader2
                  className="h-10 w-10 animate-spin text-purple-400"
                  aria-label="Signing in progress"
                />
                <p className="text-sm text-white/70">
                  Waiting for biometric confirmation…
                </p>
              </div>
            )}

            {/* STATE 3: SUCCESS */}
            {state === "success" && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center justify-center py-8 space-y-4"
              >
                <div className="rounded-full bg-green-500/20 p-3">
                  <Check className="h-10 w-10 text-green-400" aria-label="Signing successful" />
                </div>
                <p className="text-base font-medium text-white">Signed successfully</p>
              </motion.div>
            )}

            {/* STATE 4: BIOMETRIC ERROR */}
            {state === "biometric_error" && (
              <div className="space-y-4">
                <div
                  role="alert"
                  className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"
                >
                  <p className="text-sm text-amber-200">
                    Biometric sign-in was cancelled or failed. Please try again.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSign}
                  className="w-full rounded-2xl border border-white/10 bg-gradient-to-r from-purple-500 to-purple-400 px-6 py-4 text-base font-semibold text-slate-950 shadow-lg shadow-purple-500/40 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900 inline-flex items-center justify-center gap-3"
                >
                  <FingerprintIcon />
                  Sign with Biometrics
                </button>

                <button
                  ref={lastFocusableRef}
                  type="button"
                  onClick={onClose}
                  className="w-full text-center text-sm text-white/50 transition hover:text-white/80 focus:outline-none focus:underline"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* STATE 5: TRANSACTION ERROR */}
            {state === "transaction_error" && (
              <div className="space-y-4">
                <div
                  role="alert"
                  className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4"
                >
                  <p className="text-sm text-rose-200">
                    {errorMessage.length > 120 ? `${errorMessage.slice(0, 120)}…` : errorMessage}
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="flex-1 rounded-2xl border border-white/10 bg-gradient-to-r from-purple-500 to-purple-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                  >
                    Retry
                  </button>
                  <button
                    ref={lastFocusableRef}
                    type="button"
                    onClick={onClose}
                    className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-slate-900"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PasskeySignModal;
