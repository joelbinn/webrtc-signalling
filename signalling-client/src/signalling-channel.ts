import { Observable, ReplaySubject } from "rxjs";
import { PeerProxy } from "./peer-proxy";
import { PeerEvent, SignallingEvent } from "./signalling-events";
import { UUID, uuid } from "./uuid";

export class SignallingChannel {
  uuid?: string;
  isOpen = false;
  private ws?: WebSocket;
  private readonly peerConnections: { [uuid: string]: PeerProxy } = {};
  private readonly eventSubject = new ReplaySubject<SignallingEvent>(1);

  start() {
    if (this.ws) {
      return;
    }
    this.ws = new WebSocket("ws://localhost:9898/");
    this.ws.onopen = () => {
      console.log("WebSocket Client Connected");
      this.isOpen = true;
    };

    this.ws.onclose = () => {
      console.log("WebSocket Client Closed");
      this.uuid = undefined;
      this.isOpen = false;
      this.eventSubject.next({ event: "closed" });
    };

    this.ws.onmessage = async (me: MessageEvent) => {
      const e = JSON.parse(me.data) as SignallingEvent;
      console.log("Received: ", e);
      switch (e.event) {
        // Basic peer handling
        case "connected":
          this.uuid = e.uuid;
          this.eventSubject.next(e);
          break;

        case "peer_added":
          this.eventSubject.next(e);
          break;

        case "peer_removed":
          this.eventSubject.next(e);
          break;

        case "set_peer_info":
          this.eventSubject.next(e);
          break;

        // WebRTC signalling
        case "rtc_answer": {
          const peer = this.peerConnections[e.fromPeerUUID];
          if (!peer) {
            console.log("Peer connection not found for", e.fromPeerUUID);
            break;
          }

          await peer.handleAnswer(e.description);
          break;
        }

        case "rtc_offer": {
          if (!this.uuid) {
            console.log("Have no local UUID");
            break;
          }

          this.peerConnections[e.fromPeerUUID] = await PeerProxy.acceptRemote(
            uuid(this.uuid),
            uuid(e.fromPeerUUID),
            this,
            e.description,
          );
          break;
        }

        case "new_ice_candidate": {
          const peer = this.peerConnections[e.fromPeerUUID];
          if (!peer) {
            console.log("Peer connection not found for", e.fromPeerUUID);
            break;
          }

          await peer.handleIceCandidate(e.candidate);
          break;
        }

        default:
          console.log("Unexpected event from backend", e);
      }
    };
  }

  get events$(): Observable<SignallingEvent> {
    return this.eventSubject.asObservable();
  }

  close() {
    console.log("Close WS for", this.uuid);
    this.ws?.close();
  }

  async setName(name: string) {
    if (this.uuid) {
      this.send({ event: "set_peer_info", uuid: this.uuid, name });
    }
  }

  async connectTo(peerUuid: UUID) {
    if (!this.uuid) {
      console.log("Have no local UUID");
      return;
    }

    if (this.peerConnections[peerUuid.value]) {
      console.log("Already connected to", peerUuid.value);
      return;
    }

    this.peerConnections[peerUuid.value] = await PeerProxy.connectRemote(uuid(this.uuid), peerUuid, this);
  }

  async sendMessage(peerUuid: UUID, msg: string) {
    const peerProxy = this.peerConnections[peerUuid.value];
    peerProxy.sendDataMessage(msg);
  }

  send(message: SignallingEvent) {
    this.ws?.send(JSON.stringify(message));
  }

  onPeerEvent(peerEvent: PeerEvent) {
    this.eventSubject.next({ event: "PeerSignal", peerEvent });
  }
}
