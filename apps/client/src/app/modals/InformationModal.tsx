import CenterModal from "../../shared/ui/modal/CenterModal";
type ModalInformationProps={
    infoMessages:{
        title:string;
        info:string;
    }
    setShowModal: (value: boolean) => void;

}
export default function InformationModal({infoMessages,setShowModal}:ModalInformationProps){
    return(
        <CenterModal title={infoMessages.title} onClose={()=>setShowModal(false)}>
            <div>
                <p>{infoMessages.info}</p>
            </div>
        </CenterModal>
    )
}
