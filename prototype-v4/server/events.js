// Server-sent events. Each event carries only the public revision number,
// the server boot ID and a coarse kind; clients fetch the public state when
// the revision moves. Private data and tokens never travel on this channel.
// On (re)connect the server always sends the current revision first, so a
// tab that missed events while disconnected catches up immediately.

export class EventHub {
  constructor({ maxClients = 64, heartbeatMs = 25_000 } = {}) {
    this.maxClients = maxClients;
    this.clients = new Set();
    this.heartbeat = setInterval(() => {
      for (const res of this.clients) res.write(': keep-alive\n\n');
    }, heartbeatMs);
    this.heartbeat.unref();
  }

  get size() {
    return this.clients.size;
  }

  attach(req, res, { rev, bootId }, headers) {
    if (this.clients.size >= this.maxClients) return false;
    res.writeHead(200, {
      ...headers,
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    });
    res.write('retry: 3000\n\n');
    res.write(frame(rev, bootId, 'hello'));
    this.clients.add(res);
    const drop = () => this.clients.delete(res);
    req.on('close', drop);
    res.on('error', drop);
    return true;
  }

  broadcast(rev, bootId, kind) {
    const data = frame(rev, bootId, kind);
    for (const res of this.clients) res.write(data);
  }

  close() {
    clearInterval(this.heartbeat);
    for (const res of this.clients) res.end();
    this.clients.clear();
  }
}

function frame(rev, bootId, kind) {
  return `id: ${rev}\nevent: sync\ndata: ${JSON.stringify({ rev, bootId, kind })}\n\n`;
}
