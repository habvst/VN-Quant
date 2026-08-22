/**
 * End-to-End Encryption (E2EE) Engine for VN-Quant Terminal
 * Uses Web Crypto API (SubtleCrypto) with PBKDF2 (SHA-256) key derivation and AES-GCM 256-bit encryption.
 * Guarantees Zero-Knowledge privacy: Only the user holding the PIN can decrypt the financial data.
 */

export interface EncryptedPayloadBundle {
  encryptedPayload: string; // Base64
  iv: string; // Base64
  salt: string; // Base64
  version: number;
}

// Convert ArrayBuffer to Base64
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert Base64 to Uint8Array
function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derive an AES-GCM 256-bit CryptoKey from User PIN and Salt using PBKDF2
 */
async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const pinBuffer = enc.encode(pin);

  const baseKey = await crypto.subtle.importKey(
    'raw',
    pinBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt any JavaScript object/data using AES-GCM 256-bit
 */
export async function encryptData<T>(data: T, pin: string): Promise<EncryptedPayloadBundle> {
  const enc = new TextEncoder();
  const plaintext = enc.encode(JSON.stringify(data));

  // Generate cryptographic random salt (16 bytes) and IV (12 bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const key = await deriveKey(pin, salt);

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    plaintext
  );

  return {
    encryptedPayload: bufferToBase64(ciphertext),
    iv: bufferToBase64(iv.buffer),
    salt: bufferToBase64(salt.buffer),
    version: 1,
  };
}

/**
 * Decrypt AES-GCM 256-bit payload with PIN
 */
export async function decryptData<T>(bundle: EncryptedPayloadBundle, pin: string): Promise<T> {
  try {
    const salt = base64ToBuffer(bundle.salt);
    const iv = base64ToBuffer(bundle.iv);
    const ciphertext = base64ToBuffer(bundle.encryptedPayload);

    const key = await deriveKey(pin, salt);

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      ciphertext
    );

    const dec = new TextDecoder();
    const jsonStr = dec.decode(decryptedBuffer);
    return JSON.parse(jsonStr) as T;
  } catch (err) {
    throw new Error('Mã PIN không đúng hoặc dữ liệu mã hóa bị hỏng.');
  }
}
