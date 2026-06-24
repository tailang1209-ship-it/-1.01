import { Router, type IRouter } from "express";
import { db, walletsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

router.post("/wallets", async (req, res) => {
  try {
    const { address, networkId = "mainnet", label } = req.body as {
      address?: string;
      networkId?: string;
      label?: string;
    };

    if (!address || typeof address !== "string") {
      res.status(400).json({ error: "address is required" });
      return;
    }

    const existing = await db
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.address, address.toLowerCase()))
      .limit(1);

    if (existing.length > 0) {
      res.json({ wallet: existing[0], created: false });
      return;
    }

    const [wallet] = await db
      .insert(walletsTable)
      .values({ address: address.toLowerCase(), networkId, label: label ?? null })
      .returning();

    res.status(201).json({ wallet, created: true });
  } catch (err) {
    req.log.error({ err }, "Failed to register wallet");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/wallets", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query["limit"] ?? 50), 200);
    const offset = Number(req.query["offset"] ?? 0);

    const wallets = await db
      .select()
      .from(walletsTable)
      .orderBy(desc(walletsTable.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({ wallets, count: wallets.length });
  } catch (err) {
    req.log.error({ err }, "Failed to list wallets");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/wallets/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const wallets = await db
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.address, address.toLowerCase()))
      .limit(1);

    if (wallets.length === 0) {
      res.status(404).json({ error: "Wallet not found" });
      return;
    }

    res.json({ wallet: wallets[0] });
  } catch (err) {
    req.log.error({ err }, "Failed to get wallet");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/wallets/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const { label } = req.body as { label?: string | null };

    const [updated] = await db
      .update(walletsTable)
      .set({ label: label?.trim() || null })
      .where(eq(walletsTable.address, address.toLowerCase()))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Wallet not found" });
      return;
    }

    res.json({ wallet: updated });
  } catch (err) {
    req.log.error({ err }, "Failed to update wallet label");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
