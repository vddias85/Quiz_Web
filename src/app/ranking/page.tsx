// Ranking: Geral (Temas Variados) ou por categoria, nos períodos Hoje/Semana/Mês/Sempre (PRD §7).
import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { PageShell } from "@/components/layout/page-shell";
import { RankingTable } from "@/components/ranking/ranking-table";
import {
  levelFromSlug,
  PERIOD_LABELS,
  PERIODS,
  periodFromSlug,
  RANKING_TOP,
  rankingHref,
  type RankingFilter,
} from "@/lib/ranking";
import { LEVEL_LABELS, LEVELS } from "@/lib/scoring";
import { cn } from "@/lib/utils";
import { readOwnedPlayerIds } from "@/server/http";
import { listPlayableCategories, type CategoryDto } from "@/server/quiz";
import { getRanking, type RankingDto } from "@/server/ranking";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Quiz Web — Ranking" };

type SearchParams = { categoria?: string; nivel?: string; periodo?: string };

const focusRing = "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm transition-colors",
        focusRing,
        active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted",
      )}
    >
      {children}
    </Link>
  );
}

export default async function RankingPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const period = periodFromSlug(sp.periodo);

  let categories: CategoryDto[] = [];
  let category: CategoryDto | null = null;
  let ranking: RankingDto | null = null;
  // ?nivel= tem prioridade sobre ?categoria=; sem nenhum dos dois, é o ranking Geral.
  const level = levelFromSlug(sp.nivel);
  try {
    categories = await listPlayableCategories();
    category = !level && sp.categoria ? (categories.find((c) => c.slug === sp.categoria) ?? null) : null;
    ranking = await getRanking({
      scope: level
        ? { mode: "LEVEL", level }
        : category
          ? { mode: "CATEGORY", categoryId: category.id }
          : { mode: "MIXED" },
      period,
      playerIds: await readOwnedPlayerIds(),
    });
  } catch (err) {
    console.error("[ranking] falha ao carregar:", err);
  }

  const filter: RankingFilter = level ? { nivel: level } : { categoria: category?.slug ?? null };
  const scopeTitle = level
    ? `📶 Nível ${LEVEL_LABELS[level]}`
    : category
      ? `${category.icon} ${category.name}`
      : "🎲 Geral (Temas Variados)";

  return (
    <PageShell width="2xl">
      <div className="space-y-6">
        <header className="space-y-1 text-center">
          <h1 className="text-2xl font-bold">Ranking</h1>
          <p className="text-sm text-muted-foreground">
            Melhor nota de cada jogador. Empate: menor tempo, depois quem terminou primeiro.
          </p>
        </header>

        <nav aria-label="Escopo do ranking" className="space-y-3">
          <div className="flex justify-center gap-2">
            <Chip href={rankingHref(null, period)} active={!category && !level}>
              🎲 Geral
            </Chip>
            <Chip href={rankingHref(category?.slug ?? categories[0]?.slug ?? null, period)} active={!!category}>
              🎯 Por categoria
            </Chip>
            <Chip href={rankingHref({ nivel: level ?? 1 }, period)} active={!!level}>
              📶 Por nível
            </Chip>
          </div>
          {level && (
            <div className="flex flex-wrap justify-center gap-2">
              {LEVELS.map((l) => (
                <Chip key={l} href={rankingHref({ nivel: l }, period)} active={l === level}>
                  {LEVEL_LABELS[l]}
                </Chip>
              ))}
            </div>
          )}
          {category && (
            <div className="flex flex-wrap justify-center gap-2">
              {categories.map((c) => (
                <Chip key={c.id} href={rankingHref(c.slug, period)} active={c.id === category.id}>
                  <span aria-hidden>{c.icon}</span> {c.name}
                </Chip>
              ))}
            </div>
          )}
        </nav>

        <nav aria-label="Período" className="flex justify-center">
          <div className="inline-flex rounded-lg bg-muted p-1">
            {PERIODS.map((p) => (
              <Link
                key={p}
                href={rankingHref(filter, p)}
                aria-current={p === period ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  focusRing,
                  p === period ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {PERIOD_LABELS[p]}
              </Link>
            ))}
          </div>
        </nav>

        <section aria-labelledby="ranking-title" className="space-y-2">
          <h2 id="ranking-title" className="text-center font-semibold">
            {scopeTitle} · {PERIOD_LABELS[period]}
          </h2>
          {!ranking ? (
            <p className="rounded-lg bg-destructive/10 p-4 text-center text-destructive" role="alert">
              O ranking está indisponível no momento. Tente novamente em alguns minutos.
            </p>
          ) : ranking.top.length === 0 ? (
            <p className="rounded-lg bg-muted/60 p-6 text-center text-muted-foreground">
              Ninguém jogou neste período ainda. Que tal ser o primeiro?
            </p>
          ) : (
            <>
              <RankingTable top={ranking.top} mineOutsideTop={ranking.mineOutsideTop} />
              <p className="text-center text-xs text-muted-foreground">
                {ranking.totalPlayers} {ranking.totalPlayers === 1 ? "jogador" : "jogadores"}
                {ranking.totalPlayers > RANKING_TOP && ` · mostrando os ${RANKING_TOP} primeiros`}
              </p>
            </>
          )}
        </section>

        <div className="flex justify-center">
          <Link
            href="/"
            className={buttonVariants({
              size: "lg",
              className: "h-11 px-6 text-base",
            })}
          >
            Jogar
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
