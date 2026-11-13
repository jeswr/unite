# Notice

The recording pipeline in this folder (`record.ts`, `lib/` and `stage/`) is adapted from the narrated-walkthrough pipeline of Concord (`standards-concord/walkthrough/`), by way of the copy in this repository's `redesign/walkthrough/`, used under the MIT licence:

> MIT License
>
> Copyright (c) 2026 Jesse Wright
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

Changes for the Common Picture: the script parser, Director, capture, mux, voice providers, budget and options are copied from `redesign/walkthrough/lib/` and kept close to the original (the Director gains a smooth `reveal` scroll and an `aim` for the pointer; the chapter cards and caption bar take the site's colours). The app server is replaced by a small static server for the built site with an SPA fallback (`lib/server.ts`), and the allowlisting proxy by a browser-level rule that refuses any request off that server (`lib/browser.ts`). The scenes and the script are the Common Picture's own.
