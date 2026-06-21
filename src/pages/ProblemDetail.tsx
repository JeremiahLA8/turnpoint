import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Clock, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProblem, problemsStore } from "@/lib/problemsStore";
import { toast } from "sonner";

const ProblemDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const problem = useProblem(id);

  if (!problem) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Issue not found</h1>
        <p className="text-muted-foreground text-sm">
          It may have been removed or you don't have access to it.
        </p>
        <Button asChild variant="outline">
          <Link to="/property-problems">Back to issues</Link>
        </Button>
      </div>
    );
  }

  const isResolved = problem.status === "solved";

  const handleResolve = () => {
    problemsStore.setStatus(problem.id, "solved");
    toast.success("Issue marked as resolved");
  };

  const handleReopen = () => {
    problemsStore.setStatus(problem.id, "unresolved");
    toast("Issue reopened");
  };

  return (
    <div className="space-y-6 w-full max-w-3xl mx-auto pb-10">
      <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <header className="space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Ticket #{problem.ticketId}
            </p>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight mt-1 break-words">
              {problem.title}
            </h1>
            <p className="text-sm text-primary mt-1">{problem.property}</p>
          </div>
          <Badge variant={isResolved ? "outline" : "destructive"}>
            {isResolved ? "Solved" : "Open"}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
          <Clock className="h-3 w-3" /> {problem.date} · {problem.time}
          <span>· Reported by <span className="text-primary">{problem.reporter}</span></span>
        </div>
      </header>

      <section className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold mb-2">Description</h2>
        <p className="text-sm text-foreground/90 whitespace-pre-wrap">
          {problem.description || "No description provided."}
        </p>
      </section>

      <section className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold mb-3">Photos</h2>
        {problem.images.length === 0 ? (
          <p className="text-sm text-muted-foreground">No photos uploaded.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {problem.images.map((src, i) => (
              <a
                key={i}
                href={src}
                target="_blank"
                rel="noreferrer"
                className="block aspect-square overflow-hidden rounded-lg border border-border"
              >
                <img
                  src={src}
                  alt={`Issue photo ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              </a>
            ))}
          </div>
        )}
      </section>

      <section className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold mb-2">Cleaner's quote to fix</h2>
        {problem.quote ? (
          <div className="rounded-lg border border-border p-3 space-y-1">
            <div className="text-lg font-bold">${problem.quote.amount.toFixed(2)}</div>
            {problem.quote.note && (
              <p className="text-sm text-muted-foreground">{problem.quote.note}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No quote submitted.</p>
        )}
      </section>

      <div className="flex flex-col sm:flex-row gap-2">
        {isResolved ? (
          <Button variant="outline" className="gap-2" onClick={handleReopen}>
            <RotateCcw className="h-4 w-4" /> Reopen issue
          </Button>
        ) : (
          <Button className="gap-2" onClick={handleResolve}>
            <Check className="h-4 w-4" /> Mark as resolved
          </Button>
        )}
      </div>
    </div>
  );
};

export default ProblemDetail;
