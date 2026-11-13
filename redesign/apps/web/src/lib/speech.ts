/**
 * Browser speech recognition, where the browser has it. The microphone button is hidden when
 * `speechSupported()` is false.
 */

interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type RecognitionConstructor = new () => Recognition;

function recognitionClass(): RecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function speechSupported(): boolean {
  return !!recognitionClass();
}

export interface DictationOptions {
  /** BCP 47, for example 'en-GB'. */
  lang: string;
  /** Called with each finished piece of text. */
  onText: (text: string) => void;
  /** Called with words still being recognised, if wanted. */
  onInterim?: (text: string) => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
}

/** Starts listening. Returns a function that stops it. Does nothing where speech is not supported. */
export function startDictation(opts: DictationOptions): () => void {
  const Rec = recognitionClass();
  if (!Rec) {
    opts.onError?.('Speaking is not available in this browser. You can type instead.');
    return () => {};
  }
  const rec = new Rec();
  rec.lang = opts.lang;
  rec.interimResults = !!opts.onInterim;
  rec.continuous = true;
  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i]!;
      if (r.isFinal) opts.onText(r[0].transcript.trim());
      else interim += r[0].transcript;
    }
    if (interim) opts.onInterim?.(interim);
  };
  rec.onerror = (e) =>
    opts.onError?.(e.error === 'not-allowed' ? 'The microphone is not allowed. You can type instead.' : 'Speaking stopped working. You can type instead.');
  rec.onend = () => opts.onEnd?.();
  rec.start();
  return () => rec.stop();
}
