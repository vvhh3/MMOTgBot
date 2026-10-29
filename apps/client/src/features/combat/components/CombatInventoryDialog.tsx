import type { InventoryItemDto,PlayerDto } from "@mmobot/shared";
import { Theme } from "@radix-ui/themes";
import { useEffect,useId,useRef } from "react";
import { createPortal } from "react-dom";
import Inventory from "../../inventory/components/Inventory";
import type { CombatInventoryActions } from "../../inventory/components/ItemModal";

type CombatInventoryDialogProps = {
  title: string;
  token: string | null;
  player: PlayerDto | null;
  inventory: InventoryItemDto[];
  onPlayer: (player: PlayerDto) => void;
  onInventory: (inventory: InventoryItemDto[]) => void;
  combat: CombatInventoryActions;
  onClose: () => void;
  closeDisabled: boolean;
  loading?: boolean;
  error?: string | null;
  message?: string;
};

// Окно одинаково для обоих режимов; правила использования предметов передаёт экран боя.
export default function CombatInventoryDialog({ title, onClose, closeDisabled, loading, error, message, ...inventoryProps }: CombatInventoryDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    // Нативное окно удерживает фокус внутри инвентаря и возвращает его при закрытии.
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="modal-surface combat-inventory-dialog fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none p-0!"
      onCancel={(event) => {
        event.preventDefault();
        if (!closeDisabled) onClose();
      }}
    >
      <Theme className="flex h-full flex-col" style={{ minHeight: 0 }}>
        <div className="combat-inventory-header flex shrink-0 items-center justify-between gap-3 border-b">
          <h2 id={titleId} className="min-w-0 break-words font-bold text-[14px]">{title}</h2>
          <button disabled={closeDisabled} className="modal-close-button" aria-label="Закрыть инвентарь" onClick={onClose}>×</button>
        </div>
        {message && <p className="px-4 py-2 text-sm">{message}</p>}
        {loading && <p role="status" className="px-4 text-sm">Обновление инвентаря…</p>}
        {error && <p role="alert" className="px-4 py-2 text-red-500">{error}</p>}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <Inventory {...inventoryProps} />
        </div>
      </Theme>
    </dialog>, document.body,
  );
}
