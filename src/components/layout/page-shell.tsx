import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

// Arquivos gerados a partir de logo/logo.jpg (proporção 1088 × 976).
const LOGO = { small: { src: "/logo-256.webp", width: 72 }, large: { src: "/logo-512.webp", width: 150 } } as const;

export function BrandLogo({ size, linkHome }: { size: "small" | "large"; linkHome: boolean }) {
  const { src, width } = LOGO[size];
  const img = (
    <Image
      src={src}
      alt="Quiz online"
      width={width}
      height={Math.round((width * 976) / 1088)}
      priority
      unoptimized // já otimizado (webp pequeno); evita gastar a cota de otimização da Vercel
      className="rounded-2xl shadow-sm"
    />
  );
  return linkHome ? (
    <Link href="/" aria-label="Quiz online — página inicial" className="rounded-2xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      {img}
    </Link>
  ) : (
    img
  );
}

/** Estrutura comum das páginas: logo no topo e o conteúdo num cartão branco sobre o fundo azul gelo. */
export function PageShell({
  children,
  logoSize = "small",
  linkHome = true,
  width = "xl",
  intro,
}: {
  children: React.ReactNode;
  logoSize?: "small" | "large";
  linkHome?: boolean;
  width?: "xl" | "2xl";
  intro?: React.ReactNode;
}) {
  return (
    <main className={cn("mx-auto w-full px-4 py-6 sm:py-10", width === "xl" ? "max-w-xl" : "max-w-2xl")}>
      <header className="mb-6 flex flex-col items-center gap-3 text-center">
        <BrandLogo size={logoSize} linkHome={linkHome} />
        {intro}
      </header>
      <div className="rounded-2xl bg-card p-5 text-card-foreground shadow-sm ring-1 ring-border sm:p-8">{children}</div>
    </main>
  );
}
