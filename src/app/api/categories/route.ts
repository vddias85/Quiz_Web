import { handle, json } from "@/server/http";
import { listPlayableCategories } from "@/server/quiz";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => json({ categories: await listPlayableCategories() }));
}
