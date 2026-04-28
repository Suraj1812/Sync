import { Mic, MicOff, MonitorUp, PhoneOff, Video, VideoOff } from 'lucide-react';
import { Button } from './Button';

type CallControlsProps = {
  muted: boolean;
  cameraOff: boolean;
  sharing: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onShare: () => void;
  onEnd: () => void;
};

export function CallControls({
  muted,
  cameraOff,
  sharing,
  onToggleMute,
  onToggleCamera,
  onShare,
  onEnd,
}: CallControlsProps) {
  return (
    <div className="flex items-center gap-3 rounded-full bg-white/95 p-2 shadow-soft backdrop-blur">
      <Button
        aria-label="Toggle microphone"
        variant="soft"
        className="h-11 w-11 rounded-full px-0"
        onClick={onToggleMute}
        icon={muted ? <MicOff size={19} /> : <Mic size={19} />}
      />
      <Button
        aria-label="Toggle camera"
        variant="soft"
        className="h-11 w-11 rounded-full px-0"
        onClick={onToggleCamera}
        icon={cameraOff ? <VideoOff size={19} /> : <Video size={19} />}
      />
      <Button
        aria-label="Share screen"
        variant={sharing ? 'primary' : 'soft'}
        className="h-11 w-11 rounded-full px-0"
        onClick={onShare}
        icon={<MonitorUp size={19} />}
      />
      <Button
        aria-label="End call"
        variant="danger"
        className="h-11 w-11 rounded-full px-0"
        onClick={onEnd}
        icon={<PhoneOff size={19} />}
      />
    </div>
  );
}
