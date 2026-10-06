import CenterModal from "./CenterModal";
type ModalInformationProps={
    infoMessages:{
        title:string;
        info:string;
    }
    setShowModal: (value: boolean) => void;

}
export default function СenterModalInformation({infoMessages,setShowModal}:ModalInformationProps){
    return(
        <CenterModal title={infoMessages.title} onClose={()=>setShowModal(false)}>
            <div>
                <p>{infoMessages.info}</p>
            </div>
        </CenterModal>
    )
}