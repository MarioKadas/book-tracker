import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "book-tracker:v1";
const STATUSES = [
  { value: "to-be-read", label: "To be read" },
  { value: "reading", label: "Reading" },
  { value: "completed", label: "Completed" },
];
const statusLabel = (v) => STATUSES.find((s) => s.value === v)?.label ?? v;
const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function loadBooks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

function toCsv(books) {
  const head = ["title", "author", "status", "rating", "added"];
  const rows = books.map((b) =>
    [b.title, b.author, statusLabel(b.status), b.rating || "", b.addedAt].map(csvCell).join(",")
  );
  return [head.join(","), ...rows].join("\r\n");
}

// Validates imported JSON and returns clean book objects.
function normalizeImport(data) {
  const list = Array.isArray(data) ? data : data?.books;
  if (!Array.isArray(list)) throw new Error("Expected a JSON array of books.");
  const books = list
    .filter((b) => b && typeof b.title === "string" && b.title.trim())
    .map((b) => ({
      id: newId(),
      title: b.title.trim(),
      author: typeof b.author === "string" ? b.author.trim() : "",
      status: STATUSES.some((s) => s.value === b.status) ? b.status : "to-be-read",
      rating: Number.isInteger(b.rating) && b.rating >= 0 && b.rating <= 5 ? b.rating : 0,
      addedAt: typeof b.addedAt === "string" ? b.addedAt : new Date().toISOString(),
    }));
  if (!books.length) throw new Error("No valid books found in that file.");
  return books;
}

function Stars({ value, onChange, label }) {
  return (
    <div className="stars" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          className={n <= value ? "star on" : "star"}
          onClick={() => onChange(n === value ? 0 : n)}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function App() {
  const [books, setBooks] = useState(loadBooks);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [status, setStatus] = useState("to-be-read");
  const [rating, setRating] = useState(0);
  const [filter, setFilter] = useState("all");
  const [message, setMessage] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
    } catch {
      setMessage({ kind: "error", text: "Couldn't save to browser storage. Changes may be lost." });
    }
  }, [books]);

  const update = (id, patch) =>
    setBooks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  function addBook(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setBooks((bs) => [
      { id: newId(), title: title.trim(), author: author.trim(), status, rating, addedAt: new Date().toISOString() },
      ...bs,
    ]);
    setTitle("");
    setAuthor("");
    setStatus("to-be-read");
    setRating(0);
    setMessage(null);
  }

  async function importJson(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const imported = normalizeImport(JSON.parse(await file.text()));
      setBooks((bs) => [...imported, ...bs]);
      setMessage({ kind: "ok", text: `Imported ${imported.length} book${imported.length > 1 ? "s" : ""}.` });
    } catch (err) {
      setMessage({ kind: "error", text: `Import failed: ${err.message}` });
    }
  }

  const visible = filter === "all" ? books : books.filter((b) => b.status === filter);
  const count = (v) => books.filter((b) => b.status === v).length;

  return (
    <main className="app">
      <header className="top">
        <h1>Book Tracker</h1>
        <p>{books.length} {books.length === 1 ? "book" : "books"}, saved in this browser's local storage.</p>
      </header>

      <form className="add" onSubmit={addBook}>
        <label className="field grow">
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="The Left Hand of Darkness" />
        </label>
        <label className="field grow">
          <span>Author (optional)</span>
          <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Ursula K. Le Guin" />
        </label>
        <label className="field">
          <span>Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <div className="field">
          <span>Rating</span>
          <Stars value={rating} onChange={setRating} label="New book rating" />
        </div>
        <button className="primary" type="submit">Add book</button>
      </form>

      <div className="bar">
        <div className="tabs" role="tablist" aria-label="Filter by status">
          {[{ value: "all", label: "All", n: books.length }, ...STATUSES.map((s) => ({ ...s, n: count(s.value) }))].map((t) => (
            <button key={t.value} role="tab" aria-selected={filter === t.value} className={filter === t.value ? "tab active" : "tab"} onClick={() => setFilter(t.value)}>
              {t.label} <small>{t.n}</small>
            </button>
          ))}
        </div>
        <div className="io">
          <button onClick={() => download("book-tracker.json", JSON.stringify(books, null, 2), "application/json")} disabled={!books.length}>Export JSON</button>
          <button onClick={() => download("book-tracker.csv", toCsv(books), "text/csv;charset=utf-8")} disabled={!books.length}>Export CSV</button>
          <button onClick={() => fileRef.current?.click()}>Import JSON</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importJson} />
        </div>
      </div>

      {message && <p className={`note ${message.kind}`} role="status">{message.text}</p>}

      {visible.length === 0 ? (
        <p className="empty">
          {books.length === 0
            ? "Your shelf is empty. Add a book above, or import a JSON file."
            : `No books marked “${statusLabel(filter)}” yet.`}
        </p>
      ) : (
        <ul className="shelf">
          {visible.map((b) => (
            <li key={b.id} className={`book ${b.status}`}>
              <div className="info">
                <h2>{b.title}</h2>
                <p>{b.author || "Author unknown"}</p>
              </div>
              <select aria-label={`Status of ${b.title}`} value={b.status} onChange={(e) => update(b.id, { status: e.target.value })}>
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <Stars value={b.rating} onChange={(r) => update(b.id, { rating: r })} label={`Rating of ${b.title}`} />
              <button className="ghost" onClick={() => setBooks((bs) => bs.filter((x) => x.id !== b.id))} aria-label={`Delete ${b.title}`}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
