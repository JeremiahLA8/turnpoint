import { Link } from "react-router-dom";
import { useJobs } from "@/lib/api/jobs";
import { useChecklistTemplates } from "@/lib/api/checklists";
import { Badge } from "@/components/ui/badge";
import { ListChecks, Loader2 } from "lucide-react";

const fmtMoney = (cents: number | null) =>
  cents == null ? "—" : `$${(cents / 100).toFixed(2)}`;

const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
    time: d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
  };
};

const fmtWindow = (start: string, end: string | null) => {
  const s = fmtDateTime(start);
  if (!end) return s.time;
  const e = new Date(end).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${s.time} – ${e}`;
};

const ProjectsList = () => {
  const { data: jobs, isLoading, error } = useJobs();
  const templatesQuery = useChecklistTemplates();
  const templatesById = new Map(
    (templatesQuery.data ?? []).map((t) => [t.id, t]),
  );

  return (
    <div className="bg-card border border-border rounded-xl overflow-x-auto overflow-y-hidden w-full max-w-6xl mx-auto">
      <div className="px-4 py-3 text-xs text-muted-foreground border-b border-border">
        {isLoading ? (
          <span className="inline-flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading projects…</span>
        ) : error ? (
          <span className="text-destructive">Failed to load projects: {error.message}</span>
        ) : (
          <>{jobs?.length ?? 0} {(jobs?.length ?? 0) === 1 ? "project" : "projects"}</>
        )}
      </div>
      <table className="w-full min-w-[800px] text-sm">
        <thead className="bg-secondary/40 text-xs font-mono uppercase">
          <tr>
            <th className="text-left p-4">When</th>
            <th className="text-left p-4">Property</th>
            <th className="text-left p-4">Status</th>
            <th className="text-left p-4">Window</th>
            <th className="text-left p-4">Checklist</th>
            <th className="text-right p-4">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {(jobs ?? []).map((j) => {
            const when = fmtDateTime(j.scheduled_start);
            const propLabel = j.property?.nickname ?? j.property?.name ?? "—";
            const templateId = j.property?.checklist_template_id ?? null;
            const template = templateId ? templatesById.get(templateId) : null;
            return (
              <tr key={j.id} className="hover:bg-muted/40">
                <td className="p-4 whitespace-nowrap">
                  <div className="font-medium">{when.date}</div>
                  <div className="text-xs text-muted-foreground font-mono">{when.time}</div>
                </td>
                <td className="p-4 text-muted-foreground truncate max-w-[220px]">
                  <Link to={`/properties/${j.property_id}`} className="hover:text-foreground">
                    {propLabel}
                  </Link>
                </td>
                <td className="p-4 text-xs">
                  <Badge variant="outline" className="capitalize">{j.status.replace("_", " ")}</Badge>
                </td>
                <td className="p-4 text-muted-foreground whitespace-nowrap font-mono text-xs">
                  {fmtWindow(j.scheduled_start, j.scheduled_end)}
                </td>
                <td className="p-4">
                  {template ? (
                    <Link
                      to={`/checklists/${template.id}`}
                      className="inline-flex items-center gap-1.5 text-sm hover:underline"
                    >
                      <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate max-w-[180px]">{template.name}</span>
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="p-4 text-right font-mono">{fmtMoney(j.amount_cents)}</td>
              </tr>
            );
          })}
          {!isLoading && !error && (jobs?.length ?? 0) === 0 && (
            <tr>
              <td colSpan={6} className="p-8 text-center text-muted-foreground text-sm">
                No projects yet. Jobs will appear here once they're created (or synced from Hostaway in Phase 2).
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ProjectsList;
