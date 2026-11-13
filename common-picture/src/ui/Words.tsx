import { useId, useState, type FormEvent } from 'react';
import { LANGUAGES } from '../data/layers';
import type { Words as W } from '../data/types';

export function langName(code: string): string {
  return LANGUAGES[code]?.name ?? code;
}

/** Original words first, then the labelled translation, then glosses for value-laden words. */
export function Words({ w, side = false, readerFirst = false }: { w: W; side?: boolean; readerFirst?: boolean }) {
  const orig = (
    <p className="orig" lang={w.lang}>
      {w.original}
    </p>
  );
  const trans = w.translation ? (
    <div className="trans-block">
      <span className="trans-label">Translated from {langName(w.lang)}</span>
      <p className="trans" lang="en">
        {w.translation}
      </p>
    </div>
  ) : null;
  const origBlock = (
    <div>
      {side && w.translation && <span className="trans-label">Original · {langName(w.lang)}</span>}
      {orig}
    </div>
  );
  return (
    <div className={`words${side && trans ? ' twocol' : ''}`}>
      {readerFirst && trans ? (
        <>
          {trans}
          {origBlock}
        </>
      ) : (
        <>
          {origBlock}
          {trans}
        </>
      )}
      {w.glosses?.length ? (
        <p className="gloss">
          Kept in the original:{' '}
          {w.glosses.map((g, i) => (
            <span key={g.word}>
              {i > 0 && '; '}
              <i lang={w.lang}>{g.word}</i>: {g.gloss}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}

export function ExampleTag({ children = 'Example data' }: { children?: string }) {
  return <span className="example-tag">{children}</span>;
}

/** "This is not what was said": on every summary. In the demonstration it acknowledges and sends nothing. */
export function NotWhatWasSaid({ summary }: { summary: string }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [text, setText] = useState('');
  const id = useId();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setDone(true);
  };
  return (
    <div>
      <button
        type="button"
        className="btn quiet small"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setOpen(!open);
          setDone(false);
        }}
      >
        This is not what was said
      </button>
      {open && (
        <div id={id} className="nws-form reveal" role="region" aria-label={`Say this is not what was said: ${summary}`}>
          {done ? (
            <p role="status" style={{ margin: 0 }}>
              Thank you. In the real picture this would go to the people who check summaries, and the summary would be
              marked as challenged until they answer. <strong>In this demonstration nothing was sent.</strong>
            </p>
          ) : (
            <form onSubmit={submit}>
              <div className="field">
                <label htmlFor={`${id}-t`}>
                  What was said instead?
                  <span className="hint"> Optional. About: “{summary}”</span>
                </label>
                <textarea id={`${id}-t`} value={text} onChange={(e) => setText(e.target.value)} rows={3} />
              </div>
              <div className="btn-row">
                <button type="submit" className="btn small">
                  Send challenge
                </button>
                <button type="button" className="btn quiet small" onClick={() => setOpen(false)}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
