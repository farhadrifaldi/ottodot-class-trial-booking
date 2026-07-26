import path from "path";

export const TEST_DB_PATH = path.resolve(process.cwd(), "prisma/test.db");
export const TEST_PORT = 3111;
export const BASE_URL = `http://localhost:${TEST_PORT}`;
