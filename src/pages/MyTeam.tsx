import { useMemo, useState } from "react";
import { teammates as seedTeammates, coHosts as seedCoHosts } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Pencil, Trash2, Star, CreditCard, Landmark } from "lucide-react";
import { toast } from "sonner";

type Teammate = (typeof seedTeammates)[number];
type CoHost = (typeof seedCoHosts)[number];

const initials = (name: string) =>
  name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();

const MyTeam = () => {
  const [tab, setTab] = useState<"team" | "co">("team");
  const [teammates, setTeammates] = useState<Teammate[]>(seedTeammates);
  const [coHosts, setCoHosts] = useState<CoHost[]>(seedCoHosts);
  const [query, setQuery] = useState("");

  const [inviteTeamOpen, setInviteTeamOpen] = useState(false);
  const [inviteCoOpen, setInviteCoOpen] = useState(false);
  const [editTeammate, setEditTeammate] = useState<Teammate | null>(null);
  const [editCoHost, setEditCoHost] = useState<CoHost | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<
    | { kind: "team"; id: string; name: string }
    | { kind: "co"; id: string; name: string }
    | null
  >(null);

  const filteredTeammates = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teammates;
    return teammates.filter(
      (t) => t.name.toLowerCase().includes(q) || t.role.toLowerCase().includes(q),
    );
  }, [teammates, query]);

  const filteredCoHosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return coHosts;
    return coHosts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.properties.toLowerCase().includes(q) ||
        c.paymentMethod.brand.toLowerCase().includes(q),
    );
  }, [coHosts, query]);

  const removeTeammate = (id: string) => {
    setTeammates((arr) => arr.filter((t) => t.id !== id));
    toast.success("Teammate removed");
  };
  const removeCoHost = (id: string) => {
    setCoHosts((arr) => arr.filter((c) => c.id !== id));
    toast.success("Co-host removed");
  };

  return (
    <div className="space-y-4 w-full max-w-7xl mx-auto">
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-2 border-b border-border">
          <button
            onClick={() => setTab("team")}
            className={`p-4 font-medium border-b-2 ${tab === "team" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
          >
            Teammates
          </button>
          <button
            onClick={() => setTab("co")}
            className={`p-4 font-medium border-b-2 ${tab === "co" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
          >
            Co-Hosts
          </button>
        </div>

        <div className="p-4 flex gap-3 flex-wrap items-center">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tab === "team" ? "Search teammates" : "Search co-hosts"}
              className="pl-9"
            />
          </div>
          <div className="sm:ml-auto flex flex-wrap gap-2">
            {tab === "team" ? (
              <>
                <Button
                  variant="outline"
                  onClick={() =>
                    toast.info("Opening Marketplace…", {
                      description: "Browse vetted cleaners available in your area.",
                    })
                  }
                >
                  Find a Cleaner in the Marketplace
                </Button>
                <Button className="rounded-full" onClick={() => setInviteTeamOpen(true)}>
                  Invite Teammate
                </Button>
              </>
            ) : (
              <Button className="rounded-full" onClick={() => setInviteCoOpen(true)}>
                Invite Co-hosts
              </Button>
            )}
          </div>
        </div>

        {tab === "team" ? (
          <TeamTable
            rows={filteredTeammates}
            onEdit={setEditTeammate}
            onDelete={(t) => setConfirmDelete({ kind: "team", id: t.id, name: t.name })}
          />
        ) : (
          <CoHostsTable
            rows={filteredCoHosts}
            onEdit={setEditCoHost}
            onDelete={(c) => setConfirmDelete({ kind: "co", id: c.id, name: c.name })}
          />
        )}
      </div>

      <InviteTeammateDialog
        open={inviteTeamOpen}
        onOpenChange={setInviteTeamOpen}
        onInvite={(t) => {
          setTeammates((arr) => [t, ...arr]);
          toast.success("Invitation sent", { description: `${t.name} will get an email shortly.` });
        }}
      />

      <InviteCoHostDialog
        open={inviteCoOpen}
        onOpenChange={setInviteCoOpen}
        onInvite={(c) => {
          setCoHosts((arr) => [c, ...arr]);
          toast.success("Co-host invited", { description: `${c.name} will get an email shortly.` });
        }}
      />

      <EditTeammateDialog
        teammate={editTeammate}
        onClose={() => setEditTeammate(null)}
        onSave={(t) => {
          setTeammates((arr) => arr.map((x) => (x.id === t.id ? t : x)));
          toast.success("Teammate updated");
        }}
      />

      <EditCoHostDialog
        coHost={editCoHost}
        onClose={() => setEditCoHost(null)}
        onSave={(c) => {
          setCoHosts((arr) => arr.map((x) => (x.id === c.id ? c : x)));
          toast.success("Co-host updated");
        }}
      />

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {confirmDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.kind === "team"
                ? "They will lose access to your properties and assigned projects."
                : "They will no longer have co-host access to your properties."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmDelete) return;
                if (confirmDelete.kind === "team") removeTeammate(confirmDelete.id);
                else removeCoHost(confirmDelete.id);
                setConfirmDelete(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const TeamTable = ({
  rows,
  onEdit,
  onDelete,
}: {
  rows: Teammate[];
  onEdit: (t: Teammate) => void;
  onDelete: (t: Teammate) => void;
}) => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-[760px] text-sm">
      <thead className="bg-secondary/40 text-xs font-mono uppercase">
        <tr>
          <th className="text-left p-4">Name</th>
          <th className="text-left p-4">Role</th>
          <th className="text-left p-4">Active on</th>
          <th className="text-right p-4">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.length === 0 && (
          <tr>
            <td colSpan={4} className="p-8 text-center text-muted-foreground">
              No teammates match your search.
            </td>
          </tr>
        )}
        {rows.map((t) => (
          <tr key={t.id} className="hover:bg-muted/40">
            <td className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold">
                  {t.initials}
                </div>
                <div>
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <Star className="h-3 w-3 fill-warning text-warning" /> {t.rating.toFixed(1)}{" "}
                    {t.marketplace && <span className="text-primary">· Marketplace</span>}
                  </div>
                </div>
              </div>
            </td>
            <td className="p-4 text-muted-foreground">{t.role}</td>
            <td className="p-4">
              <div className="text-xs text-muted-foreground">Cleaning</div>
              {t.primary.length > 0 ? (
                <div>
                  Primary: <span className="text-primary">{t.primary.join(", ")}</span>
                </div>
              ) : (
                <button
                  className="text-primary text-xs hover:underline"
                  onClick={() => onEdit(t)}
                >
                  Add to properties
                </button>
              )}
            </td>
            <td className="p-4">
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onEdit(t)}
                  aria-label="Edit teammate"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onDelete(t)}
                  aria-label="Remove teammate"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const CoHostsTable = ({
  rows,
  onEdit,
  onDelete,
}: {
  rows: CoHost[];
  onEdit: (c: CoHost) => void;
  onDelete: (c: CoHost) => void;
}) => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-[820px] text-sm">
      <thead className="bg-secondary/40 text-xs font-mono uppercase">
        <tr>
          <th className="text-left p-4">Name</th>
          <th className="text-left p-4">Properties</th>
          <th className="text-left p-4">Owner Payment Method</th>
          <th className="text-right p-4">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.length === 0 && (
          <tr>
            <td colSpan={4} className="p-8 text-center text-muted-foreground">
              No co-hosts match your search.
            </td>
          </tr>
        )}
        {rows.map((c) => (
          <tr key={c.id} className="hover:bg-muted/40">
            <td className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold">
                  {c.initials}
                </div>
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">Since: {c.since}</div>
                </div>
              </div>
            </td>
            <td className="p-4 text-primary">{c.properties}</td>
            <td className="p-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center shrink-0">
                  {c.paymentMethod.type === "card" ? (
                    <CreditCard className="h-4 w-4" />
                  ) : (
                    <Landmark className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {c.paymentMethod.brand} •••• {c.paymentMethod.last4}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {c.paymentMethod.holder}
                  </div>
                </div>
              </div>
            </td>
            <td className="p-4">
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onEdit(c)}
                  aria-label="Edit co-host"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onDelete(c)}
                  aria-label="Remove co-host"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const InviteTeammateDialog = ({
  open,
  onOpenChange,
  onInvite,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onInvite: (t: Teammate) => void;
}) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Cleaning");

  const reset = () => {
    setName("");
    setEmail("");
    setRole("Cleaning");
  };

  const submit = () => {
    if (!name.trim() || !email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    onInvite({
      id: `t${Date.now()}`,
      name: name.trim(),
      initials: initials(name),
      role,
      rating: 5.0,
      primary: [],
      connected: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
      marketplace: false,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite teammate</DialogTitle>
          <DialogDescription>They'll receive an email to join your team.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Cleaning">Cleaning</SelectItem>
                <SelectItem value="Maintenance">Maintenance</SelectItem>
                <SelectItem value="Inspection">Inspection</SelectItem>
                <SelectItem value="Check-in, Cleaning, Inspection">Check-in, Cleaning, Inspection</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>Send invite</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const InviteCoHostDialog = ({
  open,
  onOpenChange,
  onInvite,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onInvite: (c: CoHost) => void;
}) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [properties, setProperties] = useState("");

  const reset = () => {
    setName("");
    setEmail("");
    setProperties("");
  };

  const submit = () => {
    if (!name.trim() || !email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    onInvite({
      id: `c${Date.now()}`,
      name: name.trim(),
      initials: initials(name),
      properties: properties.trim() || "All properties",
      since: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
      paymentMethod: { type: "card", brand: "Pending", last4: "----", holder: name.trim() },
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite co-host</DialogTitle>
          <DialogDescription>Co-hosts can help manage your properties.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Properties</Label>
            <Input value={properties} onChange={(e) => setProperties(e.target.value)} placeholder="All properties" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>Send invite</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const EditTeammateDialog = ({
  teammate,
  onClose,
  onSave,
}: {
  teammate: Teammate | null;
  onClose: () => void;
  onSave: (t: Teammate) => void;
}) => {
  return (
    <Dialog
      key={teammate?.id ?? "none"}
      open={!!teammate}
      onOpenChange={(v) => !v && onClose()}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit teammate</DialogTitle>
          <DialogDescription>Update name, role, or primary properties.</DialogDescription>
        </DialogHeader>
        {teammate && (
          <EditTeammateForm
            teammate={teammate}
            onSubmit={(t) => {
              onSave(t);
              onClose();
            }}
            onCancel={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

const EditTeammateForm = ({
  teammate,
  onSubmit,
  onCancel,
}: {
  teammate: Teammate;
  onSubmit: (t: Teammate) => void;
  onCancel: () => void;
}) => {
  const [name, setName] = useState(teammate.name);
  const [role, setRole] = useState(teammate.role);
  const [primary, setPrimary] = useState(teammate.primary.join(", "));

  return (
    <>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Full name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Role</Label>
          <Input value={role} onChange={(e) => setRole(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Primary properties (comma separated)</Label>
          <Input value={primary} onChange={(e) => setPrimary(e.target.value)} placeholder="Desert View Villa, Birch Street House" />
        </div>
      </div>
      <DialogFooter className="mt-4">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button
          onClick={() => {
            if (!name.trim()) {
              toast.error("Name is required");
              return;
            }
            onSubmit({
              ...teammate,
              name: name.trim(),
              initials: initials(name),
              role: role.trim() || teammate.role,
              primary: primary
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            });
          }}
        >
          Save changes
        </Button>
      </DialogFooter>
    </>
  );
};

const EditCoHostDialog = ({
  coHost,
  onClose,
  onSave,
}: {
  coHost: CoHost | null;
  onClose: () => void;
  onSave: (c: CoHost) => void;
}) => {
  return (
    <Dialog
      key={coHost?.id ?? "none"}
      open={!!coHost}
      onOpenChange={(v) => !v && onClose()}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit co-host</DialogTitle>
          <DialogDescription>Update name and assigned properties.</DialogDescription>
        </DialogHeader>
        {coHost && (
          <EditCoHostForm
            coHost={coHost}
            onSubmit={(c) => {
              onSave(c);
              onClose();
            }}
            onCancel={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

const EditCoHostForm = ({
  coHost,
  onSubmit,
  onCancel,
}: {
  coHost: CoHost;
  onSubmit: (c: CoHost) => void;
  onCancel: () => void;
}) => {
  const [name, setName] = useState(coHost.name);
  const [properties, setProperties] = useState(coHost.properties);

  return (
    <>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Full name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Properties</Label>
          <Input value={properties} onChange={(e) => setProperties(e.target.value)} />
        </div>
        <div className="text-xs text-muted-foreground">
          Payment method is provided by the owner and cannot be edited here.
        </div>
      </div>
      <DialogFooter className="mt-4">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button
          onClick={() => {
            if (!name.trim()) {
              toast.error("Name is required");
              return;
            }
            onSubmit({
              ...coHost,
              name: name.trim(),
              initials: initials(name),
              properties: properties.trim() || coHost.properties,
            });
          }}
        >
          Save changes
        </Button>
      </DialogFooter>
    </>
  );
};

export default MyTeam;
