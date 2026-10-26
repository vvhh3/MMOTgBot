import type { InventoryItemDto, ItemDto } from '@mmobot/shared';

export type InventoryGroup = {
    item: ItemDto;
    inventoryEntry: InventoryItemDto;
    entries: InventoryItemDto[];
    quantity: number;
    equiped: boolean;
};

export function groupInventory(inventory: InventoryItemDto[], catalog: ItemDto[]): InventoryGroup[] {
    const itemsById = new Map(catalog.map(item => [item.id, item]));
    const groups = new Map<number, InventoryGroup>();

    for (const entry of inventory) {
        const item = itemsById.get(entry.itemType);
        if (!item || entry.quantity <= 0) continue;

        const group = groups.get(item.id);
        if (group) {
            group.entries.push(entry);
            group.quantity += entry.quantity;
            group.equiped ||= entry.equiped;
            if (entry.equiped) group.inventoryEntry = entry;
        } else {
            groups.set(item.id, { item, inventoryEntry: entry, entries: [entry], quantity: entry.quantity, equiped: entry.equiped });
        }
    }

    return [...groups.values()];
}
