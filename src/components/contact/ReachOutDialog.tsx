import { useMemo, useState } from "react";
import {
  MessageSquare,
  Phone as PhoneIcon,
  Mail,
  Copy,
  Check,
  MapPin,
  Car as CarIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/store/store";
import { phoneFmt } from "@/lib/utils";
import type { Template } from "@/lib/types";

export interface ReachOutContact {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  vehicle?: string | null;
  preferredMethod?: "sms" | "call" | "email" | null;
  lastContacted?: string | null;
  followUpNotes?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contact: ReachOutContact;
}

const isMobile =
  typeof navigator !== "undefined" &&
  /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

function digits(s?: string | null): string {
  return (s ?? "").replace(/\D/g, "");
}

async function copy(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error("Could not copy — clipboard unavailable");
  }
}

export function ReachOutDialog({ open, onOpenChange, contact }: Props) {
  const { data } = useStore();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const templates = data.templates;
  const selected: Template | undefined = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId),
    [templates, selectedTemplateId]
  );

  const phoneDigits = digits(contact.phone);
  const hasPhone = phoneDigits.length > 0;
  const hasEmail = !!contact.email;

  function handleText() {
    if (!hasPhone) {
      toast.error("No phone number on file");
      return;
    }
    const body = selected?.body ?? "";
    if (isMobile) {
      // sms:NUMBER?body=... is broadly supported
      const href = `sms:${phoneDigits}${body ? `?body=${encodeURIComponent(body)}` : ""}`;
      window.location.href = href;
    } else {
      // Desktop fallback: copy phone + body
      const blob = `${phoneFmt(phoneDigits)}${body ? `\n\n${body}` : ""}`;
      void copy(blob, body ? "Number & message" : "Phone");
      toast.message("Desktop can't open SMS — copied so you can paste in your phone");
    }
  }

  function handleCall() {
    if (!hasPhone) {
      toast.error("No phone number on file");
      return;
    }
    window.location.href = `tel:${phoneDigits}`;
  }

  function handleEmail() {
    if (!hasEmail) {
      toast.error("No email on file");
      return;
    }
    const body = selected?.body ?? "";
    const subject = selected?.title ?? "";
    const params = new URLSearchParams();
    if (subject) params.set("subject", subject);
    if (body) params.set("body", body);
    const qs = params.toString();
    window.location.href = `mailto:${contact.email}${qs ? `?${qs}` : ""}`;
  }

  function handleCopyMessage() {
    if (!selected) {
      toast.error("Pick a template first");
      return;
    }
    void copy(selected.body, "Message");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Reach out — {contact.name}
          </DialogTitle>
          <DialogDescription>
            One tap to text, call, or email. Optionally pick a template first.
          </DialogDescription>
        </DialogHeader>

        {/* Contact info card */}
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <div className="space-y-1.5">
            {hasPhone ? (
              <ContactLine
                icon={<PhoneIcon className="h-3.5 w-3.5" />}
                label={phoneFmt(phoneDigits)}
                onCopy={() => copy(phoneFmt(phoneDigits), "Phone number")}
              />
            ) : (
              <p className="text-xs text-muted-foreground">No phone on file</p>
            )}
            {hasEmail ? (
              <ContactLine
                icon={<Mail className="h-3.5 w-3.5" />}
                label={contact.email!}
                onCopy={() => copy(contact.email!, "Email")}
              />
            ) : null}
            {contact.address ? (
              <ContactLine
                icon={<MapPin className="h-3.5 w-3.5" />}
                label={contact.address}
                onCopy={() => copy(contact.address!, "Address")}
              />
            ) : null}
            {contact.vehicle ? (
              <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <CarIcon className="h-3.5 w-3.5" />
                {contact.vehicle}
              </p>
            ) : null}
          </div>

          {(contact.preferredMethod || contact.lastContacted || contact.followUpNotes) && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-2 text-xs text-muted-foreground">
              {contact.preferredMethod ? (
                <Badge variant="outline" className="capitalize">
                  Prefers {contact.preferredMethod}
                </Badge>
              ) : null}
              {contact.lastContacted ? (
                <span>Last contacted {contact.lastContacted}</span>
              ) : null}
              {contact.followUpNotes ? (
                <span className="block w-full text-foreground/80">
                  {contact.followUpNotes}
                </span>
              ) : null}
            </div>
          )}
        </div>

        {/* Template picker */}
        {templates.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Message template (optional)
            </p>
            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto scrollbar-thin">
              {templates.map((t) => {
                const active = t.id === selectedTemplateId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      setSelectedTemplateId(active ? null : t.id)
                    }
                    className={
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors " +
                      (active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card hover:border-primary/40")
                    }
                  >
                    {active ? <Check className="h-3 w-3" /> : null}
                    {t.title}
                  </button>
                );
              })}
            </div>
            {selected ? (
              <p className="mt-2 whitespace-pre-wrap rounded-md border bg-card p-2.5 text-xs text-muted-foreground">
                {selected.body}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Actions */}
        <div className="grid grid-cols-3 gap-2">
          <Button onClick={handleText} disabled={!hasPhone}>
            <MessageSquare className="h-4 w-4" /> Text
          </Button>
          <Button variant="outline" onClick={handleCall} disabled={!hasPhone}>
            <PhoneIcon className="h-4 w-4" /> Call
          </Button>
          <Button variant="outline" onClick={handleEmail} disabled={!hasEmail}>
            <Mail className="h-4 w-4" /> Email
          </Button>
        </div>

        {selected ? (
          <Button variant="ghost" size="sm" onClick={handleCopyMessage}>
            <Copy className="h-4 w-4" /> Copy message text
          </Button>
        ) : null}

        {!isMobile ? (
          <p className="text-[11px] text-muted-foreground">
            On desktop, "Text" copies the phone + message so you can paste it on your phone.
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ContactLine({
  icon,
  label,
  onCopy,
}: {
  icon: React.ReactNode;
  label: string;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      <button
        type="button"
        onClick={onCopy}
        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Copy"
        title="Copy"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
