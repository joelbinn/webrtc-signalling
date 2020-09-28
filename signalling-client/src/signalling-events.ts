import { UUID } from "./uuid";

export type DataChannelStatus = "READY" | "NOT_READY";

export interface ConnectedEvent {
  event: "connected";
  uuid: string;
}

export interface ClosedEvent {
  event: "closed";
}

export interface SetPeerInfoEvent {
  event: "set_peer_info";
  uuid: string;
  name: string;
}

export interface PeerAddedEvent {
  event: "peer_added";
  name: string;
  uuid: string;
}

export interface PeerRemovedEvent {
  event: "peer_removed";
  name: string;
  uuid: string;
}

export interface PeerSignal {
  event: "PeerSignal";
  peerEvent: PeerEvent;
}

export interface RTCAnswerEvent {
  event: "rtc_answer";
  fromPeerUUID: string;
  toPeerUUID: string;
  description: RTCSessionDescriptionInit;
}

export interface RTCOfferEvent {
  event: "rtc_offer";
  fromPeerUUID: string;
  toPeerUUID: string;
  description: RTCSessionDescriptionInit;
}

export interface NewIceCandidate {
  event: "new_ice_candidate";
  fromPeerUUID: string;
  toPeerUUID: string;
  candidate: RTCIceCandidate;
}

export type SignallingEvent =
  | ConnectedEvent
  | ClosedEvent
  | SetPeerInfoEvent
  | PeerAddedEvent
  | PeerRemovedEvent
  | RTCAnswerEvent
  | RTCOfferEvent
  | NewIceCandidate
  | PeerSignal;

export interface RtcSignal {
  name: "IceConnected";
  peer: UUID;
}

export interface DataChannelStatusChange {
  name: "DataChannelStatusChange";
  peer: UUID;
  status: DataChannelStatus;
}

export function iceConnected(peer: UUID): RtcSignal {
  return { name: "IceConnected", peer };
}

export function dataChannelStatusChange(peer: UUID, status: DataChannelStatus): DataChannelStatusChange {
  return { name: "DataChannelStatusChange", peer, status };
}

export interface ReceivedDataMessage {
  name: "ReceivedDataMessage";
  peer: UUID;
  text: string;
}

export function receivedDataMessage(peer: UUID, text: string): ReceivedDataMessage {
  return { name: "ReceivedDataMessage", peer, text };
}

export type PeerEvent = RtcSignal | DataChannelStatusChange | ReceivedDataMessage;
