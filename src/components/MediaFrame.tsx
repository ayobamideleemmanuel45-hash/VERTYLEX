import {Layers} from 'lucide-react';
import {useState} from 'react';

interface MediaFrameProps {
  src: string;
  alt: string;
  className?: string;
  aspectClass?: string;
  priority?: boolean;
}

export function MediaFrame({
  src,
  alt,
  className = '',
  aspectClass = 'aspect-[4/3]',
  priority = false,
}: MediaFrameProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(priority);

  return (
    <div
      className={`relative overflow-hidden bg-[#EDEDEF] border border-[#E4E4E7] ${aspectClass} ${className}`}
    >
      {!failed ? (
        <img
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          loading={priority ? 'eager' : 'lazy'}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`h-full w-full object-cover transition-[opacity,transform] duration-500 ease-out ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#F3F3F5] to-[#E5E5E8] p-6 text-center">
          <Layers className="h-7 w-7 text-[#5A5A62]" aria-hidden="true" />
          <p className="max-w-xs text-xs font-medium text-[#5A5A62]">{alt}</p>
        </div>
      )}
    </div>
  );
}
