import { Shield } from "lucide-react";

export default function AdminPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: "var(--tag-purple-bg)" }}
      >
        <Shield size={32} style={{ color: "var(--tag-purple-text)" }} />
      </div>
      <h1
        className="text-2xl font-extrabold"
        style={{ color: "var(--text-primary)" }}
      >
        Админ-панель
      </h1>
      <p
        className="text-sm font-medium"
        style={{ color: "var(--text-secondary)" }}
      >
        Управление системой геймификации
      </p>
    </div>
  );
}
