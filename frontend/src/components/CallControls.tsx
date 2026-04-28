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
    <div className="flex items-center gap-3 rounded-full border border-white/15 bg-white/95 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.3)] backdrop-blur">
      <Button
        aria-label="Toggle microphone"
        variant="soft"
        className="h-11 w-11 rounded-full px-0 text-slate-800 [&_svg]:h-5 [&_svg]:w-5"
        onClick={onToggleMute}
        icon={muted ? <MicOff size={19} /> : <Mic size={19} />}
      />
      <Button
        aria-label="Toggle camera"
        variant="soft"
        className="h-11 w-11 rounded-full px-0 text-slate-800 [&_svg]:h-5 [&_svg]:w-5"
        onClick={onToggleCamera}
        icon={cameraOff ? <VideoOff size={19} /> : <Video size={19} />}
      />
      <Button
        aria-label="Share screen"
        variant={sharing ? 'primary' : 'soft'}
        className="h-11 w-11 rounded-full px-0 [&_svg]:h-5 [&_svg]:w-5"
        onClick={onShare}
        icon={<MonitorUp size={19} />}
      />
      <Button
        aria-label="End call"
        variant="danger"
        className="h-11 w-11 rounded-full px-0 shadow-sm [&_svg]:h-5 [&_svg]:w-5"
        onClick={onEnd}
        icon={<PhoneOff size={19} />}
      />
    </div>
  );
}
