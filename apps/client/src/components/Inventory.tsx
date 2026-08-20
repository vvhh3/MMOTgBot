import {Tabs,Text,Box,Card, Progress,Badge, Grid} from "@radix-ui/themes"
import player from "../public/playerM.svg"
export default function Inventory(){
    return(
        <div className=' h-full ' >
            <div className="p-[20px]">
                <Card>
                    <div className="flex flex-col">
                        <div className="flex flex-row "> 
                            <div className="flex flex-row w-[140px] mr-1.5">
                                <img src={player} className="h-[100px]"/>
                                <div className="flex flex-col gap-1 w-[20px] justify-evenly">
                                    <div className="h-[20px] w-[20px] border flex justify-center items-center">+</div>
                                    <div className="h-[20px] w-[20px] border flex justify-center items-center">+</div>
                                    <div className="h-[20px] w-[20px] border flex justify-center items-center">+</div>
                                </div>
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col">
                                <div className="flex justify-end w-full">
                                    <Badge color="orange">Lv.4</Badge>
                                </div>
                                <div className="flex flex-col">
                                    <div className="flex flex-row ">
                                        <Text weight="bold" size="3">HP</Text>
                                        <div className="flex-1 min-w-0 ml-2 flex items-center">
                                            <Progress value={37} color="green"></Progress>
                                        </div>
                                    </div>
                                    <div className="flex justify-end">
                                        <Text size="1">
                                            37/100
                                        </Text>
                                    </div>
                                </div>
                                <div className="flex flex-col">
                                    <div className="flex flex-row ">
                                        <Text weight="bold" size="3">XP</Text>
                                        <div className="flex-1 min-w-0 ml-2 flex items-center">
                                            <Progress value={50} color="orange"></Progress>
                                        </div>  
                                    </div>
                                    <div className="flex justify-end">
                                        <Text size="1">
                                            250/500
                                        </Text>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-row justify-center gap-6">
                            <div className="flex flex-row gap-3">
                                <svg height="20px" width="20px"  viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" version="1.1" fill="none" stroke="#E85D2F" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="m2.75 9.25 1.5 2.5 2 1.5m-4.5 0 1 1m1.5-2.5-1.5 1.5m3-1 8.5-8.5v-2h-2l-8.5 8.5"></path> <path d="m10.25 12.25-2.25-2.25m2-2 2.25 2.25m1-1-1.5 2.5-2 1.5m4.5 0-1 1m-1.5-2.5 1.5 1.5m-7.25-5.25-4.25-4.25v-2h2l4.25 4.25"></path> </g></svg>                            
                                <Text weight="bold" size="3">ATK</Text>
                                <Text color="orange">24</Text>
                            </div>
                            <div className="flex flex-row gap-3">
                                <svg height="20px" width="20px"  viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M11.302 21.6149C11.5234 21.744 11.6341 21.8086 11.7903 21.8421C11.9116 21.8681 12.0884 21.8681 12.2097 21.8421C12.3659 21.8086 12.4766 21.744 12.698 21.6149C14.646 20.4784 20 16.9084 20 12V6.6C20 6.04207 20 5.7631 19.8926 5.55048C19.7974 5.36198 19.6487 5.21152 19.4613 5.11409C19.25 5.00419 18.9663 5.00084 18.3988 4.99413C15.4272 4.95899 13.7136 4.71361 12 3C10.2864 4.71361 8.57279 4.95899 5.6012 4.99413C5.03373 5.00084 4.74999 5.00419 4.53865 5.11409C4.35129 5.21152 4.20259 5.36198 4.10739 5.55048C4 5.7631 4 6.04207 4 6.6V12C4 16.9084 9.35396 20.4784 11.302 21.6149Z" stroke="#E8603C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>                                            <Text weight="bold" size="3">DEF</Text>
                                <Text color="orange">18</Text>
                            </div>
                        </div>
                    </div>
                </Card>
            </div> 
           <Tabs.Root defaultValue="All" className="flex flex-col w-full">
            <div className="w-full overflow-x-auto" style={{scrollbarWidth: "none",msOverflowStyle: "none",}}>
                <Tabs.List color="orange" size="2" className="flex w-max min-w-full justify-start" style={{justifyContent:"center"}}>
                    <Tabs.Trigger className="shrink-0 px-6" value="All">
                        Всё
                    </Tabs.Trigger>

                    <Tabs.Trigger className="shrink-0 px-6" value="Arming">
                        Оружие
                    </Tabs.Trigger>

                    <Tabs.Trigger className="shrink-0 px-6" value="Armor">
                        Броня
                    </Tabs.Trigger>

                    <Tabs.Trigger className="shrink-0 px-6" value="Potions">
                        Зелья
                    </Tabs.Trigger>

                    <Tabs.Trigger className="shrink-0 px-6" value="Other">
                        Прочее
                    </Tabs.Trigger>
                </Tabs.List>
            </div>
            <Box pt="3">
                <Tabs.Content value="All">
                   <div className="p-[10px] items-center justify-center flex">
                        <Grid rows="5" columns="5" gap="3">
                            {Array.from({ length: 25 }).map((_, index) => (
                                <div
                                    key={index}
                                    className="border-[#898888] border h-[40px] w-[40px]"
                                />
                            ))}
                        </Grid>
                   </div>
                </Tabs.Content>
                <Tabs.Content value="Arming">
                    <div className="p-[10px] items-center justify-center flex">
                        <Grid rows="5" columns="5" gap="3">
                            {Array.from({ length: 25 }).map((_, index) => (
                                <div
                                    key={index}
                                    className="border-[#898888] border h-[40px] w-[40px]"
                                />
                            ))}
                        </Grid>
                   </div>
                </Tabs.Content>
                <Tabs.Content value="Armor">
                    <div className="p-[10px] items-center justify-center flex">
                        <Grid rows="5" columns="5" gap="3">
                            {Array.from({ length: 25 }).map((_, index) => (
                                <div
                                    key={index}
                                    className="border-[#898888] border h-[40px] w-[40px]"
                                />
                            ))}
                        </Grid>
                   </div>
                </Tabs.Content>
                <Tabs.Content value="Potions">
                     <div className="p-[10px] items-center justify-center flex">
                        <Grid rows="5" columns="5" gap="3">
                            {Array.from({ length: 25 }).map((_, index) => (
                                <div
                                    key={index}
                                    className="border-[#898888] border h-[40px] w-[40px]"
                                />
                            ))}
                        </Grid>
                   </div>
                </Tabs.Content>
                <Tabs.Content value="Other">
                     <div className="p-[10px] items-center justify-center flex">
                        <Grid rows="5" columns="5" gap="3">
                            {Array.from({ length: 25 }).map((_, index) => (
                                <div
                                    key={index}
                                    className="border-[#898888] border h-[40px] w-[40px]"
                                />
                            ))}
                        </Grid>
                   </div>
                </Tabs.Content>
            </Box>
            </Tabs.Root>
        </div>
    )
}