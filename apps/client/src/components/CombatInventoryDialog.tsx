import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Theme } from "@radix-ui/themes";
import type { InventoryItemDto, PlayerDto } from "@mmobot/shared";
import Inventory from "./Inventory";
import type { CombatInventoryActions } from "./ui/Modal/CenterModal/CenterModalItem";

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
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none bg-white p-0 text-[#594F43]"
      onCancel={(event) => {
        event.preventDefault();
        if (!closeDisabled) onClose();
      }}
    >
      <Theme className="flex h-full flex-col" style={{ minHeight: 0 }}>
        <div className="flex shrink-0 items-center justify-between gap-2 border-b p-4">
          <h2 id={titleId} className="font-bold text-[14px] text-nowrap">{title}</h2>
          <button disabled={closeDisabled} className="rounded-xl border px-3 py-2 disabled:opacity-50" onClick={onClose}>Назад</button>
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
