"use client";

import { useRouter } from "next/navigation";
import PromoteTeacherForm from "./PromoteTeacherForm";

interface Teacher {
  id: string;
  username: string;
  name: string | null;
}

interface Props {
  teachers: Teacher[];
}

export default function TeacherManagementPanel({ teachers }: Props) {
  const router = useRouter();

  const handleTeacherStatusChange = () => {
    router.refresh();
  };

  return (
    <div className="space-y-8">
      {/* Stats Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="mecha-wrapper text-center">
          <p className="text-xs font-mono uppercase tracking-widest text-bronze mb-2">
            Total Teachers
          </p>
          <p className="text-4xl font-bold text-chocolate">{teachers.length}</p>
        </div>
        <div className="mecha-wrapper text-center">
          <p className="text-xs font-mono uppercase tracking-widest text-bronze mb-2">
            Status
          </p>
          <p className="text-lg font-semibold text-charcoal/70">
            {teachers.length === 0 ? "No teachers" : "Active"}
          </p>
        </div>
        <div className="mecha-wrapper text-center">
          <p className="text-xs font-mono uppercase tracking-widest text-bronze mb-2">
            Action
          </p>
          <p className="text-lg font-semibold text-charcoal/70">
            Ready to add
          </p>
        </div>
      </div>

      {/* Current Teachers */}
      <div className="mecha-wrapper">
        <h2 className="text-lg font-semibold mb-4">
          Current Teachers ({teachers.length})
        </h2>
        {teachers.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-charcoal/60 mb-4">
              No teachers yet. Use the form below to promote your first teacher.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {teachers.map((teacher) => (
              <div
                key={teacher.id}
                className="flex items-center justify-between p-3 border border-hairline rounded hover:bg-cream/20 dark:hover:bg-white/5 transition"
              >
                <div>
                  <p className="font-medium text-chocolate">{teacher.username}</p>
                  {teacher.name && (
                    <p className="text-sm text-charcoal/60">{teacher.name}</p>
                  )}
                </div>
                <button
                  onClick={async () => {
                    const res = await fetch("/api/admin/teachers", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        userId: teacher.id,
                        isTeacher: false,
                      }),
                    });
                    if (res.ok) {
                      handleTeacherStatusChange();
                    }
                  }}
                  className="mecha-btn text-red-600 hover:bg-red-50 dark:hover:bg-red-950 text-sm"
                >
                  Demote
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Promote New Teacher */}
      <div className="mecha-wrapper">
        <h2 className="text-lg font-semibold mb-4">Promote New Teacher</h2>
        <p className="text-sm text-charcoal/60 mb-4">
          Search for a user by username, name, or email and promote them to teacher status.
        </p>
        <PromoteTeacherForm />
      </div>
    </div>
  );
}
