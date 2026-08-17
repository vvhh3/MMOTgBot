import { Tabs,Text,Box, Grid, Card,Progress, Flex} from "@radix-ui/themes"
export default function Tasks(){
    return(
        <div className=' h-full ' >
            <Tabs.Root defaultValue="active" className="flex flex-col items-center">
            <Tabs.List color="orange" size="2" className="flex w-full max-w-[600px] justify-center">
                <Tabs.Trigger className="w-1/2" value="active">Активные</Tabs.Trigger>
                <Tabs.Trigger className="w-1/2" value="unfinished">Незавершенные</Tabs.Trigger>
            </Tabs.List>
                <Box pt="3">
                    <Tabs.Content value="active">
                        <Grid columns="1" rows="1" gap='3' style={{padding:"20px",paddingTop:"0px",display:"flex",flexDirection:"column",}}>
                            <Card  >
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex flex-row justify-between" >
                                        <Text as="div" size="3" weight="bold">
                                            Тайна Жигулёвского завода
                                        </Text>
                                        <div className="pl-1 pr-1 bg-[#E8603C] text-[#ffff] h-[21px] w-[80px] text-[10px] flex justify-center items-center font-extrabold rounded-[10px]">
                                            <p>+50 монет</p>
                                        </div>
                                    </div>
                                     <Text as="div" color="gray" size="2">
                                        Расспросить пивовара у старого причала о секретном подвале.
                                    </Text>
                                    <div className="flex flex-row justify-between">
                                        <Text as="div" color="gray" size="1">
                                            Прогресс:
                                        </Text>
                                        <p className="text-[#E8603C]">3/5</p>
                                    </div>
                                    <Box>
                                        <Progress color='orange' value={50}/>
                                    </Box>
                                </div>
                            </Card>
                            <Card >
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex flex-row justify-between" >
                                        <Text as="div" size="3" weight="bold">
                                            Прогулка по набережной
                                        </Text>
                                        <div className="pl-1 pr-1 bg-[#E8603C] text-[#ffff] h-[21px] w-[80px] text-[10px] flex justify-center items-center font-extrabold rounded-[10px]">
                                            <p>+50 опыта</p>
                                        </div>
                                    </div>
                                     <Text as="div" color="gray" size="2">
                                        Найти потерянную карту глубин у памятника Ладья.
                                    </Text>
                                    <div className="flex flex-row justify-between">
                                        <Text as="div" color="gray" size="1">
                                            Прогресс:
                                        </Text>
                                        <p className="text-[#E8603C]">3/10</p>
                                    </div>
                                    <Box>
                                        <Progress color='orange' value={30}/>
                                    </Box>
                                </div>
                            </Card>
                            <Card style={{width:"100%"}}>
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex flex-row justify-between" >
                                        <Text as="div" size="3" weight="bold">
                                            Найти бункер
                                        </Text>
                                        <div className="pl-1 pr-1 bg-[#E8603C] text-[#ffff] h-[21px] w-[80px] text-[10px] flex justify-center items-center font-extrabold rounded-[10px]">
                                            <p>меч</p>
                                        </div>
                                    </div>
                                     <Text as="div" color="gray" size="2">
                                        Отыскать гермодверь в заброшенных штольнях.
                                    </Text>
                                    <div className="flex flex-row justify-between">
                                        <Text as="div" color="gray" size="1">
                                            Прогресс:
                                        </Text>
                                        <p className="text-[#E8603C]">676/1000</p>
                                    </div>
                                    <Box>
                                        <Progress color='orange' value={70}/>
                                    </Box>
                                </div>
                            </Card>
                        </Grid>
                    </Tabs.Content>

                    <Tabs.Content value="unfinished">
                        <Grid columns="1" rows="1" gap='3' style={{padding:"20px",paddingTop:"0px",display:"flex",flexDirection:"column",}}>
                            <Card  >
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex flex-row justify-between" >
                                        <Text as="div" size="3" weight="bold">
                                            Тайна Жигулёвского завода
                                        </Text>
                                        <div className="pl-1 pr-1 bg-[#E8603C] text-[#ffff] h-[21px] w-[80px] text-[10px] flex justify-center items-center font-extrabold rounded-[10px]">
                                            <p>+50 монет</p>
                                        </div>
                                    </div>
                                     <Text as="div" color="gray" size="2">
                                        Расспросить пивовара у старого причала о секретном подвале.
                                    </Text>
                                    <div className="flex flex-row justify-between">
                                        <Text as="div" color="gray" size="1">
                                            Прогресс:
                                        </Text>
                                        <p className="text-[#E8603C]">5/5</p>
                                    </div>
                                    <Box>
                                        <Progress color='orange' value={100}/>
                                    </Box>
                                </div>
                            </Card>
                            <Card >
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex flex-row justify-between" >
                                        <Text as="div" size="3" weight="bold">
                                            Прогулка по набережной
                                        </Text>
                                        <div className="pl-1 pr-1 bg-[#E8603C] text-[#ffff] h-[21px] w-[80px] text-[10px] flex justify-center items-center font-extrabold rounded-[10px]">
                                            <p>+50 опыта</p>
                                        </div>
                                    </div>
                                     <Text as="div" color="gray" size="2">
                                        Найти потерянную карту глубин у памятника Ладья.
                                    </Text>
                                    <div className="flex flex-row justify-between">
                                        <Text as="div" color="gray" size="1">
                                            Прогресс:
                                        </Text>
                                        <p className="text-[#E8603C]">10/10</p>
                                    </div>
                                    <Box>
                                        <Progress color='orange' value={100}/>
                                    </Box>
                                </div>
                            </Card>
                            <Card style={{width:"100%"}}>
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex flex-row justify-between" >
                                        <Text as="div" size="3" weight="bold">
                                            Найти бункер
                                        </Text>
                                        <div className="pl-1 pr-1 bg-[#E8603C] text-[#ffff] h-[21px] w-[80px] text-[10px] flex justify-center items-center font-extrabold rounded-[10px]">
                                            <p>меч</p>
                                        </div>
                                    </div>
                                     <Text as="div" color="gray" size="2">
                                        Отыскать гермодверь в заброшенных штольнях.
                                    </Text>
                                    <div className="flex flex-row justify-between">
                                        <Text as="div" color="gray" size="1">
                                            Прогресс:
                                        </Text>
                                        <p className="text-[#E8603C]">1000/1000</p>
                                    </div>
                                    <Box>
                                        <Progress color='orange' value={100}/>
                                    </Box>
                                </div>
                            </Card>
                        </Grid>
                    </Tabs.Content>

                </Box>
            </Tabs.Root>
        </div>
    )
}