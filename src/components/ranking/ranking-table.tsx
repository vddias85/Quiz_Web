import { cn } from "@/lib/utils";
import { formatDateTime, formatDuration } from "@/lib/format";
import type { RankingRowDto } from "@/server/ranking";

const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function Row({ row }: { row: RankingRowDto }) {
  return (
    <tr
      className={cn("border-t", row.isMine && "bg-secondary font-semibold text-secondary-foreground")}
      aria-current={row.isMine ? "true" : undefined}
    >
      <td className="py-2 pr-2 pl-3 tabular-nums sm:pl-4">
        {MEDALS[row.position] ? (
          <>
            <span aria-hidden>{MEDALS[row.position]}</span>
            <span className="sr-only">{row.position}º</span>
          </>
        ) : (
          `${row.position}º`
        )}
      </td>
      <td className="max-w-[9rem] truncate px-2 py-2 sm:max-w-none">
        {row.nickname}
        {row.isMine && <span className="ml-1 text-xs font-normal">(você)</span>}
      </td>
      <td className="px-2 py-2 text-right font-semibold tabular-nums">{row.score}</td>
      <td className="px-2 py-2 text-right tabular-nums">{formatDuration(row.totalTimeMs)}</td>
      <td className="hidden py-2 pr-4 pl-2 text-right text-muted-foreground tabular-nums sm:table-cell">
        {formatDateTime(row.finishedAt)}
      </td>
    </tr>
  );
}

/** Tabela do ranking: Top 50 e, separadas, as linhas dos apelidos deste navegador fora dele. */
export function RankingTable({ top, mineOutsideTop }: { top: RankingRowDto[]; mineOutsideTop: RankingRowDto[] }) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left text-muted-foreground">
          <tr>
            <th scope="col" className="py-2 pr-2 pl-3 font-medium sm:pl-4">
              <span aria-hidden>#</span>
              <span className="sr-only">Posição</span>
            </th>
            <th scope="col" className="px-2 py-2 font-medium">
              Apelido
            </th>
            <th scope="col" className="px-2 py-2 text-right font-medium">
              Nota
            </th>
            <th scope="col" className="px-2 py-2 text-right font-medium">
              Tempo
            </th>
            <th scope="col" className="hidden py-2 pr-4 pl-2 text-right font-medium sm:table-cell">
              Data
            </th>
          </tr>
        </thead>
        <tbody>
          {top.map((row) => (
            <Row key={`t${row.position}`} row={row} />
          ))}
          {mineOutsideTop.length > 0 && (
            <>
              <tr className="border-t" aria-hidden>
                <td colSpan={5} className="py-1 text-center text-muted-foreground">
                  ⋯
                </td>
              </tr>
              {mineOutsideTop.map((row) => (
                <Row key={`m${row.position}`} row={row} />
              ))}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
