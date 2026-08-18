import {Avatar, Card, Grid, TextField,Text ,Badge} from "@radix-ui/themes"
export default function Team(){
    return(
        <div className="flex flex-col h-full ">
            <div className="flex justify-center items-center pl-[10px] pr-[10px] gap-1 pt-4">
                <TextField.Root radius="large" placeholder="Искать по нику или коду...." className="flex w-full max-w-[600px]  justify-center">
                    <TextField.Slot>
                        <svg width="16px" height='16px' viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M14.9536 14.9458L21 21M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>
                    </TextField.Slot>
                </TextField.Root>
                <button className="h-[30px] w-[30px] bg-[#E8603C] flex justify-center items-center rounded-[10px]">
                    <svg className="h-[15px] w-[15px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" fill="#fff"><path d="M157.9767 0C103.5064 0 59.0821 44.424 59.0821 98.8945s44.4243 98.8965 98.8946 98.8965 98.8965-44.426 98.8965-98.8965S212.447 0 157.9767 0Zm0 25c40.9592 0 73.8965 32.9349 73.8965 73.8945s-32.9373 73.8964-73.8965 73.8965-73.8946-32.9369-73.8946-73.8965S117.0175 25 157.9767 25Zm42.3808 175v200h200V200h-200Zm-42.3906 13.6328C70.2152 200.6548.0715 279.1693-.3065 374.4492L-.3575 387h176.7148v-25H25.3085c5.9893-77.1106 63.5961-136.3444 132.6582-136.3672h.01c6.2307 0 12.3661.4909 18.3809 1.4258v-25.2461c-6.029-.769-12.1615-1.1788-18.3868-1.1797Zm67.3906 11.3672h150v27.3672l-14.5234-12.2442-74.127 87.9199-49.6953-41.8965-11.6543 13.8223v-74.9687Zm150 36.6797v113.3203h-150v-65.9786l45.2344 38.1348 19.1133 16.1153 16.1152-19.1133 69.5371-82.4785Z"/></svg>                
                </button>
            </div>
            <div className="flex flex-col w-full justify-center items-center">
                <Grid columns="1" rows="1" gap='3' style={{padding:"20px",paddingTop:"10px",display:"flex",flexDirection:"column",alignItems:"center",minWidth:"230px",justifyItems:"center", maxWidth:"800px",width:"100%"}}>
                <Card className="w-full">
                    <div className="flex flex-row  items-center justify-between">
                        <div className="flex flex-row gap-5">
                            <div className="relative inline-block">
                                <Avatar radius="full" fallback="A" color="green" size="2" />
                                <span className="absolute right-0 bottom-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white" />
                            </div>
                            <div className="flex flex-col">
                                <div className="flex flex-row gap-3 ">
                                    <Text size="2">
                                        PLayer 1
                                    </Text>
                                    <Badge color="orange">Lv.4</Badge>
                                </div>
                                <Text size="1">
                                    В сети
                                </Text>
                            </div>
                        </div>
                        <button className="h-[32px] w-[32px] flex justify-center items-center ">
                            <svg className=" w-[20px] h-[20px]"viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M21.0039 12C21.0039 16.9706 16.9745 21 12.0039 21H3.00463C3.00463 21 4.56382 17.2561 3.93982 16.0008C3.34076 14.7956 3.00391 13.4372 3.00391 12C3.00391 7.02944 7.03334 3 12.0039 3M20.1213 3.87868C21.2929 5.05025 21.2929 6.94975 20.1213 8.12132C18.9497 9.29289 17.0503 9.29289 15.8787 8.12132C14.7071 6.94975 14.7071 5.05025 15.8787 3.87868C17.0503 2.70711 18.9497 2.70711 20.1213 3.87868Z" stroke="#E8603C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>
                        </button>
                    </div>
                </Card>
                <Card className="w-full">
                    <div className="flex flex-row  items-center justify-between">
                        <div className="flex flex-row gap-5">
                            <div className="relative inline-block">
                                <Avatar radius="full" fallback="A" color="green" size="2" />
                                <span className="absolute right-0 bottom-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white" />
                            </div>
                            <div className="flex flex-col">
                                <div className="flex flex-row gap-3 ">
                                    <Text size="2">
                                        PLayer 5
                                    </Text>
                                    <Badge color="orange">Lv.4</Badge>
                                </div>
                                <Text size="1">
                                    В сети
                                </Text>
                            </div>
                        </div>
                        <button className="h-[32px] w-[32px] flex justify-center items-center ">
                            <svg className=" w-[20px] h-[20px]"viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M21.0039 12C21.0039 16.9706 16.9745 21 12.0039 21H3.00463C3.00463 21 4.56382 17.2561 3.93982 16.0008C3.34076 14.7956 3.00391 13.4372 3.00391 12C3.00391 7.02944 7.03334 3 12.0039 3M20.1213 3.87868C21.2929 5.05025 21.2929 6.94975 20.1213 8.12132C18.9497 9.29289 17.0503 9.29289 15.8787 8.12132C14.7071 6.94975 14.7071 5.05025 15.8787 3.87868C17.0503 2.70711 18.9497 2.70711 20.1213 3.87868Z" stroke="#E8603C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>
                        </button>
                    </div>
                </Card>
                <Card className="w-full">
                    <div className="flex flex-row  items-center justify-between">
                        <div className="flex flex-row gap-5">
                            <div className="relative inline-block">
                                <Avatar radius="full" fallback="A" color="green" size="2" />
                                <span className="absolute right-0 bottom-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white" />
                            </div>
                            <div className="flex flex-col">
                                <div className="flex flex-row gap-3 ">
                                    <Text size="2">
                                        PLayer 4
                                    </Text>
                                    <Badge color="orange">Lv.4</Badge>
                                </div>
                                <Text size="1">
                                    В сети
                                </Text>
                            </div>
                        </div>
                        <button className="h-[32px] w-[32px] flex justify-center items-center ">
                            <svg className=" w-[20px] h-[20px]"viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M21.0039 12C21.0039 16.9706 16.9745 21 12.0039 21H3.00463C3.00463 21 4.56382 17.2561 3.93982 16.0008C3.34076 14.7956 3.00391 13.4372 3.00391 12C3.00391 7.02944 7.03334 3 12.0039 3M20.1213 3.87868C21.2929 5.05025 21.2929 6.94975 20.1213 8.12132C18.9497 9.29289 17.0503 9.29289 15.8787 8.12132C14.7071 6.94975 14.7071 5.05025 15.8787 3.87868C17.0503 2.70711 18.9497 2.70711 20.1213 3.87868Z" stroke="#E8603C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>
                        </button>
                    </div>
                </Card>
                <Card className="w-full">
                    <div className="flex flex-row  items-center justify-between">
                        <div className="flex flex-row gap-5">
                            <div className="relative inline-block">
                                <Avatar radius="full" fallback="A" color="green" size="2" />
                                <span className="absolute right-0 bottom-0 block h-2.5 w-2.5 rounded-full bg-[gray] ring-2 ring-white" />
                            </div>
                            <div className="flex flex-col">
                                <div className="flex flex-row gap-3 ">
                                    <Text size="2">
                                        PLayer 3
                                    </Text>
                                    <Badge color="orange">Lv.4</Badge>
                                </div>
                                <Text size="1">
                                    Не в сети
                                </Text>
                            </div>
                        </div>
                        <button className="h-[32px] w-[32px] flex justify-center items-center ">
                            <svg className=" w-[20px] h-[20px]"viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M21.0039 12C21.0039 16.9706 16.9745 21 12.0039 21H3.00463C3.00463 21 4.56382 17.2561 3.93982 16.0008C3.34076 14.7956 3.00391 13.4372 3.00391 12C3.00391 7.02944 7.03334 3 12.0039 3M20.1213 3.87868C21.2929 5.05025 21.2929 6.94975 20.1213 8.12132C18.9497 9.29289 17.0503 9.29289 15.8787 8.12132C14.7071 6.94975 14.7071 5.05025 15.8787 3.87868C17.0503 2.70711 18.9497 2.70711 20.1213 3.87868Z" stroke="#E8603C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>
                        </button>
                    </div>
                </Card>
                
            </Grid>
            </div>
        </div>
    )
}