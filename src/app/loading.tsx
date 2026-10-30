export default function Loading() {
  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-6 py-16"
      aria-busy="true"
    >
      <p role="status">Loading…</p>
    </main>
  );
}
