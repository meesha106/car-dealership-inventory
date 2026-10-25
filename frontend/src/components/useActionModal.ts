import { useState } from "react";
import type { ActionModalState } from "./ActionModal";

export function useActionModal() {
  const [modal, setModal] = useState<ActionModalState | null>(null);

  return {
    modal,
    closeModal: () => setModal(null),
    showError: (title: string, message: string) =>
      setModal({ kind: "error", title, message }),
    showSuccess: (title: string, message: string) =>
      setModal({ kind: "success", title, message }),
  };
}
