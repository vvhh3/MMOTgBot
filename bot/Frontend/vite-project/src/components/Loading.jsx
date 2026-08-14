import {Progress,Box} from "@radix-ui/themes";
import Spinner  from "./ui/Spinner/Spinner.jsx";
export default function Loading()
{
    return(
        <div className="min-h-screen flex justify-center items-center ">
            <div className="flex flex-col w-200 justify-center items-center h-100">
                <div>
                    <Spinner></Spinner>
                    <div className="flex flex-col items-center">
                        <p className="font-bold">Подготовка входа</p>
                        <p className="font-thin">Инициализация...</p>    
                    </div>
                </div>
                <div className="h-5 flex items-center flex-col"> 
                    <Box  width="200px">
                        <Progress color="orange" size="3" />
                    </Box>
                    <p className="text-orange-500">67 %</p>
                </div>
            </div>
        </div>

    )
}
