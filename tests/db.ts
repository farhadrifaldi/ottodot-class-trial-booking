import { PrismaClient } from "@prisma/client";
import { TEST_DB_PATH } from "./constants";

process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;

export const testDb = new PrismaClient();
