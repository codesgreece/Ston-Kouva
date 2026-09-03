import assert from "node:assert/strict";
import { test } from "node:test";
import { usernameSchema, registerSchema } from "../src/lib/validation/auth";
import { hashToken } from "../src/lib/auth/crypto";

test("username schema accepts valid names", () => {
  assert.equal(usernameSchema.parse("demo_user"), "demo_user");
  assert.equal(usernameSchema.parse("abc"), "abc");
});

test("username schema rejects invalid names", () => {
  assert.throws(() => usernameSchema.parse("ab"));
  assert.throws(() => usernameSchema.parse("bad-name"));
  assert.throws(() => usernameSchema.parse("space name"));
});

test("register schema requires email and password", () => {
  const parsed = registerSchema.parse({
    username: "fan_1",
    email: "fan@example.com",
    password: "password123",
  });
  assert.equal(parsed.username, "fan_1");
});

test("hashToken is deterministic sha256 hex", () => {
  const a = hashToken("hello");
  const b = hashToken("hello");
  assert.equal(a, b);
  assert.equal(a.length, 64);
});
