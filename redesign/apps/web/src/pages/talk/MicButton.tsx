import { useEffect, useRef, useState } from 'react';
import { speechSupported, startDictation } from '../../lib/speech';
import { Button } from '../../ui/Button';

/** "Speak": browser speech recognition, adding what is heard to the box. Hidden where the browser has none. */
export function MicButton({ lang, onText, onError }: { lang: string; onText: (text: string) => void; onError: (message: string) => void }) {
  const [listening, setListening] = useState(false);
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);
  if (!speechSupported()) return null;
  function toggle() {
    if (listening) {
      stop.current?.();
      stop.current = null;
      setListening(false);
      return;
    }
    setListening(true);
    stop.current = startDictation({
      lang,
      onText,
      onEnd: () => setListening(false),
      onError: (m) => {
        setListening(false);
        onError(m);
      },
    });
  }
  return (
    <Button variant="secondary" onClick={toggle} aria-pressed={listening}>
      {listening ? 'Stop listening' : 'Speak instead'}
    </Button>
  );
}
