import { Button, Card, Text } from "@radix-ui/themes";

export default function Exchange(){
    return(
        <div className="flex flex-col">
            <div className=" flex flex-row items-center gap-1.5 pl-5 h-7.5 border-b-2">
                <svg height="20px" width="20px" viewBox="0 0 24 24" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" fill="#000000"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"><title>Transfer</title><g id="Page-1" stroke="none" strokeWidth="1" fill="none" fillRule="evenodd"><g id="Transfer"><rect id="Rectangle" fillRule="nonzero" x="0" y="0" width="24" height="24"></rect><path d="M19,7 L5,7 M20,17 L5,17" id="Shape" stroke="#E8603C" strokeWidth="2" strokeLinecap="round"></path><path d="M16,3 L19.2929,6.29289 C19.6834,6.68342 19.6834,7.31658 19.2929,7.70711 L16,11" id="Path" stroke="#E8603C" strokeWidth="2" strokeLinecap="round"></path><path d="M8,13 L4.70711,16.2929 C4.31658,16.6834 4.31658,17.3166 4.70711,17.7071 L8,21" id="Path" stroke="#E8603C" strokeWidth="2" strokeLinecap="round"></path></g></g></g></svg>
                <Text size="2" >Обмен с vvhh</Text>
            </div>
            <div className="flex flex-col p-5">
                <Card>
                    <div className="flex flex-col gap-1">
                        <Text color="red">Вы отдаёте:</Text>
                        <div className="flex flex-row gap-2.5 justify-center ">
                            <Card style={{width:"40%",height:"35px",display:"flex",justifyContent:"center",alignItems:"center"}}>
                                <Text>
                                    +
                                </Text>
                            </Card>
                            <Card style={{width:"40%",height:"35px",display:"flex",justifyContent:"center",alignItems:"center"}}>
                                <Text>
                                    +
                                </Text>
                            </Card>
                        </div>
                    </div>
                </Card>
            </div>
            <div className="flex justify-center">
                <svg height="20px" width="20px" viewBox="0 0 24 24" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" fill="#000000"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"><title>Transfer</title><g id="Page-1" stroke="none" strokeWidth="1" fill="none" fillRule="evenodd"><g id="Transfer"><rect id="Rectangle" fillRule="nonzero" x="0" y="0" width="24" height="24"></rect><path d="M19,7 L5,7 M20,17 L5,17" id="Shape" stroke="#E8603C" strokeWidth="2" strokeLinecap="round"></path><path d="M16,3 L19.2929,6.29289 C19.6834,6.68342 19.6834,7.31658 19.2929,7.70711 L16,11" id="Path" stroke="#E8603C" strokeWidth="2" strokeLinecap="round"></path><path d="M8,13 L4.70711,16.2929 C4.31658,16.6834 4.31658,17.3166 4.70711,17.7071 L8,21" id="Path" stroke="#E8603C" strokeWidth="2" strokeLinecap="round"></path></g></g></g></svg>
            </div>
            <div className="flex flex-col p-5">
                <Card>
                    <div className="flex flex-col gap-1">
                        <Text color="green">Вы получаете:</Text>
                        <div className="flex flex-row gap-2.5 justify-center ">
                            <Card style={{width:"40%",height:"35px",display:"flex",justifyContent:"center",alignItems:"center"}}>
                                <Text>
                                    +
                                </Text>
                            </Card>
                            <Card style={{width:"40%",height:"35px",display:"flex",justifyContent:"center",alignItems:"center"}}>
                                <Text>
                                    +
                                </Text>
                            </Card>
                        </div>
                    </div>
                </Card>
            </div>
            <div className="flex flex-col gap-2.5 p-5 justify-center items-center ">
                <div className="w-[70%] flex flex-col gap-2.5">
                    <Button style={{background:"#E8603C",border:"solid 2px black"}}>Подтвердить обмен</Button>
                    <Button style={{background:"#ffff",color:"#E8603C",border:"solid 2px black"}}>Отклонить</Button>
                </div>
                
            </div>
        </div>
    )
}