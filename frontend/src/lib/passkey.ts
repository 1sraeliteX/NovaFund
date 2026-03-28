/**
 * Passkey/WebAuthn signing utilities for Soroban transactions
 * 
 * This module provides a mock implementation of WebAuthn-based transaction
 * signing. In production, this would interface with the actual WebAuthn API
 * and Soroban SDK.
 */

export type PasskeyErrorCode =
  | 'BIOMETRIC_CANCELLED'
  | 'BIOMETRIC_FAILED'
  | 'TRANSACTION_REJECTED'
  | 'UNKNOWN';

export interface PasskeySignError {
  code: PasskeyErrorCode;
  message: string;
}

export interface TransactionSummary {
  action: string;
  amount?: string;
  recipient?: string;
  fee?: string;
}

/**
 * Maps WebAuthn errors to our PasskeySignError format
 */
function mapWebAuthnError(error: unknown): PasskeySignError {
  if (error instanceof Error) {
    // Common WebAuthn error names
    if (
      error.name === 'NotAllowedError' ||
      error.name === 'AbortError' ||
      error.message?.includes('cancelled') ||
      error.message?.includes('denied')
    ) {
      return {
        code: 'BIOMETRIC_CANCELLED',
        message: 'Biometric sign-in was cancelled. Please try again.',
      };
    }

    if (
      error.name === 'InvalidStateError' ||
      error.name === 'SecurityError' ||
      error.message?.includes('failed') ||
      error.message?.includes('unavailable')
    ) {
      return {
        code: 'BIOMETRIC_FAILED',
        message: 'Biometric verification failed. Please try again.',
      };
    }
  }

  return {
    code: 'UNKNOWN',
    message: error instanceof Error ? error.message : 'An unexpected error occurred',
  };
}

/**
 * Mock implementation of passkey-based transaction signing.
 * 
 * In production, this would:
 * 1. Call navigator.credentials.get() with the challenge
 * 2. Use the assertion to sign the Soroban transaction
 * 3. Return the signed transaction XDR
 * 
 * @param transactionXDR - The raw Soroban transaction XDR to sign
 * @returns Promise resolving to the signed transaction XDR
 * @throws PasskeySignError on signing failure
 */
export async function signWithPasskey(transactionXDR: string): Promise<string> {
  // Check if WebAuthn is supported
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    throw {
      code: 'BIOMETRIC_FAILED',
      message: 'Biometric authentication is not supported on this device.',
    } as PasskeySignError;
  }

  try {
    // In production, this would be an actual WebAuthn call:
    // const assertion = await navigator.credentials.get({
    //   publicKey: {
    //     challenge: Uint8Array.from(atob(challenge), c => c.charCodeAt(0)),
    //     allowCredentials: [...],
    //     userVerification: 'required',
    //   }
    // });
    
    // For now, simulate the async nature of biometric prompt
    await new Promise((resolve, reject) => {
      // Simulate user interaction delay (1-2 seconds)
      const delay = 1200;
      
      setTimeout(() => {
        // 10% chance of biometric failure for testing
        const shouldFail = Math.random() < 0.1;
        
        if (shouldFail) {
          reject(new Error('NotAllowedError'));
        } else {
          resolve(undefined);
        }
      }, delay);
    });

    // Return a mock signed transaction XDR
    // In production, this would be the actual signed XDR
    const mockSignedXDR = `SIGNED_${transactionXDR}_${Date.now()}`;
    return mockSignedXDR;
    
  } catch (error) {
    throw mapWebAuthnError(error);
  }
}

/**
 * Check if the device supports biometric authentication
 */
export async function isPasskeySupported(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  
  if (!window.PublicKeyCredential) return false;
  
  try {
    // Check if user verifying platform authenticator is available
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch {
    return false;
  }
}
