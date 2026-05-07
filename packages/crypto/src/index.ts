import sodium from "libsodium-wrappers";

let _ready = false;

async function ensureReady() {
  if (!_ready) {
    await sodium.ready;
    _ready = true;
  }
}

export interface EncryptedBlob {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  keyHash: `0x${string}`;
}

/// Symmetric encryption using libsodium secretbox (XSalsa20-Poly1305).
export async function encrypt(plaintext: Uint8Array, key: Uint8Array): Promise<EncryptedBlob> {
  await ensureReady();
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const ciphertext = sodium.crypto_secretbox_easy(plaintext, nonce, key);
  const keyHash = `0x${Buffer.from(sodium.crypto_hash(key)).toString("hex").slice(0, 64)}` as `0x${string}`;
  return { ciphertext, nonce, keyHash };
}

export async function decrypt(blob: EncryptedBlob, key: Uint8Array): Promise<Uint8Array> {
  await ensureReady();
  const plaintext = sodium.crypto_secretbox_open_easy(blob.ciphertext, blob.nonce, key);
  if (!plaintext) throw new Error("Decryption failed — invalid key or tampered ciphertext");
  return plaintext;
}

export async function generateKey(): Promise<Uint8Array> {
  await ensureReady();
  return sodium.randombytes_buf(sodium.crypto_secretbox_KEYBYTES);
}

export async function sha256(data: Uint8Array): Promise<`0x${string}`> {
  await ensureReady();
  const hash = await crypto.subtle.digest("SHA-256", data);
  return `0x${Buffer.from(hash).toString("hex")}` as `0x${string}`;
}

export function serializeBlob(blob: EncryptedBlob): Uint8Array {
  const nonceLen = blob.nonce.length;
  const result = new Uint8Array(4 + nonceLen + blob.ciphertext.length);
  result[0] = (nonceLen >> 24) & 0xff;
  result[1] = (nonceLen >> 16) & 0xff;
  result[2] = (nonceLen >> 8) & 0xff;
  result[3] = nonceLen & 0xff;
  result.set(blob.nonce, 4);
  result.set(blob.ciphertext, 4 + nonceLen);
  return result;
}

export function deserializeBlob(data: Uint8Array, keyHash: `0x${string}`): EncryptedBlob {
  const nonceLen =
    (data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3];
  const nonce = data.slice(4, 4 + nonceLen);
  const ciphertext = data.slice(4 + nonceLen);
  return { ciphertext, nonce, keyHash };
}
