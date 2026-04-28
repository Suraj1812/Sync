import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';

type UseWebRTCOptions = {
  socket: Socket | null;
  callId?: string;
  peerId?: string;
  isCaller: boolean;
  enabled: boolean;
  callType: 'audio' | 'video';
  localVideoRef: RefObject<HTMLVideoElement | null>;
  remoteVideoRef: RefObject<HTMLVideoElement | null>;
  onConnected: () => void;
};

const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];

export function useWebRTC({
  socket,
  callId,
  peerId,
  isCaller,
  enabled,
  callType,
  localVideoRef,
  remoteVideoRef,
  onConnected,
}: UseWebRTCOptions) {
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [sharing, setSharing] = useState(false);

  const ensurePeer = useCallback(async () => {
    if (!socket || !callId || !peerId) return null;
    if (peerRef.current) return peerRef.current;

    const peer = new RTCPeerConnection({ iceServers });
    peerRef.current = peer;
    peer.onicecandidate = (event) => {
      if (event.candidate) socket.emit('webrtc:ice', { callId, receiverId: peerId, candidate: event.candidate });
    };
    peer.ontrack = (event) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
      onConnected();
    };

    const stream = await navigator.mediaDevices.getUserMedia({ video: callType === 'video', audio: true });
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    return peer;
  }, [callId, callType, localVideoRef, onConnected, peerId, remoteVideoRef, socket]);

  const startOffer = useCallback(async () => {
    const peer = await ensurePeer();
    if (!peer || !socket || !callId || !peerId) return;
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socket.emit('webrtc:offer', { callId, receiverId: peerId, offer });
  }, [callId, ensurePeer, peerId, socket]);

  useEffect(() => {
    if (!enabled || !socket || !callId || !peerId) return;

    const onOffer = async (payload: { callId: string; senderId: string; offer: RTCSessionDescriptionInit }) => {
      if (payload.callId !== callId) return;
      const peer = await ensurePeer();
      if (!peer) return;
      await peer.setRemoteDescription(new RTCSessionDescription(payload.offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit('webrtc:answer', { callId, receiverId: payload.senderId, answer });
    };

    const onAnswer = async (payload: { callId: string; answer: RTCSessionDescriptionInit }) => {
      if (payload.callId !== callId || !peerRef.current) return;
      await peerRef.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
    };

    const onIce = async (payload: { callId: string; candidate: RTCIceCandidateInit }) => {
      if (payload.callId !== callId || !peerRef.current) return;
      await peerRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
    };

    socket.on('webrtc:offer', onOffer);
    socket.on('webrtc:answer', onAnswer);
    socket.on('webrtc:ice', onIce);

    if (isCaller) void startOffer();
    else void ensurePeer();

    return () => {
      socket.off('webrtc:offer', onOffer);
      socket.off('webrtc:answer', onAnswer);
      socket.off('webrtc:ice', onIce);
    };
  }, [callId, enabled, ensurePeer, isCaller, peerId, socket, startOffer]);

  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = muted;
    });
    setMuted(!muted);
  };

  const toggleCamera = () => {
    if (callType === 'audio') return;
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = cameraOff;
    });
    setCameraOff(!cameraOff);
  };

  const shareScreen = async () => {
    if (!peerRef.current || callType === 'audio') return;
    const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const screenTrack = display.getVideoTracks()[0];
    const sender = peerRef.current.getSenders().find((item) => item.track?.kind === 'video');
    await sender?.replaceTrack(screenTrack);
    setSharing(true);
    screenTrack.onended = async () => {
      const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
      if (cameraTrack) await sender?.replaceTrack(cameraTrack);
      setSharing(false);
    };
  };

  const stop = () => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    peerRef.current?.close();
    peerRef.current = null;
  };

  return { muted, cameraOff, sharing, toggleMute, toggleCamera, shareScreen, stop };
}
