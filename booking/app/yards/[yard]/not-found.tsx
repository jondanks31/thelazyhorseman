export default function YardNotFound() {
  return (
    <main className="yard">
      <section className="card">
        <h1 className="q">No yard at this address.</h1>
        <p className="sub">
          It may have moved, or the address might be a typo. Check with whoever
          sent you the link.
        </p>
      </section>
    </main>
  );
}
