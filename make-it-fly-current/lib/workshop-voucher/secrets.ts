import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

export function voucherConfigured(): boolean {
  return /^[a-f0-9]{64}$/i.test(process.env.WORKSHOP_VOUCHER_KEY ?? "");
}

function key(): Buffer {
  if (!voucherConfigured()) throw new Error("Chave do voucher indisponível.");
  return Buffer.from(process.env.WORKSHOP_VOUCHER_KEY!, "hex");
}

export function sealVoucher(url: string, slot: number): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(`openai-workshop:activation:${slot}`));
  const encrypted = Buffer.concat([cipher.update(url, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString("base64url")).join(".");
}

export function unsealVoucher(value: string, slot: number): string {
  const parts = value.split(".");
  if (parts.length !== 3) throw new Error("Credencial inválida.");
  const [iv, tag, encrypted] = parts.map(part => Buffer.from(part, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv, { authTagLength: 16 });
  decipher.setAAD(Buffer.from(`openai-workshop:activation:${slot}`));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function voucherCode(nonce: string): string {
  return createHmac("sha256", key()).update(`openai-workshop:email-proof:${nonce}`).digest("hex").slice(0, 24);
}

export function voucherCodeHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
