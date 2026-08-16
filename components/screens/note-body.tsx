import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";

/**
 * 評価や予想の本文。
 *
 * **中身は markdown で書かれている。** 役もオーケストレーターも見出しや強調を付けて書くので、
 * そのまま出すと `##` や `**` が地の文に混ざる。読むための画面なので描画して出す。
 */
export function Prose({ children, className }: { readonly children: string; readonly className?: string }) {
  return (
    <div
      className={cn(
        "text-sm leading-relaxed [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-semibold",
        "[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold",
        "[&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:font-semibold",
        "[&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
        "[&_li]:my-0.5 [&_strong]:font-semibold [&_strong]:text-foreground",
        "[&_table]:my-3 [&_table]:w-full [&_table]:text-xs [&_th]:border-b [&_th]:border-border [&_th]:py-1 [&_th]:text-left",
        "[&_td]:border-b [&_td]:border-border/60 [&_td]:py-1 [&_td]:pr-3",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
        className,
      )}
    >
      <Streamdown parseIncompleteMarkdown={false}>{children}</Streamdown>
    </div>
  );
}

/**
 * 評価の本文と、それを書いたのが誰か。
 *
 * **`author` を必ず一緒に出す。** AI が書いた行と人間・対話が書いた行は扱いが違う
 * （人間の読みは勝手に上書きしない）ので、画面でも区別が付くようにする。
 */
export function NoteBody({
  body,
  author,
  className,
}: {
  readonly body: string;
  readonly author: string;
  readonly className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <AuthorBadge author={author} />
      <Prose>{body}</Prose>
    </div>
  );
}

/** 書いた人の印。人間が触った行を目立たせる。 */
export function AuthorBadge({ author }: { readonly author: string }) {
  const tone =
    author === "AI"
      ? "border-border text-muted-foreground"
      : "border-current/40 text-[oklch(0.5_0.12_155)] dark:text-[oklch(0.74_0.11_155)]";

  return (
    <span
      className={cn(
        "inline-block rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-[0.15em] uppercase",
        tone,
      )}
    >
      {author}
    </span>
  );
}
