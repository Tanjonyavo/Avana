import { randomBytes } from "node:crypto";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const bytes = randomBytes(20);
let bits = "";
for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");
let secret = "";
for (let index = 0; index < bits.length; index += 5) {
  secret += alphabet[Number.parseInt(bits.slice(index, index + 5).padEnd(5, "0"), 2)];
}

const account = process.argv[2] || "admin";
const label = encodeURIComponent(`AVANA:${account}`);
const issuer = encodeURIComponent("AVANA");
console.log(`ADMIN_TOTP_SECRET=${secret}`);
console.log(`otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`);
