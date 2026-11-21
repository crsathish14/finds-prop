import { BlogArticleCardSkeleton } from "@/components/domain/blog-article-card";
import { Container } from "@/components/layout/container";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * What the Blog list shows while its articles are read: the title, the search box, the chips and six cards, as
 * skeleton blocks, so nothing jumps when the page arrives. The page's `loading.tsx` names it as busy.
 */
export function BlogListSkeleton() {
  return (
    <Container className="py-6 md:py-8">
      <div aria-hidden="true" className="flex flex-col gap-6">
        <div className="flex max-w-3xl flex-col gap-3">
          <Skeleton shape="title" className="h-9 w-2/3 max-w-sm" />
          <Skeleton shape="text" className="w-full max-w-lg" />
        </div>
        <Skeleton className="h-13 w-full max-w-3xl" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-16 rounded-pill" />
          <Skeleton className="h-10 w-24 rounded-pill" />
          <Skeleton className="h-10 w-24 rounded-pill" />
        </div>
        <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((place) => (
            <li key={place}>
              <BlogArticleCardSkeleton />
            </li>
          ))}
        </ul>
      </div>
    </Container>
  );
}

/** What an article page shows while the article is read: the title, the meta line, the cover and a few lines of text. */
export function BlogArticleSkeleton() {
  return (
    <Container className="py-6 md:py-8">
      <div aria-hidden="true" className="flex flex-col gap-6">
        <div className="mx-auto flex w-full max-w-prose flex-col gap-4">
          <Skeleton shape="text" className="w-24" />
          <Skeleton shape="title" className="h-10 w-full" />
          <Skeleton shape="text" className="w-4/5" />
          <Skeleton shape="text" className="w-48" />
        </div>
        <Skeleton className="aspect-16/9 w-full rounded-xl" />
        <div className="mx-auto flex w-full max-w-prose flex-col gap-3">
          <Skeleton shape="text" className="w-full" />
          <Skeleton shape="text" className="w-full" />
          <Skeleton shape="text" className="w-3/5" />
        </div>
      </div>
    </Container>
  );
}
