import { afterAll } from "vitest";
import { testDb } from "./db";

afterAll(async () => {
  await testDb.$disconnect();
});
