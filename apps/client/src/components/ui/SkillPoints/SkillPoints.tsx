import { Card, Grid } from "@radix-ui/themes"

type SkillPointsProps={
    showIsModal:boolean
}
export default function SkillPoints({showIsModal}:SkillPointsProps){

    return(
        <>
            {showIsModal &&
            <div className="flex h-full w-full justify-center absolute items-center p-[50px] z-[100] mt-2 ">
                <Card className="w-[50%] h-[50%]" >
                    <div className="flex flex-col">
                        <div className="flex flex-row">
                            <div className="flex flex-row">   
                                <svg height="20px" width="20px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" version="1.1" fill="none" stroke="#E85D2F" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="m2.75 9.25 1.5 2.5 2 1.5m-4.5 0 1 1m1.5-2.5-1.5 1.5m3-1 8.5-8.5v-2h-2l-8.5 8.5"></path> <path d="m10.25 12.25-2.25-2.25m2-2 2.25 2.25m1-1-1.5 2.5-2 1.5m4.5 0-1 1m-1.5-2.5 1.5 1.5m-7.25-5.25-4.25-4.25v-2h2l4.25 4.25"></path> </g></svg>
                                <p>ATK</p>
                            </div>
                            <div className="flex flex-row">
                                <button className="flex justify-center items-center h-[30px] border w-[30px] text-2xl text-[#ffff] bg-[#E8603C]">
                                    -
                                </button>
                                <p>0</p>
                                <button className="h-[10px] w-[10px ]bg-[#E8603C]]">
                                    +
                                </button>
                            </div>
                        </div>
                        <div>
                            <svg height="20px" width="20px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M18.5 9.00002H16.5M16.5 9.00002L14.5 9.00002M16.5 9.00002L16.5 7M16.5 9.00002L16.5 11" stroke="#E8603C" stroke-width="1.5" stroke-linecap="round"></path> <path d="M8.96173 19.3786L9.43432 18.7963L8.96173 19.3786ZM12 5.57412L11.4522 6.08635C11.594 6.23803 11.7923 6.32412 12 6.32412C12.2077 6.32412 12.406 6.23803 12.5478 6.08635L12 5.57412ZM15.0383 19.3787L15.5109 19.961L15.0383 19.3787ZM12 21L12 20.25L12 21ZM2.65159 13.6821C2.86595 14.0366 3.32705 14.1501 3.68148 13.9358C4.03591 13.7214 4.14946 13.2603 3.9351 12.9059L2.65159 13.6821ZM6.53733 16.1707C6.24836 15.8739 5.77352 15.8676 5.47676 16.1566C5.18 16.4455 5.17369 16.9204 5.46267 17.2171L6.53733 16.1707ZM2.75 9.3175C2.75 6.41289 4.01766 4.61731 5.58602 4.00319C7.15092 3.39043 9.34039 3.82778 11.4522 6.08635L12.5478 5.06189C10.1598 2.50784 7.34924 1.70187 5.0391 2.60645C2.73242 3.50967 1.25 5.99209 1.25 9.3175H2.75ZM15.5109 19.961C17.0033 18.7499 18.7914 17.1268 20.2127 15.314C21.6196 13.5196 22.75 11.4354 22.75 9.31747H21.25C21.25 10.9289 20.3707 12.6814 19.0323 14.3884C17.7084 16.077 16.0156 17.6197 14.5657 18.7963L15.5109 19.961ZM22.75 9.31747C22.75 5.99208 21.2676 3.50966 18.9609 2.60645C16.6508 1.70187 13.8402 2.50784 11.4522 5.06189L12.5478 6.08635C14.6596 3.82778 16.8491 3.39042 18.414 4.00319C19.9823 4.6173 21.25 6.41287 21.25 9.31747H22.75ZM8.48914 19.961C9.76058 20.9928 10.6423 21.75 12 21.75L12 20.25C11.2771 20.25 10.8269 19.9263 9.43432 18.7963L8.48914 19.961ZM14.5657 18.7963C13.1731 19.9263 12.7229 20.25 12 20.25L12 21.75C13.3577 21.75 14.2394 20.9928 15.5109 19.961L14.5657 18.7963ZM3.9351 12.9059C3.18811 11.6708 2.75 10.455 2.75 9.3175H1.25C1.25 10.8297 1.82646 12.3179 2.65159 13.6821L3.9351 12.9059ZM9.43432 18.7963C8.51731 18.0521 7.49893 17.1582 6.53733 16.1707L5.46267 17.2171C6.47548 18.2572 7.53996 19.1908 8.48914 19.961L9.43432 18.7963Z" fill="#E8603C"></path> </g></svg>
                            <p>HP</p>
                        </div>
                         <div>
                            <svg height="20px" width="20px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M11.302 21.6149C11.5234 21.744 11.6341 21.8086 11.7903 21.8421C11.9116 21.8681 12.0884 21.8681 12.2097 21.8421C12.3659 21.8086 12.4766 21.744 12.698 21.6149C14.646 20.4784 20 16.9084 20 12V6.6C20 6.04207 20 5.7631 19.8926 5.55048C19.7974 5.36198 19.6487 5.21152 19.4613 5.11409C19.25 5.00419 18.9663 5.00084 18.3988 4.99413C15.4272 4.95899 13.7136 4.71361 12 3C10.2864 4.71361 8.57279 4.95899 5.6012 4.99413C5.03373 5.00084 4.74999 5.00419 4.53865 5.11409C4.35129 5.21152 4.20259 5.36198 4.10739 5.55048C4 5.7631 4 6.04207 4 6.6V12C4 16.9084 9.35396 20.4784 11.302 21.6149Z" stroke="#E8603C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>                                            
                            <p>DEF</p>
                        </div>
                    </div>
                </Card>
            </div>
            }

        </>
    )
}