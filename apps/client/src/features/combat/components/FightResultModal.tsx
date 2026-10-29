import { CombatStateResponse,RARITY_COLORS,RARITY_LABELS } from "@mmobot/shared";
import { Button,Flex,Text } from "@radix-ui/themes";
import { useNavigate } from "react-router-dom";
import CenterModal from "../../../shared/ui/modal/CenterModal";
import { motion,useReducedMotion } from "motion/react";
type ResultFightProps={
    state:CombatStateResponse
    tutorial?: boolean
}

export default function CenterResultFight({state,tutorial = false}:ResultFightProps){
    const reduced = useReducedMotion();
    const navigate= useNavigate();
    const lootItems = state.droppedItems;

    return(
        <CenterModal >
            <Flex direction="column" gap="2" align="center">
               <Text size="4" weight="bold" className={state.status === "victory" ? "text-[#f76a15]" : "text-red-500"}>
                    {state.status === "victory" && "Победа!"}
                    {state.status === "defeat" && "Вы проиграли"}
                    {state.status === "fled" && "Вы сбежали"}
                </Text>
                {/* последние записи лога — там же про лут и опыт */}
                {state.status == "victory" ?
                <>
                    <Text size="1" color="gray">
                        Ваша награда
                    </Text>
                    <Flex direction="row" wrap="wrap" justify="center" align="center" gap="2">
                        <div className=" flex flex-col g-1 items-center">
                            <svg className="w-10 h-10"  fill="#ff7b00" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" stroke="#ff7b00"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <g data-name="2. Coin" id="_2._Coin"> <path d="M22,9h-.19A2.83,2.83,0,0,0,22,8V6a3,3,0,0,0-3-3H3A3,3,0,0,0,0,6V8a3,3,0,0,0,2.22,2.88A3,3,0,0,0,2,12v2a3,3,0,0,0,.22,1.12A3,3,0,0,0,0,18v2a3,3,0,0,0,2.22,2.88A3,3,0,0,0,2,24v2a3,3,0,0,0,3,3H22A10,10,0,0,0,22,9Zm-9.16,6H5a1,1,0,0,1-1-1V12a1,1,0,0,1,1-1H16A10,10,0,0,0,12.84,15ZM2,6A1,1,0,0,1,3,5H19a1,1,0,0,1,1,1V8a1,1,0,0,1-1,1H3A1,1,0,0,1,2,8ZM2,18a1,1,0,0,1,1-1h9.2a10.1,10.1,0,0,0,0,4H3a1,1,0,0,1-1-1Zm3,9a1,1,0,0,1-1-1V24a1,1,0,0,1,1-1h7.84A10,10,0,0,0,16,27Zm17,0a8,8,0,1,1,8-8A8,8,0,0,1,22,27Z"></path> <path d="M22,16h2a1,1,0,0,0,0-2H23a1,1,0,0,0-2,0v.18A3,3,0,0,0,22,20a1,1,0,0,1,0,2H20a1,1,0,0,0,0,2h1a1,1,0,0,0,2,0v-.18A3,3,0,0,0,22,18a1,1,0,0,1,0-2Z"></path> </g> </g></svg>
                            {state.mob.coinReward}
                        </div>
                        <div className=" flex flex-col g-1 items-center">
                            <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="#f76a15"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M4 19V6.2C4 5.0799 4 4.51984 4.21799 4.09202C4.40973 3.71569 4.71569 3.40973 5.09202 3.21799C5.51984 3 6.0799 3 7.2 3H16.8C17.9201 3 18.4802 3 18.908 3.21799C19.2843 3.40973 19.5903 3.71569 19.782 4.09202C20 4.51984 20 5.0799 20 6.2V17H6C4.89543 17 4 17.8954 4 19ZM4 19C4 20.1046 4.89543 21 6 21H20M9 7H15M9 11H15M19 17V21" stroke="#f76a15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>
                            {state.mob.pointsReward}
                        </div>
                        {lootItems.map((lootItem, index) =>
                            <motion.div key={`${lootItem.id}-${index}`} initial={tutorial && !reduced ? { opacity: 0, scale: 0.7, y: 10 } : false} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 230, damping: 16, delay: reduced ? 0 : index * 0.08 }} className="flex max-w-28 flex-col items-center text-center" title={RARITY_LABELS[lootItem.rarity]}>
                                <div className="h-10 w-10 [&_svg]:h-full [&_svg]:w-full" style={{ color: RARITY_COLORS[lootItem.rarity] }} dangerouslySetInnerHTML={{ __html: lootItem.icon }}/>
                                <Text size="1">{lootItem.name}</Text>
                            </motion.div>
                        )}
                    </Flex>
                    {lootItems.length === 0 && <Text size="1" color="gray">Предметы не выпали</Text>}
                </>
                :
                <></>}

                {tutorial && state.status === "victory" && <Text size="2" align="center">Первая находка твоя! Открой инвентарь и надень оружие.</Text>}
                <Button className="game-button"  color="orange" onClick={() => { navigate(tutorial && state.status === "victory" ? "/Inventory" : "/") }}>
                    {tutorial && state.status === "victory" ? "Открыть инвентарь" : "Вернуться в город"}
                </Button>
            </Flex>
        </CenterModal>
    )
}
