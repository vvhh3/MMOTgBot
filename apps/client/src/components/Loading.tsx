import { Progress, Box } from "@radix-ui/themes";
import Spinner from "./ui/Spinner/Spinner";

type LoadingProps = {
    progress?: number;
};

export default function Loading({ progress = 0 }: LoadingProps) {
    const percentProgress = Math.max(0, Math.min(100, Math.round(progress)));
    return (
        <div className="min-h-screen flex justify-center items-center ">
            <div className="flex flex-col w-200 justify-center items-center h-100">
                <div>
                    <Spinner></Spinner>
                    <div className="flex flex-col items-center">
                        <p className="font-bold">Подготовка входа</p>
                        <p className="font-thin">Инициализация...</p>
                    </div>
                </div>
                <div className="h-5 flex items-center flex-col mt-3" >
                    <Box width="200px">
                        <Progress value={percentProgress} color="orange" size="3" />
                    </Box>
                    <p className="text-orange-500">{percentProgress} %</p>
                </div>
            </div>
        </div>

    )
}
