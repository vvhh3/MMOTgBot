import { Progress, Box } from "@radix-ui/themes";
import Spinner from "./ui/Spinner/Spinner";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
export default function Loading() {
    const [percentProgress, setPercentProgress] = useState<number>(0);
    const navigate = useNavigate();
    useEffect(() => {
        const duration = 6000;
        const interval = 50;
        const step = 100 / (duration / interval);
        const timer = setInterval(() => {
            setPercentProgress(prev => {
                const next = prev + step;
                return Math.round(next >= 100 ? 100 : next);
            });
            if (percentProgress == 100) {
                navigate("/")
            }
        }, interval);

        return () => clearInterval(timer);
    }, [])
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
