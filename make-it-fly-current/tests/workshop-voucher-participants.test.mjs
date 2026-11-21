import assert from "node:assert/strict";
import { test } from "node:test";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const { parseVoucherParticipants, voucherEmail } = opportunityLoader()("lib/workshop-voucher/input.ts");

test("reads the curated Nome/E-mail table, preserving order and normalizing e-mails", () => {
  const csv = '﻿Nome,E-mail,Telefone\r\n"Silva, Ana",ANA@Example.test ,\r\nBruno,bruno@example.test,+55\r\n';
  assert.deepEqual(parseVoucherParticipants(csv), [
    { name: "Silva, Ana", email: "ana@example.test" },
    { name: "Bruno", email: "bruno@example.test" },
  ]);
});

test("reads the Luma guest export and keeps one row per person", () => {
  const csv = [
    "api_id,name,first_name,last_name,email,checked_in_at",
    "gst_1,Carla Dias,Carla,Dias,carla@example.test,2026-11-21T18:00:00Z",
    "gst_2,Carla Dias,Carla,Dias,CARLA@example.test,2026-11-21T18:00:05Z",
    "gst_3,,,,davi@example.test,",
  ].join("\n");
  assert.deepEqual(parseVoucherParticipants(csv), [
    { name: "Carla Dias", email: "carla@example.test" },
    { name: "", email: "davi@example.test" },
  ]);
});

test("accepts semicolon tables and strips control characters from names", () => {
  assert.deepEqual(parseVoucherParticipants("Nome;Email\nEva\u0007 Lima;eva@example.test"), [
    { name: "Eva Lima", email: "eva@example.test" },
  ]);
});

test("rejects tables without an e-mail column, with invalid e-mails or too many rows", () => {
  assert.throws(() => parseVoucherParticipants("Nome,Telefone\nAna,123"), /coluna E-mail/);
  assert.throws(() => parseVoucherParticipants("Nome,E-mail\nAna,ana-at-example"), /linha 2/);
  assert.throws(() => parseVoucherParticipants(""), /nenhum participante/i);
  assert.throws(() => parseVoucherParticipants("Nome,E-mail\n"), /nenhum participante/i);
  const many = ["Email", ...Array.from({ length: 2001 }, (_, i) => `p${i}@example.test`)].join("\n");
  assert.throws(() => parseVoucherParticipants(many), /2000/);
});

test("normalizes a single e-mail for release and rejects invalid input", () => {
  assert.equal(voucherEmail("  Pessoa@Example.TEST "), "pessoa@example.test");
  assert.throws(() => voucherEmail("sem-arroba"), /e-mail válido/);
  assert.throws(() => voucherEmail(42), /e-mail válido/);
});
