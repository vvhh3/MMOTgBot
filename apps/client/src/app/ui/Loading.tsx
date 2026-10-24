import { Box,Progress } from "@radix-ui/themes";
import Spinner from "../../shared/ui/spinner/Spinner";

type LoadingProps = {
    progress?: number;
    error?: string | null;
    onRetry?: () => void;
};

export default function Loading({ progress = 0, error, onRetry }: LoadingProps) {
    const percentProgress = Math.max(0, Math.min(100, Math.round(progress)));
    return (
        <div className="min-h-screen flex justify-center items-center ">
            <div className="flex flex-col w-200 justify-center items-center h-100">
                <div>
                    {!error && <Spinner />}
                    <div className="flex flex-col items-center">
                        <p className="font-bold">{error ? "Не удалось загрузить игру" : "Подготовка входа"}</p>
                        {error ? (
                            <>
                                <p role="alert" className="max-w-sm px-4 text-center text-red-500">{error}</p>
                                <button type="button" onClick={onRetry} className="mt-4 rounded-lg bg-[#E8603C] px-5 py-2 text-white">
                                    Повторить загрузку
                                </button>
                            </>
                        ) : <p className="font-thin">Инициализация...</p>}
                    </div>
                </div>
                {!error && <div className="h-5 flex items-center flex-col mt-3" >
                    <Box width="200px">
                        <Progress value={percentProgress} color="orange" size="3" />
                    </Box>
                    <p className="text-orange-500">{percentProgress} %</p>
                </div>}
            </div>
        </div>

    )
}
