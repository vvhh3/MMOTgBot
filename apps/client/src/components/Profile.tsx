import player from '../public/playerM.png'
import map from '../components/ui/Maps/mapMat.png'
import { useState, useRef } from "react";
import { Flex, Card,Text, Button,Box,Progress,Inset,Strong} from "@radix-ui/themes";
export default function Profile(){
    
    return(
        <div className='flex flex-col items-center h-full'>
            <div className='flex flex-col justify-center items-center '>
                <p className='font-bold'>Mirbll</p>
                <img className='h-[200px]' src={player} />
            </div>
            <div className='p-0.5'>
            <Flex direction="row" gap="3">
                <button>
                <Card variant="surface" >
                    <Text as="div" size="2" weight="bold">
                        Здоровье
                    </Text>
                    <Box maxWidth="300px">
                        <Progress color='green' value={100}/>
                    </Box>
                    <Text as="div" color="gray" size="2">
                        100/100
                    </Text>
                    <Text as="div" color="gray" size="1">
                        Нажми чтоб восстановить здоровье
                    </Text>
                </Card>
                </button>

                <Card variant="classic">
                    <Text as="div" size="2" weight="bold">
                        Уровень 4
                    </Text>
                    <Box maxWidth="300px">
                        <Progress color='orange' value={40}/>
                    </Box>
                    <Text as="div" color="gray" size="2">
                        160/400
                    </Text>
                    <Text as="div" color="gray" size="1">
                        Нажми чтоб узнать больше 
                    </Text>
                </Card>
            </Flex>
            </div>
            <Box >
                <Card size="2">
                    <Inset clip="padding-box" side="top" pb="current">
                        <img
                            src={map}
                            alt="Bold typography"
                            style={{
                                display: "block",
                                objectFit: "cover",
                                width: "100%",
                                height: 140,
                                backgroundColor: "var(--gray-5)",
                                objectPosition:"40% 31%",
                                transformOrigin: `${31}% ${40}%`,
                                transform: "scale(6)",
                                
                            }}
                        />
                        </Inset>
                            <Text as="div" size="2" weight="bold">
                                Площадь
                            </Text>
                            <Text as="div" color="gray" size="1">
                                Нажми чтоб посмотреть карту
                            </Text>
                         </Card>
                </Box>
        </div>
    )
}