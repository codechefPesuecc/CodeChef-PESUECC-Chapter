"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PromoteTeacherForm() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{ id: string; username: string; name: string | null; email: string }>
  >([]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/users/search?q=${encodeURIComponent(query)}`,
      );
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setSearchResults(data.users || []);
    } catch {
      setError("Search failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePromote = async (userId: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, isTeacher: true }),
      });
      if (!res.ok) throw new Error("Promotion failed");
      setQuery("");
      setSearchResults([]);
      router.refresh();
    } catch {
      setError("Failed to promote user.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSearch} className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Username, name, or email..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mecha-input flex-1"
          disabled={loading}
        />
        <button
          type="submit"
          className="mecha-btn"
          disabled={loading || !query.trim()}
        >
          {loading ? "..." : "Search"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {searchResults.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {searchResults.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded"
            >
              <div>
                <p className="font-medium">{user.username}</p>
                {user.name && (
                  <p className="text-sm text-gray-500">{user.name}</p>
                )}
                <p className="text-xs text-gray-400">{user.email}</p>
              </div>
              <button
                type="button"
                onClick={() => handlePromote(user.id)}
                disabled={loading}
                className="mecha-btn text-green-600 hover:bg-green-50 dark:hover:bg-green-950 text-sm"
              >
                {loading ? "..." : "Promote"}
              </button>
            </div>
          ))}
        </div>
      )}
    </form>
  );
}
