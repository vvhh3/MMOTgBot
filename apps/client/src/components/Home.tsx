import { Flex, Card,Text, Button,Box,Progress,Inset,Strong, Grid} from "@radix-ui/themes";
import player from '../public/playerM.png'
import player2 from '../public/playerG.png'
import fon from "../public/Home.jpg"
export default function Home(){
    return(
        <div className="flex flex-col justify-center items-center">
            <div className="flex flex-col justify-center items-center w-full h-full object-contain ">
                <header>Площадь</header>
            <Grid columns="3" rows="1">
                <div className='flex flex-col justify-center items-center '>
                    <button className="flex justify-center items-center rounded-4xl h-4 w-4 bg-[#E85D2F] text-amber-50 " >+</button>
                </div>
                <div className='flex flex-col justify-center items-center '>
                    <p className='font-bold  '>Mirbll</p>
                    <Box width="100%" maxWidth="120px" height="9px" >
                        <Progress size="1" color='green' value={10}/>
                    </Box>
                    <img className='h-[200px]' src={player} />
                </div>
                 <div className='flex flex-col justify-center items-center '>
                    <p className='font-bold'>xz</p>
                    <Box width="100%" maxWidth="120px" height="9px" >
                        <Progress size="1" color='green' value={69}/>
                    </Box>
                    <img className='h-[200px]' src={player2} />
                </div>
            </Grid>
            </div>
        </div>
    )
}