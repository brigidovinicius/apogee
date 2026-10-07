import crypto from "node:crypto";
const password = process.argv[2];
if (!password) throw new Error("Uso: node scripts/hash-password.mjs 'senha forte'");
const salt = crypto.randomBytes(16).toString("hex");
const hash = crypto.scryptSync(password, salt, 64).toString("hex");
console.log(`scrypt$${salt}$${hash}`);