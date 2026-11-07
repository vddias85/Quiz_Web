import { StartForm } from "@/components/home/start-form";
import { listPlayableCategories, type CategoryDto } from "@/server/quiz";

export const dynamic = "force-dynamic";

export default async function Home() {
  let categories: CategoryDto[] = [];
  let unavailable = false;
  try {
    categories = await listPlayableCategories();
  } catch (err) {
    console.error("[home] falha ao carregar categorias:", err);
    unavailable = true;
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10 sm:py-16">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight">Quiz Web</h1>
        <p className="mt-2 text-muted-foreground">Teste seus conhecimentos gerais e entre no ranking.</p>
      </header>
      {unavailable ? (
        <p className="rounded-lg bg-destructive/10 p-4 text-center text-destructive" role="alert">
          O quiz está indisponível no momento. Tente novamente em alguns minutos.
        </p>
      ) : (
        <StartForm categories={categories} />
      )}
    </main>
  );
}
