import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <PageShell>
      <div className="space-y-4 py-6 text-center">
        <h1 className="text-2xl font-bold">Página não encontrada</h1>
        <p className="text-muted-foreground">O endereço não existe ou esta partida não pertence a este navegador.</p>
        <Link href="/" className={buttonVariants()}>
          Voltar ao início
        </Link>
      </div>
    </PageShell>
  );
}
