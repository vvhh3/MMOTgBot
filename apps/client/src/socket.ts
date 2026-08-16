import {io, type Socket} from "socket.io-client"

let socket: Socket| null = null
let socketToken: string|null = null

export function connectSocket(token: string): Socket{
   
    if(socket && socketToken === token){
        return socket
    }
    socketToken = token
    
    if(socket){
        socket.auth = {token}
        socket.disconnect()
        socket.connect()
        return socket
    }
    
    socket = io(import.meta.env.VITE_API_BASE_URL ?? "", {
        auth: {token}
    })
    return socket
}

export function getSocket(): Socket| null{
    return socket
}