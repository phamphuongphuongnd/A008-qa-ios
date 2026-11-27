import { requireOptionalNativeModule } from 'expo';

export interface EvenleaseCryptoNative {
  /**
   * PBKDF2-HMAC-SHA256 off the JS thread. Bytes travel as lowercase hex (password = the UTF-8 bytes JS already
   * normalised, so both platforms hash exactly the same bytes). Resolves the derived key as hex.
   */
  pbkdf2Sha256(passwordHex: string, saltHex: string, iterations: number, keyLength: number): Promise<string>;
}

/** null in Jest, on web and in a build made before this module existed — the JS PBKDF2 is used then. */
export const EvenleaseCrypto = requireOptionalNativeModule<EvenleaseCryptoNative>('EvenleaseCrypto');
