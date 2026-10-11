import { Tabs } from "@radix-ui/themes";
import type { PlayerDto } from "@mmobot/shared";
import { MobAdmin } from "./adminComponents/MobAdmin";
import { ItemAdmin } from "./adminComponents/ItemAdmin";
import { QuestAdmin } from "./adminComponents/QuestAdmin";
import { PlayerAdmin } from "./adminComponents/PlayerAdmin";

interface AdminProps {
  token: string | null;
  player: PlayerDto | null;
  onPlayer: (player: PlayerDto) => void;
}

export default function Admin({ token, player, onPlayer }: AdminProps) {
  return (
    <div>
      <Tabs.Root defaultValue="Mobs" className="flex w-full flex-col">
        <div className="w-full overflow-x-auto" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
          <Tabs.List color="orange" size="2" className="flex w-max min-w-full justify-start" style={{ justifyContent: "center" }}>
            <Tabs.Trigger className="shrink-0 px-6" value="Mobs">Мобы</Tabs.Trigger>
            <Tabs.Trigger className="shrink-0 px-6" value="Items">Предметы</Tabs.Trigger>
            <Tabs.Trigger className="shrink-0 px-6" value="Quests">Квесты</Tabs.Trigger>
            <Tabs.Trigger className="shrink-0 px-6" value="Player">Персонаж</Tabs.Trigger>
          </Tabs.List>
        </div>
        <Tabs.Content value="Mobs"><MobAdmin token={token} /></Tabs.Content>
        <Tabs.Content value="Items"><ItemAdmin token={token} /></Tabs.Content>
        <Tabs.Content value="Quests"><QuestAdmin token={token} /></Tabs.Content>
        <Tabs.Content value="Player"><PlayerAdmin token={token} player={player} onPlayer={onPlayer} /></Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
