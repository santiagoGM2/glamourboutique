export default function Loading() {
  return (
    <main className="loading-page" aria-label="Cargando la colección">
      <div className="loading-brand">GLAMOUR</div>
      <div className="skeleton-grid">
        {[1, 2, 3, 4].map((i) => (
          <div className="skeleton" key={i} />
        ))}
      </div>
    </main>
  );
}
