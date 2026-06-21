import { useMemo } from "react";
import { usePhotos, type JobPhotoWithUrl } from "@/lib/api/photos";

// Read-only photo viewer for the manager-side job sheet.
// Shows Before + After thumbnails in two rows. Each thumb is captioned with
// the uploader's name and a relative timestamp; clicking opens the signed
// URL full-size in a new tab.

const relativeTime = (iso: string): string => {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.round((now - then) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export const JobPhotosViewer = ({ jobId }: { jobId: string }) => {
  const photosQuery = usePhotos(jobId);

  const { before, after } = useMemo(() => {
    const all = photosQuery.data ?? [];
    return {
      before: all.filter((p) => p.type === "before"),
      after: all.filter((p) => p.type === "after"),
    };
  }, [photosQuery.data]);

  if (photosQuery.isLoading) {
    return <p className="text-xs text-muted-foreground">Loading photos…</p>;
  }

  if (before.length === 0 && after.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No photos uploaded for this job yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <Row label="Before" photos={before} />
      <Row label="After" photos={after} />
    </div>
  );
};

function Row({ label, photos }: { label: string; photos: JobPhotoWithUrl[] }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {label} ({photos.length})
      </div>
      {photos.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">None</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <a
              key={p.id}
              href={p.url}
              target="_blank"
              rel="noreferrer"
              className="block group"
              title={`${p.uploader?.full_name ?? "Unknown"} · ${new Date(p.uploaded_at).toLocaleString()}`}
            >
              <div className="aspect-square rounded-md overflow-hidden border border-border">
                <img
                  src={p.url}
                  alt={`${label} photo`}
                  className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                />
              </div>
              <div className="mt-1 px-0.5">
                <div className="text-[10px] font-medium truncate">
                  {p.uploader?.full_name ?? "Unknown"}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {relativeTime(p.uploaded_at)}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
