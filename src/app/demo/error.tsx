"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="demo-main demo-empty">
      <h1>The showroom could not load.</h1>
      <p>Your studio projects are kept. Try opening the demo again.</p>
      <button className="d-button primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
