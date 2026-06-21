const Reports = () => {
  const monthly = [
    { m: "Dec", v: 28 }, { m: "Jan", v: 42 }, { m: "Feb", v: 36 },
    { m: "Mar", v: 51 }, { m: "Apr", v: 64 }, { m: "May", v: 22 },
  ];
  const max = Math.max(...monthly.map((d) => d.v));
  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { l: "TOTAL PROJECTS", v: "243" },
          { l: "AVG / WEEK", v: "18.6" },
          { l: "ON-TIME RATE", v: "96%" },
        ].map((s) => (
          <div key={s.l} className="bg-card border border-border rounded-xl p-5">
            <div className="text-xs font-mono text-muted-foreground mb-2">{s.l}</div>
            <div className="text-3xl font-bold">{s.v}</div>
          </div>
        ))}
      </div>
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="text-xs font-mono text-muted-foreground mb-4">PROJECTS BY MONTH</div>
        <div className="flex items-end gap-3 h-64">
          {monthly.map((d) => (
            <div key={d.m} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full bg-primary rounded-t-md" style={{ height: `${(d.v / max) * 100}%` }} />
              <div className="text-xs font-mono text-muted-foreground">{d.m}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Reports;
