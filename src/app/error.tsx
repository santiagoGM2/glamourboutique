'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <span className="eyebrow">GLAMOUR BOUTIQUE CALI</span>
      <h1>Un momento, por favor.</h1>
      <p>No pudimos cargar la colección. Inténtalo de nuevo.</p>
      <button className="button dark" onClick={reset}>
        Volver a intentar
      </button>
    </main>
  );
}
