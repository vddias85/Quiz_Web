import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import { SavedGames, type SavedGameView } from "@/components/home/saved-games";
import { StartForm } from "@/components/home/start-form";
import { readOwnedPlayerIds } from "@/server/http";
import { listPlayableCategories, listSavedGames, type CategoryDto } from "@/server/quiz";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ salvo?: string }> }) {
  const { salvo } = await searchParams;
  let categories: CategoryDto[] = [];
  let savedGames: SavedGameView[] = [];
  let unavailable = false;
  try {
    const now = new Date();
    const [cats, saved] = await Promise.all([listPlayableCategories(), listSavedGames(await readOwnedPlayerIds(), now)]);
    categories = cats;
    savedGames = saved.map((g) => ({
      ...g,
      hoursLeft: Math.max(1, Math.ceil((new Date(g.expiresAt).getTime() - now.getTime()) / 3_600_000)),
    }));
  } catch (err) {
    console.error("[home] falha ao carregar categorias:", err);
    unavailable = true;
  }

  return (
    <PageShell
      logoSize="large"
      linkHome={false}
      intro={
        <>
          <h1 className="sr-only">Quiz Web</h1>
          <p className="text-muted-foreground">Teste seus conhecimentos gerais e entre no ranking.</p>
        </>
      }
    >
      {unavailable ? (
        <p className="rounded-lg bg-destructive/10 p-4 text-center text-destructive" role="alert">
          O quiz está indisponível no momento. Tente novamente em alguns minutos.
        </p>
      ) : (
        <>
          <SavedGames games={savedGames} justSaved={salvo === "1"} />
          <StartForm categories={categories} />
          <p className="mt-6 text-center">
            <Link href="/ranking" className="text-sm font-medium text-link underline-offset-4 hover:underline">
              <span aria-hidden>🏆 </span>Ver ranking
            </Link>
          </p>
        </>
      )}
    </PageShell>
  );
}
