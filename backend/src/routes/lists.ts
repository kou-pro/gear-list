import { Hono } from "hono";
import { prisma } from "../lib/prisma.js";

const app = new Hono();

// GET / — index.ts 側で /api/lists にマウントされるので、実際のURLは GET /api/lists
app.get("/", async (c) => {
  const lists = await prisma.gearList.findMany();
  return c.json(lists);
});

export default app;
