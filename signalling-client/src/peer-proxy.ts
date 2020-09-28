import { SignallingChannel } from "./signalling-channel";
import { UUID } from "./uuid";
import { dataChannelStatusChange, iceConnected, receivedDataMessage } from "./signalling-events";

export class PeerProxy {
  private constructor(
    public readonly ownUUID: UUID,
    public readonly remotePeerUUID: UUID,
    private readonly signallingChannel: SignallingChannel,
  ) {}

  private peerConnection?: RTCPeerConnection;
  private msgChannel?: RTCDataChannel;

  static async connectRemote(
    ownUUID: UUID,
    remotePeerUuid: UUID,
    signallingChannel: SignallingChannel,
  ): Promise<PeerProxy> {
    const peerProxy = new PeerProxy(ownUUID, remotePeerUuid, signallingChannel);
    await peerProxy.establishConnection();
    return peerProxy;
  }

  static async acceptRemote(
    ownUUID: UUID,
    remotePeerUUID: UUID,
    signallingChannel: SignallingChannel,
    sessionDescription: RTCSessionDescriptionInit,
  ): Promise<PeerProxy> {
    const peerProxy = new PeerProxy(ownUUID, remotePeerUUID, signallingChannel);
    await peerProxy.handleReceivedOffer(sessionDescription);
    return peerProxy;
  }

  async handleIceCandidate(candidate: RTCIceCandidate) {
    if (this.peerConnection?.iceConnectionState === "connected") {
      console.log("ICE connection is established", this.remotePeerUUID);
      this.signallingChannel.onPeerEvent(iceConnected(this.remotePeerUUID));
      return;
    }
    try {
      await this.peerConnection?.addIceCandidate(candidate);
      this.signallingChannel.onPeerEvent(dataChannelStatusChange(this.remotePeerUUID, "READY"));
    } catch (e) {
      console.log("ICE candidate error", e);
    }
  }

  async handleAnswer(description: RTCSessionDescriptionInit) {
    const remoteDesc = new RTCSessionDescription(description);
    await this.peerConnection?.setRemoteDescription(remoteDesc);
  }

  sendDataMessage(msg: string): void {
    this.msgChannel?.send(msg);
  }

  private async establishConnection() {
    const peerConn = await this.createPeerConnection(true);

    const offer = await peerConn.createOffer({ offerToReceiveAudio: true });
    await peerConn.setLocalDescription(offer);
    this.signallingChannel.send({
      event: "rtc_offer",
      toPeerUUID: this.remotePeerUUID.value,
      fromPeerUUID: this.ownUUID.value,
      description: offer,
    });
  }

  private async handleReceivedOffer(sessionDescription: RTCSessionDescriptionInit) {
    const peerConnection = await this.createPeerConnection();

    if (peerConnection.currentRemoteDescription) {
      console.log("Already have remote description");
      return;
    }

    peerConnection.ondatachannel = ev => {
      const recChannel = ev.channel;
      this.msgChannel = recChannel;
      recChannel.onmessage = me => {
        console.log("onmessage", me);
        this.signallingChannel.onPeerEvent(receivedDataMessage(this.remotePeerUUID, me.data));
      };
    };

    await peerConnection.setRemoteDescription(sessionDescription);
    if (peerConnection.currentLocalDescription) {
      console.log("Already have local description");
      return;
    }

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    this.signallingChannel.send({
      event: "rtc_answer",
      toPeerUUID: this.remotePeerUUID.value,
      fromPeerUUID: this.ownUUID.value,
      description: answer,
    });
  }

  private async createPeerConnection(setupDataChannel: boolean = false): Promise<RTCPeerConnection> {
    this.peerConnection = new RTCPeerConnection(configuration);
    if (setupDataChannel) {
      this.msgChannel = this.peerConnection.createDataChannel("msgChannel");
      this.msgChannel.onmessage = me => {
        console.log("onmessage from", this.remotePeerUUID, me);
        this.signallingChannel.onPeerEvent(receivedDataMessage(this.remotePeerUUID, me.data));
      };
    }
    this.peerConnection.onnegotiationneeded = ev => console.log("negotiationneeded", ev);
    this.peerConnection.onsignalingstatechange = ev => console.log("signalingstatechange", ev);
    this.peerConnection.onconnectionstatechange = ev => console.log("connectionstatechange", ev);
    this.peerConnection.onicegatheringstatechange = ev => console.log("icegatheringstatechange", ev);
    this.peerConnection.oniceconnectionstatechange = ev => {
      console.log("oniceconnectionstatechange", ev);
      if ((ev.currentTarget as any).iceConnectionState === "connected") {
        this.signallingChannel.onPeerEvent(iceConnected(this.remotePeerUUID));
        this.signallingChannel.onPeerEvent(dataChannelStatusChange(this.remotePeerUUID, "READY"));
      }
    };
    this.peerConnection.onicecandidateerror = ev => console.log("icecandidateerror", ev);
    this.peerConnection.onicecandidate = event => {
      console.log("icecandidate", event);
      if (event.candidate) {
        this.signallingChannel.send({
          event: "new_ice_candidate",
          fromPeerUUID: this.ownUUID.value,
          toPeerUUID: this.remotePeerUUID.value,
          candidate: event.candidate,
        });
      }
    };

    return this.peerConnection;
  }
}

const configuration = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};
