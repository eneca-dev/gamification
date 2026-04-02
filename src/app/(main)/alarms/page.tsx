import Link from "next/link";
import { ArrowLeft, Bell } from "lucide-react";
import { getCurrentUser } from "@/modules/auth/queries";
import { createSupabaseServerClient } from "@/config/supabase";
import { getAllAlarms } from "@/modules/alarms";
import { AlarmsBanner } from "@/modules/alarms/components/AlarmsBanner";

export default async function AlarmsPage() {
  const currentUser = await getCurrentUser();
  const userEmail = currentUser?.email ?? "";

  let wsUserId: string | null = null;
  if (userEmail) {
    const supabase = await createSupabaseServerClient();
    const { data: wsUser } = await supabase
      .from("ws_users")
      .select("id")
      .eq("email", userEmail.toLowerCase())
      .eq("is_active", true)
      .maybeSingle();
    wsUserId = wsUser?.id ?? null;
  }

  const alarms = wsUserId ? await getAllAlarms(wsUserId) : [];

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors"
        style={{ color: "var(--apex-text-muted)" }}
      >
        <ArrowLeft size={15} />
        На главную
      </Link>

      <div className="animate-fade-in-up">
        <div
          className="rounded-2xl p-6"
          style={{ background: "var(--apex-surface)", border: "1px solid var(--apex-border)" }}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Bell size={18} style={{ color: "var(--apex-warning-text)" }} fill="var(--apex-warning-text)" />
              <h1 className="text-[18px] font-bold" style={{ color: "var(--apex-text)" }}>
                Все напоминания
              </h1>
            </div>
            <span className="text-[12px] font-semibold" style={{ color: "var(--apex-text-muted)" }}>
              {alarms.filter((a) => a.is_resolved).length}/{alarms.length}
            </span>
          </div>

          <AlarmsBanner alarms={alarms} showAll />
        </div>
      </div>
    </div>
  );
}

function pluralize(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) return "напоминаний";
  if (mod10 === 1) return "напоминание";
  if (mod10 >= 2 && mod10 <= 4) return "напоминания";
  return "напоминаний";
}
