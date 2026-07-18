export interface Transfer {
  code: string
  file_names: string[]
  time_limit: string
  created_at: string
}

export interface Room {
  code: string
  admin_username: string
  time_limit: string
  created_at: string
}

export interface ChatMessage {
  type: 'chat'
  user: string
  username: string
  text: string
}

export interface FileMeta {
  type: 'file-meta'
  fileName: string
  fileType: string
  size: number
  fileId: string
  fromUser: string
  fromUsername: string
}

export interface IncomingFile {
  meta: FileMeta
  chunks: ArrayBuffer[]
  receivedSize: number
}

export interface ReceivedFile {
  name: string
  type: string
  data: Blob
  fileId: string
}

export interface SignalPayload {
  from: string
  to: string
  type: 'offer' | 'answer' | 'candidate'
  sdp?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
}
