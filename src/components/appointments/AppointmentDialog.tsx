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
  const { dispatch } = useStore();

  function handleDelete() {
    if (!appointment) return;
    if (window.confirm("Delete this appointment? This can't be undone.")) {
      dispatch({ type: "deleteAppointment", id: appointment.id });
      onOpenChange(false);
    }
  }

  return (
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
        />
      </DialogContent>
    </Dialog>
  );
}
