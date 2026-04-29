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

type ConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';

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
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [connectionState, setConnectionState] = useState<ConnectionState>('new');

  const addIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    const peer = peerRef.current;
    if (!peer || !peer.remoteDescription) {
      pendingIceRef.current.push(candidate);
      return;
    }

    try {
      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      setMediaError('The call connection had trouble exchanging network details.');
    }
  }, []);

  const flushPendingIce = useCallback(async () => {
    const pending = [...pendingIceRef.current];
    pendingIceRef.current = [];
    await Promise.all(pending.map((candidate) => addIceCandidate(candidate)));
  }, [addIceCandidate]);

  const ensurePeer = useCallback(async () => {
    if (!socket || !callId || !peerId) return null;
    if (peerRef.current) return peerRef.current;

    const peer = new RTCPeerConnection({ iceServers });
    peerRef.current = peer;
    setConnectionState(peer.connectionState);
    peer.onicecandidate = (event) => {
      if (event.candidate) socket.emit('webrtc:ice', { callId, receiverId: peerId, candidate: event.candidate });
    };
    peer.onconnectionstatechange = () => {
      setConnectionState(peer.connectionState);
      if (peer.connectionState === 'connected') onConnected();
      if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected') {
        setMediaError('The call connection dropped. Try ending and starting again.');
      }
    };
    peer.ontrack = (event) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
      onConnected();
    };

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: callType === 'video', audio: true });
      setMediaError('');
    } catch {
      setMediaError('Camera or microphone permission is blocked.');
      throw new Error('Media permission blocked');
    }
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    return peer;
  }, [callId, callType, localVideoRef, onConnected, peerId, remoteVideoRef, socket]);

  const startOffer = useCallback(async () => {
    try {
      const peer = await ensurePeer();
      if (!peer || !socket || !callId || !peerId) return;
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit('webrtc:offer', { callId, receiverId: peerId, offer });
    } catch {
      setMediaError('Could not start the call. Check camera and microphone access.');
    }
  }, [callId, ensurePeer, peerId, socket]);

  useEffect(() => {
    if (!enabled || !socket || !callId || !peerId) return;

    const onOffer = async (payload: { callId: string; senderId: string; offer: RTCSessionDescriptionInit }) => {
      if (payload.callId !== callId) return;
      try {
        const peer = await ensurePeer();
        if (!peer) return;
        await peer.setRemoteDescription(new RTCSessionDescription(payload.offer));
        await flushPendingIce();
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit('webrtc:answer', { callId, receiverId: payload.senderId, answer });
      } catch {
        setMediaError('Could not answer the call. Check camera and microphone access.');
      }
    };

    const onAnswer = async (payload: { callId: string; answer: RTCSessionDescriptionInit }) => {
      if (payload.callId !== callId || !peerRef.current) return;
      try {
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
        await flushPendingIce();
      } catch {
        setMediaError('Call setup failed. Try again.');
      }
    };

    const onIce = async (payload: { callId: string; candidate: RTCIceCandidateInit }) => {
      if (payload.callId !== callId) return;
      await addIceCandidate(payload.candidate);
    };

    socket.on('webrtc:offer', onOffer);
    socket.on('webrtc:answer', onAnswer);
    socket.on('webrtc:ice', onIce);

    if (isCaller) void startOffer();
    else void ensurePeer().catch(() => undefined);

    return () => {
      socket.off('webrtc:offer', onOffer);
      socket.off('webrtc:answer', onAnswer);
      socket.off('webrtc:ice', onIce);
    };
  }, [addIceCandidate, callId, enabled, ensurePeer, flushPendingIce, isCaller, peerId, socket, startOffer]);

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
    try {
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
    } catch {
      setMediaError('Screen sharing is unavailable.');
    }
  };

  const stop = () => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    peerRef.current?.close();
    peerRef.current = null;
    pendingIceRef.current = [];
  };

  return { muted, cameraOff, sharing, mediaError, connectionState, toggleMute, toggleCamera, shareScreen, stop };
}
