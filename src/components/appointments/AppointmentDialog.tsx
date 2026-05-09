import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { AppointmentForm } from "./AppointmentForm";
import { useStore } from "@/store/store";
import type { Appointment } from "@/lib/types";
import { MarkCompleteDialog } from "@/components/receipts/MarkCompleteDialog";

interface AppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment?: Appointment;
  initialDate?: Date;
}

export function AppointmentDialog({
  open,
  onOpenChange,
  appointment,
  initialDate,
}: AppointmentDialogProps) {
  const { data, dispatch } = useStore();
  const [completedAppt, setCompletedAppt] = useState<Appointment | null>(null);

  function handleDelete() {
    if (!appointment) return;
    if (window.confirm("Delete this appointment? This can't be undone.")) {
      dispatch({ type: "deleteAppointment", id: appointment.id });
      onOpenChange(false);
    }
  }

  function handleSaved(saved: Appointment, transitionedToCompleted: boolean) {
    const wantsAutoReceipt = data.settings.autoGenerateReceiptOnComplete !== false;
    const alreadyHasReceipt = (data.receipts ?? []).some(
      (r) => r.appointmentId === saved.id && r.receiptStatus === "active"
    );
    if (transitionedToCompleted && wantsAutoReceipt && !alreadyHasReceipt) {
      setCompletedAppt(saved);
      onOpenChange(false);
      return;
    }
    onOpenChange(false);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {appointment ? "Edit appointment" : "New appointment"}
            </DialogTitle>
            <DialogDescription>
              All vehicle, site, service, and pricing details for the job.
            </DialogDescription>
          </DialogHeader>
          <AppointmentForm
            appointment={appointment}
            initialDate={initialDate}
            onDone={() => onOpenChange(false)}
            onDelete={appointment ? handleDelete : undefined}
            onSaved={handleSaved}
          />
        </DialogContent>
      </Dialog>

      {completedAppt ? (
        <MarkCompleteDialog
          open={true}
          appointment={completedAppt}
          onClose={() => setCompletedAppt(null)}
        />
      ) : null}
    </>
  );
}
