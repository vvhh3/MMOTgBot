import { Flex, Card,Text, Button,Box,Progress,Inset,Strong, Grid} from "@radix-ui/themes";
import player from '../public/playerM.svg'
import player2 from '../public/playerG.svg'
import fon from "../public/Home.svg"
export default function Home(){
    return(
        <div className="flex flex-col justify-center items-center ">
            <div className="flex flex-col justify-center items-center w-full h-full object-contain bg-bottom border-b-2" 
            style={{backgroundImage:`url(${fon})`}}>
                 <div className="bg-[#00000074] rounded-[16px] pr-[10px] pl-[10px] m-[3px]">
                    <header className="text-[#E85D2F] font-[800px]">Площадь</header>
                 </div>
            <Grid columns="3" rows="1" >
                <div className='flex flex-col justify-center items-center '>
                    <button className="flex justify-center items-center rounded-4xl h-4 w-4 bg-[#E85D2F] text-amber-50 " >+</button>
                </div>
                <div className='flex flex-col justify-center items-center pr-[5px] pl-[5px]'>
                    <div className="bg-[#00000074] rounded-[16px] pr-[10px] pl-[10px] m-[3px]"> 
                        <p className='font-medium text-[#ffffff65]  '>Mirbll</p>
                    </div>
                    <Box width="100%" maxWidth="120px" height="9px" >
                        <Progress style={{background:"white"}} size="1" color='green' value={10}/>
                    </Box>
                    <img className='h-[150px] min-w-[140px]' src={player} />
                </div>
                <div className='flex flex-col justify-center items-center '>
                    <button className="flex justify-center items-center rounded-4xl h-4 w-4 bg-[#E85D2F] text-amber-50 " >+</button>
                </div>
                {/* <div className='flex flex-col justify-center items-center pr-[5px] pl-[5px]'>
                     <div className="bg-[#00000074] rounded-[16px] pr-[10px] pl-[10px] m-[3px]"> 
                        <p className='font-medium text-[#ffffff65]  '>Xz</p>
                    </div>
                    <Box width="100%" maxWidth="120px" height="9px" >
                        <Progress style={{background:"white"}} size="1" color='green' value={69}/>
                    </Box>
                    <img className='h-[150px] min-w-[140px]' src={player2} />
                </div> */}
            </Grid>
            </div>
            <Grid columns="2" rows="2" maxWidth="700px" gap="2" style={{padding:"20px"}}>
                <Card >
                    <div className="flex flex-row justify-between">
                        <div className="max-w-[240px]">
                            <Text as="div" size="2" weight="bold">
                                <div className="flex-row flex gap-2">
                                    Сражение
                                    <svg height="20px" width="20px"fill="#E85D2F" viewBox="0 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg" stroke="#E85D2F"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <title>spinning-sword</title> <path d="M28.396 24.92c4.349-5.985 3.826-14.41-1.571-19.807-5.507-5.507-14.165-5.94-20.168-1.302-0.869-1.018-1.71-2.033-2.463-2.995l-3.227 3.227c0.962 0.745 1.983 1.57 3.008 2.423-4.743 6.008-4.343 14.748 1.203 20.293 5.379 5.379 13.765 5.917 19.746 1.615l1.274 1.274 4.826 1.202-1.362-4.665-1.266-1.266zM20.631 17.154l-7.288-7.288 2.729-2.729-1.99-1.99c5.647-0.282 10.325 6.479 6.549 12.006zM13.949 5.155l-3.241 3.242c-0.394-0.436-0.802-0.889-1.219-1.355 1.461-1.204 2.991-1.784 4.461-1.886zM7.315 9.315c0.453 0.395 0.894 0.784 1.317 1.159l-3.367 3.368 2.052 2.052 2.563-2.564 14.952 14.952c-11.952 8.045-27.183-6.773-17.517-18.967z"></path> </g></svg>                                </div>
                            </Text>
                            <Text as="div" color="gray" size="1">
                                Сражение с игроками на локации
                            </Text>
                        </div>   
                    </div>
                </Card>
                <Card >
                    <div className="flex flex-row  justify-between">
                        <div className="max-w-[240px]">
                            <Text as="div" size="2" weight="bold">
                                <div className="flex-row flex gap-2">
                                    Пройтись
                                    <svg height="20px" width="20px" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" viewBox="0 0 103.784 103.784" xmlSpace="preserve" fill="#000000"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"><g><g><g><path style={{fill:"#E85D2F"}} d="M70.149,11.357c1.7-2.809,3.514-4.13,4.785-4.198c1.575,0,3.461,1.031,5.232,2.745c2.527-0.741,4.982-1.564,7.283-2.552c-3.783-4.889-8.539-7.609-13.167-7.333c-5.279,0.315-9.967,5.468-12.709,12.834c2.802-0.089,5.519-0.365,8.188-0.734C69.895,11.876,70.006,11.59,70.149,11.357z"></path><path style={{fill:"#E85D2F"}} d="M86.068,20.497c2.308-0.927,4.52-1.947,6.578-3.089c-0.963-2.949-2.212-5.565-3.654-7.845c-2.197,0.97-4.513,1.822-6.907,2.577C83.634,14.252,85.041,17.065,86.068,20.497z"></path><path style={{fill:"#E85D2F"}} d="M68.406,15.061c-2.527,0.297-5.107,0.476-7.745,0.53C59.788,18.654,59.23,22,59.09,25.49c2.448,0,4.842-0.147,7.201-0.365C66.506,21.424,67.282,17.992,68.406,15.061z"></path><path style={{fill:"#E85D2F"}} d="M87.635,30.561c2.466-1.07,4.803-2.262,6.957-3.586c-0.233-2.444-0.626-4.771-1.181-6.95c-2.097,1.138-4.338,2.158-6.671,3.078C87.234,25.382,87.56,27.863,87.635,30.561z"></path><path style={{fill:"#E85D2F"}} d="M66.277,27.834c-2.355,0.211-4.746,0.354-7.183,0.354c0.054,2.641,0.34,5.325,0.898,8.013c2.477-0.029,4.896-0.211,7.276-0.458C66.638,33.091,66.312,30.436,66.277,27.834z"></path><path style={{fill:"#E85D2F"}} d="M87.607,33.499c-0.072,1.861-0.218,3.779-0.537,5.798c-0.132,0.837-0.297,1.603-0.444,2.419c2.788-1.149,5.418-2.444,7.827-3.908c0.301-2.706,0.404-5.311,0.319-7.813C92.531,31.291,90.133,32.458,87.607,33.499z"></path><path style={{fill:"#E85D2F"}} d="M71.054,46.004c-0.551-1.374-1.152-2.792-1.836-4.313c-0.49-1.088-0.866-2.201-1.231-3.318c-2.398,0.265-4.835,0.458-7.326,0.508c0.54,1.936,1.181,3.865,2.029,5.748c0.351,0.773,0.648,1.471,0.956,2.183C66.176,46.669,68.642,46.38,71.054,46.004z"></path><path style={{fill:"#E85D2F"}} d="M86.046,44.851c-0.129,0.673-0.243,1.389-0.376,2.051c-1.367,6.95-2.781,14.136-2.201,22.704c0.326,4.771-0.662,8.879-2.634,10.994c-0.691,0.737-1.911,1.718-4.542,1.718h-0.018c-1.99-0.004-3.783-0.956-4.917-2.613c-1.546-2.258-1.653-5.422-0.308-8.904c3.59-9.287,3.396-15.189,0.977-22.196c-2.38,0.39-4.81,0.691-7.297,0.862c2.419,6.245,2.763,10.669-0.358,18.753c-4.602,11.914,2.752,21.24,11.889,21.255c10.84,0.018,15.06-9.874,14.348-20.353c-0.691-10.207,1.797-18.259,3.393-27.933C91.533,42.564,88.856,43.778,86.046,44.851z"></path><path style={{fill:"#E85D2F"}} d="M28.867,21.474c1.27,0.068,3.089,1.389,4.785,4.198c0.143,0.233,0.254,0.523,0.39,0.769c2.659,0.369,5.368,0.641,8.163,0.73c-2.741-7.365-7.43-12.519-12.709-12.834c-4.627-0.276-9.387,2.444-13.167,7.333c2.305,0.988,4.767,1.814,7.301,2.555C25.403,22.509,27.289,21.474,28.867,21.474z"></path><path style={{fill:"#E85D2F"}} d="M21.713,26.46c-2.401-0.759-4.724-1.607-6.925-2.584c-1.442,2.28-2.691,4.899-3.654,7.845c2.065,1.145,4.28,2.169,6.596,3.096C18.757,31.388,20.163,28.575,21.713,26.46z"></path><path style={{fill:"#E85D2F"}} d="M35.395,29.38c1.124,2.928,1.9,6.36,2.112,10.064c2.351,0.218,4.738,0.361,7.179,0.365c-0.143-3.493-0.698-6.836-1.571-9.899C40.487,29.856,37.911,29.677,35.395,29.38z"></path><path style={{fill:"#E85D2F"}} d="M17.06,37.425c-2.337-0.923-4.585-1.943-6.689-3.085c-0.555,2.18-0.948,4.506-1.181,6.95c2.162,1.328,4.502,2.523,6.979,3.593C16.241,42.189,16.563,39.705,17.06,37.425z"></path><path style={{fill:"#E85D2F"}} d="M36.529,50.062c2.376,0.247,4.785,0.426,7.254,0.455c0.562-2.688,0.848-5.372,0.898-8.013c-2.434,0-4.814-0.143-7.161-0.354C37.488,44.755,37.163,47.41,36.529,50.062z"></path><path style={{fill:"#E85D2F"}} d="M16.731,53.612c-0.319-2.015-0.465-3.93-0.537-5.791c-2.534-1.041-4.939-2.212-7.183-3.511c-0.082,2.498,0.018,5.103,0.319,7.813c2.412,1.467,5.053,2.766,7.848,3.915C17.032,55.223,16.863,54.453,16.731,53.612z"></path><path style={{fill:"#E85D2F"}} d="M34.582,56.007c-0.684,1.521-1.285,2.938-1.836,4.316c2.405,0.372,4.864,0.662,7.387,0.809c0.308-0.712,0.605-1.41,0.956-2.183c0.848-1.882,1.489-3.811,2.029-5.748c-2.484-0.05-4.914-0.243-7.308-0.508C35.448,53.809,35.073,54.922,34.582,56.007z"></path><path style={{fill:"#E85D2F"}} d="M39.049,63.78c-2.48-0.172-4.903-0.472-7.276-0.863c-2.419,7.007-2.609,12.905,0.977,22.192c1.346,3.486,1.235,6.646-0.308,8.904c-1.134,1.657-2.928,2.609-4.917,2.613h-0.018c-2.63,0-3.851-0.981-4.542-1.718c-1.976-2.112-2.96-6.224-2.634-10.994c0.58-8.568-0.834-15.754-2.201-22.704c-0.129-0.659-0.243-1.371-0.372-2.04c-2.817-1.074-5.501-2.29-7.981-3.672c1.596,9.674,4.087,17.726,3.393,27.933c-0.712,10.479,3.507,20.371,14.348,20.353c9.137-0.014,16.491-9.341,11.889-21.255C36.282,74.448,36.626,70.025,39.049,63.78z"></path></g></g></g></g></svg>
                                </div>
                            </Text>
                            <Text as="div" color="gray" size="1">
                                Пройтись по локации
                            </Text>
                        </div>   
                    </div>
                </Card>
                <Card >
                    <div className="flex flex-row justify-between">
                        <div className="max-w-[240px]">
                            <Text as="div" size="2" weight="bold">
                                <div className="flex-row flex gap-2">
                                    Чат локации
                                <svg height="20px" width="20px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M8 10.5H16" stroke="#E85D2F" stroke-width="1.5" stroke-linecap="round"></path> <path d="M8 14H13.5" stroke="#E85D2F" stroke-width="1.5" stroke-linecap="round"></path> <path d="M17 3.33782C15.5291 2.48697 13.8214 2 12 2C6.47715 2 2 6.47715 2 12C2 13.5997 2.37562 15.1116 3.04346 16.4525C3.22094 16.8088 3.28001 17.2161 3.17712 17.6006L2.58151 19.8267C2.32295 20.793 3.20701 21.677 4.17335 21.4185L6.39939 20.8229C6.78393 20.72 7.19121 20.7791 7.54753 20.9565C8.88837 21.6244 10.4003 22 12 22C17.5228 22 22 17.5228 22 12C22 10.1786 21.513 8.47087 20.6622 7" stroke="#E85D2F" stroke-width="1.5" stroke-linecap="round"></path> </g></svg>
                                </div>
                            </Text>
                            <Text as="div" color="gray" size="1">
                                 Можете обсудить с игроками,что происходит на локации
                            </Text>
                        </div>   
                    </div>
                </Card>
                <Card >
                    <div className="flex flex-row justify-between">
                        <div className="max-w-[240px]">
                            <Text as="div" size="2" weight="bold">
                               <div className="flex-row flex gap-2">
                                    Торговля
                                <svg height="20px" width="20px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M19.9381 13C19.979 12.6724 20 12.3387 20 12C20 7.58172 16.4183 4 12 4C9.49942 4 7.26681 5.14727 5.7998 6.94416M4.06189 11C4.02104 11.3276 4 11.6613 4 12C4 16.4183 7.58172 20 12 20C14.3894 20 16.5341 18.9525 18 17.2916M15 17H18V17.2916M5.7998 4V6.94416M5.7998 6.94416V6.99993L8.7998 7M18 20V17.2916" stroke="#E85D2F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>
                                </div>
                            </Text>
                            <Text as="div" color="gray" size="1">
                                 Можете обменяться/поторгаваться с другими игроками на локации
                            </Text>
                        </div>   
                    </div>
                </Card>
            </Grid>
        </div>
    )
}