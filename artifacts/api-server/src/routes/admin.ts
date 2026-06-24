import { Router, type IRouter } from "express";
import { db, walletsTable, transactionsTable } from "@workspace/db";
import { count, sum, sql, desc } from "drizzle-orm";
import { randomBytes } from "crypto";
import type { Request, Response, NextFunction } from "express";

const router: IRouter = Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "cryptovault2024";
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const validTokens = new Map<string, number>();

function pruneTokens() {
  const now = Date.now();
  for (const [t, exp] of validTokens) {
    if (exp < now) validTokens.delete(t);
  }
}

export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  pruneTokens();
  if (!validTokens.has(token)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

router.post("/admin/auth", (req, res) => {
  const { password } = req.body as { password?: string };
  if (!password || password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "密码错误" });
    return;
  }
  const token = randomBytes(32).toString("hex");
  validTokens.set(token, Date.now() + TOKEN_TTL_MS);
  res.json({ token, expiresIn: TOKEN_TTL_MS });
});

router.post("/admin/logout", (req, res) => {
  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  validTokens.delete(token);
  res.json({ ok: true });
});

router.get("/admin/stats", requireAdminAuth, async (req, res) => {
  try {
    const [walletCount] = await db.select({ count: count() }).from(walletsTable);
    const [txCount] = await db.select({ count: count() }).from(transactionsTable);
    const [volumeResult] = await db
      .select({ total: sql<string>`COALESCE(SUM(CAST(${transactionsTable.amount} AS NUMERIC)), 0)` })
      .from(transactionsTable);

    const dailyTxs = await db
      .select({
        date: sql<string>`DATE(${transactionsTable.createdAt})`,
        count: count(),
        volume: sql<string>`COALESCE(SUM(CAST(${transactionsTable.amount} AS NUMERIC)), 0)`,
      })
      .from(transactionsTable)
      .groupBy(sql`DATE(${transactionsTable.createdAt})`)
      .orderBy(sql`DATE(${transactionsTable.createdAt})`)
      .limit(30);

    const recentWallets = await db
      .select()
      .from(walletsTable)
      .orderBy(desc(walletsTable.createdAt))
      .limit(5);

    const recentTxs = await db
      .select()
      .from(transactionsTable)
      .orderBy(desc(transactionsTable.createdAt))
      .limit(5);

    res.json({
      totalWallets: walletCount?.count ?? 0,
      totalTransactions: txCount?.count ?? 0,
      totalVolume: volumeResult?.total ?? "0",
      dailyTransactions: dailyTxs,
      recentWallets,
      recentTxs,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch admin stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/db", requireAdminAuth, async (req, res) => {
  const table = req.query["table"] as string | undefined;
  const limit = Math.min(Number(req.query["limit"] ?? 20), 100);
  const offset = Number(req.query["offset"] ?? 0);

  try {
    if (table === "wallets") {
      const rows = await db
        .select()
        .from(walletsTable)
        .orderBy(desc(walletsTable.createdAt))
        .limit(limit)
        .offset(offset);
      const [total] = await db.select({ count: count() }).from(walletsTable);
      res.json({ table, rows, total: total?.count ?? 0, limit, offset });
    } else if (table === "transactions") {
      const rows = await db
        .select()
        .from(transactionsTable)
        .orderBy(desc(transactionsTable.createdAt))
        .limit(limit)
        .offset(offset);
      const [total] = await db.select({ count: count() }).from(transactionsTable);
      res.json({ table, rows, total: total?.count ?? 0, limit, offset });
    } else {
      const [wCount] = await db.select({ count: count() }).from(walletsTable);
      const [tCount] = await db.select({ count: count() }).from(transactionsTable);
      res.json({
        tables: [
          { name: "wallets", label: "钱包表 (wallets)", count: wCount?.count ?? 0 },
          { name: "transactions", label: "交易表 (transactions)", count: tCount?.count ?? 0 },
        ],
      });
    }
  } catch (err) {
    req.log.error({ err }, "DB viewer error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
