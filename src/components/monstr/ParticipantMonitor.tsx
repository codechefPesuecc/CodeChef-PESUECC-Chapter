"use client";

import { useEffect, useState } from "react";

interface Participant {
  userId: string;
  username: string;
  name: string | null;
  problems: Array<{
    problemId: string;
    bestStatus: string;
    submissionCount: number;
  }>;
}

interface Props {
  contestId: string;
}

export default function ParticipantMonitor({ contestId }: Props) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [problemIds, setProblemIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchParticipants = async () => {
      try {
        const res = await fetch(`/api/monstr/contests/${contestId}/participants`);
        if (res.ok) {
          const data = await res.json();
          setParticipants(data.participants || []);
          setProblemIds(data.problemIds || []);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    };

    fetchParticipants();
    const timer = setInterval(fetchParticipants, 5000);
    return () => clearInterval(timer);
  }, [contestId]);

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "AC":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
      case "WA":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
      case "TLE":
      case "MLE":
      case "RE":
      case "CE":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
    }
  };

  return (
    <div className="mecha-wrapper space-y-4">
      <h2 className="text-lg font-semibold">Live Participants</h2>

      {loading ? (
        <p className="text-sm text-charcoal/60">Loading...</p>
      ) : participants.length === 0 ? (
        <p className="text-sm text-charcoal/60">No participants yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline text-left">
                <th className="px-3 py-2 font-semibold">Username</th>
                {problemIds.map((id) => (
                  <th key={id} className="px-3 py-2 font-semibold text-center">
                    P{problemIds.indexOf(id) + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {participants.map((p) => (
                <tr key={p.userId} className="hover:bg-cream/40 dark:hover:bg-white/[0.02]">
                  <td className="px-3 py-2">
                    <div className="font-medium text-chocolate">{p.username}</div>
                    {p.name && (
                      <div className="text-xs text-charcoal/60">{p.name}</div>
                    )}
                  </td>
                  {problemIds.map((id) => {
                    const sub = p.problems.find((s) => s.problemId === id);
                    return (
                      <td key={id} className="px-3 py-2 text-center">
                        {sub ? (
                          <div
                            className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusBadgeColor(sub.bestStatus)}`}
                          >
                            {sub.bestStatus} ({sub.submissionCount})
                          </div>
                        ) : (
                          <span className="text-xs text-charcoal/40">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
