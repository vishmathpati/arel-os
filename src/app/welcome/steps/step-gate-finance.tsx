/**
 * Step 6 — GATE: Finance OS (spec §3 Step 6, §gates). Opt-in. The five finance
 * databases (`bank-accounts`, `cards`, `subscriptions`, `transactions`,
 * `payments`) already ship in every vault from the template — "activating"
 * Finance is just guided manual data entry into three of them, using the exact
 * same row-write path the Databases UI uses (`createRow` + `setRowCell` from
 * `database-data.ts` / `db-rows.ts`): a `type: page` row with `database:
 * "[[<slug>]]"`, then one `setRowCell` per column value. No new persistence
 * mechanism.
 *
 * Gmail auto-sync is mentioned exactly once, as an "advanced, later" pointer —
 * never an in-flow action (spec explicit requirement). Declining sets
 * `gates.finance: "no"` and skips straight past 6a/6b/6c.
 */

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { createRow } from "@/shared/lib/database-data";
import { setRowCell } from "@/shared/lib/db-rows";
import { useState } from "react";

type Phase = "gate" | "bank" | "card" | "subs" | "done";

interface BankDraft {
  bank: string;
  type: string;
  last4: string;
  balance: string;
  currency: string;
}

interface CardDraft {
  kind: string;
  network: string;
  last4: string;
  currency: string;
}

interface SubDraft {
  vendor: string;
  cost: string;
  currency: string;
  cycle: string;
}

const BANKS = ["Chase", "Bank of America", "HSBC", "HDFC", "ICICI", "Other"];
const CURRENCIES = ["USD", "EUR", "GBP", "INR"];
const CARD_NETWORKS = ["Visa", "Mastercard", "RuPay", "Amex"];
const CYCLES = ["Monthly", "Yearly", "Quarterly", "Weekly"];

function emptyBank(): BankDraft {
  return { bank: "HDFC", type: "Savings", last4: "", balance: "", currency: "INR" };
}
function emptyCard(): CardDraft {
  return { kind: "Debit", network: "Visa", last4: "", currency: "INR" };
}
function emptySub(): SubDraft {
  return { vendor: "", cost: "", currency: "INR", cycle: "Monthly" };
}

export function StepGateFinance({
  onNext,
}: {
  onNext: (result: { accepted: boolean; accountCount: number; subCount: number }) => void;
}) {
  const [phase, setPhase] = useState<Phase>("gate");
  const [saving, setSaving] = useState(false);

  const [bank, setBank] = useState<BankDraft>(emptyBank());
  const [bankSaved, setBankSaved] = useState(false);

  const [card, setCard] = useState<CardDraft>(emptyCard());
  const [cardSaved, setCardSaved] = useState(false);

  const [subs, setSubs] = useState<SubDraft[]>([]);
  const [subDraft, setSubDraft] = useState<SubDraft>(emptySub());

  const decline = () => onNext({ accepted: false, accountCount: 0, subCount: 0 });

  const saveBank = async () => {
    setSaving(true);
    try {
      const title = `${bank.bank} ${bank.type}${bank.last4 ? ` ••${bank.last4}` : ""}`;
      const row = await createRow("bank-accounts", title);
      await setRowCell(row, "bank", bank.bank);
      await setRowCell(row, "type", bank.type);
      if (bank.last4) await setRowCell(row, "last4", bank.last4);
      if (bank.balance) await setRowCell(row, "balance", Number(bank.balance));
      await setRowCell(row, "currency", bank.currency);
      await setRowCell(row, "status", "Active");
      setBankSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const saveCard = async () => {
    setSaving(true);
    try {
      const title = `${card.network} ${card.kind}${card.last4 ? ` ••${card.last4}` : ""}`;
      const row = await createRow("cards", title);
      await setRowCell(row, "kind", card.kind);
      await setRowCell(row, "network", card.network);
      if (card.last4) await setRowCell(row, "last4", card.last4);
      await setRowCell(row, "currency", card.currency);
      await setRowCell(row, "status", "Active");
      setCardSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const addSub = async () => {
    if (!subDraft.vendor.trim()) return;
    setSaving(true);
    try {
      const row = await createRow("subscriptions", subDraft.vendor.trim());
      await setRowCell(row, "vendor", subDraft.vendor.trim());
      if (subDraft.cost) await setRowCell(row, "cost", Number(subDraft.cost));
      await setRowCell(row, "currency", subDraft.currency);
      await setRowCell(row, "cycle", subDraft.cycle);
      await setRowCell(row, "status", "Active");
      setSubs((prev) => [...prev, subDraft]);
      setSubDraft(emptySub());
    } finally {
      setSaving(false);
    }
  };

  if (phase === "gate") {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <h1 className="text-heading font-semibold">Want to track your money here too?</h1>
          <p className="text-body text-muted-foreground">
            Arel can hold your accounts, cards, and subscriptions as simple tables — a clear picture
            of what you own and what you're paying for. It's optional and fully manual to start.
            Turn it on?
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setPhase("bank")}>Yes, set up Finance</Button>
          <Button variant="ghost" onClick={decline}>
            Not now
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "bank") {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <h1 className="text-heading font-semibold">Your five finance tables are ready.</h1>
          <p className="text-body text-muted-foreground">
            Bank accounts, Cards, Subscriptions, Transactions, Payments — no creation needed,
            they're already in your vault. Let's put in a few real numbers so it's useful from day
            one. Add one account you actually use. Just the basics — no login, nothing leaves your
            machine.
          </p>
        </div>

        {bankSaved ? (
          <p className="rounded-md border border-border bg-muted/40 px-4 py-3 text-body">
            Saved — {bank.bank} {bank.type} is in your Bank accounts table.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bank">
              <Select value={bank.bank} onValueChange={(v) => setBank({ ...bank, bank: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BANKS.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Type">
              <Select value={bank.type} onValueChange={(v) => setBank({ ...bank, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Savings">Savings</SelectItem>
                  <SelectItem value="Current">Current</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Last 4 (optional)">
              <Input
                maxLength={4}
                value={bank.last4}
                onChange={(e) => setBank({ ...bank, last4: e.target.value.replace(/\D/g, "") })}
                placeholder="1234"
              />
            </Field>
            <Field label="Balance (optional)">
              <Input
                type="number"
                value={bank.balance}
                onChange={(e) => setBank({ ...bank, balance: e.target.value })}
                placeholder="0"
              />
            </Field>
            <Field label="Currency">
              <Select
                value={bank.currency}
                onValueChange={(v) => setBank({ ...bank, currency: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        )}

        {!bankSaved && (
          <Button onClick={saveBank} disabled={saving}>
            {saving ? "Saving…" : "Save bank account"}
          </Button>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button variant="outline" onClick={() => setPhase("card")} disabled={!bankSaved}>
            Continue →
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "card") {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <h1 className="text-heading font-semibold">Now add a card.</h1>
          <p className="text-body text-muted-foreground">
            Same idea — just the basics for one card you actually use.
          </p>
        </div>

        {cardSaved ? (
          <p className="rounded-md border border-border bg-muted/40 px-4 py-3 text-body">
            Saved — {card.network} {card.kind} is in your Cards table.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kind">
              <Select value={card.kind} onValueChange={(v) => setCard({ ...card, kind: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Credit">Credit</SelectItem>
                  <SelectItem value="Debit">Debit</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Network">
              <Select value={card.network} onValueChange={(v) => setCard({ ...card, network: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CARD_NETWORKS.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Last 4 (optional)">
              <Input
                maxLength={4}
                value={card.last4}
                onChange={(e) => setCard({ ...card, last4: e.target.value.replace(/\D/g, "") })}
                placeholder="1234"
              />
            </Field>
            <Field label="Currency">
              <Select
                value={card.currency}
                onValueChange={(v) => setCard({ ...card, currency: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        )}

        {!cardSaved && (
          <Button onClick={saveCard} disabled={saving}>
            {saving ? "Saving…" : "Save card"}
          </Button>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button variant="outline" onClick={() => setPhase("subs")} disabled={!cardSaved}>
            Continue →
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "subs") {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <h1 className="text-heading font-semibold">A couple of subscriptions.</h1>
          <p className="text-body text-muted-foreground">
            Add the two or three you'd miss if they vanished — Netflix, Spotify, whatever.
          </p>
        </div>

        {subs.length > 0 && (
          <ul className="space-y-1.5">
            {subs.map((s) => (
              <li key={s.vendor} className="flex items-center gap-2 text-body">
                <span className="font-medium">{s.vendor}</span>
                <span className="text-caption text-muted-foreground">
                  {s.currency} {s.cost || "0"} / {s.cycle.toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-4 gap-2">
          <Input
            className="col-span-2"
            value={subDraft.vendor}
            onChange={(e) => setSubDraft({ ...subDraft, vendor: e.target.value })}
            placeholder="Netflix"
          />
          <Input
            type="number"
            value={subDraft.cost}
            onChange={(e) => setSubDraft({ ...subDraft, cost: e.target.value })}
            placeholder="Cost"
          />
          <Select
            value={subDraft.cycle}
            onValueChange={(v) => setSubDraft({ ...subDraft, cycle: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CYCLES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={addSub}
          disabled={saving || !subDraft.vendor.trim()}
        >
          Add subscription
        </Button>

        <div className="rounded-md border border-dashed border-border px-4 py-3 text-caption text-muted-foreground">
          Later, Arel can read these off your Gmail automatically. That's an advanced setup — see
          Settings → Advanced → Connect Gmail once you're ready.
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={() =>
              onNext({
                accepted: true,
                accountCount: bankSaved && cardSaved ? 2 : 1,
                subCount: subs.length,
              })
            }
          >
            Finance is set →
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-caption text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
