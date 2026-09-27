// About this demo: what is real, what is not, privacy, AI and evidence.

import { h } from '../dom.js';

const link = (href, text) => h('a', { href, rel: 'noopener noreferrer' }, text);

export function renderAbout(ctx) {
  const ai = ctx.data.ai;
  return h('section', { class: 'view', 'aria-labelledby': 'about-title' },
    h('header', { class: 'view-head' },
      h('p', { class: 'eyebrow' }, 'About this demo'),
      h('h1', { id: 'about-title' }, 'A real local prototype, not a global service'),
    ),
    h('div', { class: 'prose' },
      h('h2', null, 'What is real'),
      h('ul', null,
        h('li', null, 'A small server on this computer (127.0.0.1) holds public posts, replies, common-ground statements, responses and actions. Every tab connected to it sees changes live.'),
        h('li', null, 'Each browser tab is its own participant. Open a second tab or window on this computer to take part as another person.'),
        h('li', null, 'Browsers allow only about six connections to one address, shared by all tabs (127.0.0.1 and localhost count separately). So only the window you are using keeps a live stream. Hidden tabs pause and catch up when shown again; other visible windows check for changes every few seconds.'),
        h('li', null, ai.enabled
          ? `The AI interviewer and synthesis suggestions call Claude (${ai.model}) through the Claude Code CLI installed on this computer, only after you agree to the disclosure in your tab.`
          : `The AI features are off on this server: ${ai.reason}`),
      ),
      h('h2', null, 'What is not'),
      h('ul', null,
        h('li', null, 'Not a deployed or worldwide service. People on other computers cannot join, and the server is not reachable from your network.'),
        h('li', null, 'Not representative. Counts describe only the people who used this local demo. They never show what a town, country or humanity thinks.'),
        h('li', null, 'No authority and no money. Statuses on the action board are owners\' own reports. For an institutional proposal, "Done" means the proposal work was completed; adoption is never recorded and always unconfirmed. No institution has adopted anything, and there is no budget, partner or public mandate behind Unite.'),
        h('li', null, 'Not verified authorship. An "AI-assisted" label on a statement is declared by the person who proposed it.'),
        h('li', null, 'Not a measure of wellbeing. An action\'s intended change in everyday life, and how people will know it helped, are the proposer\'s intentions. Nothing here checks or proves them.'),
        h('li', null, 'Sample posts and the people in “A day we could make possible” are fictional, written for this demo.'),
      ),
      h('h2', null, 'Your data'),
      h('ul', null,
        h('li', null, h('strong', null, 'Public data lives in server memory only. '), 'Stopping or restarting the server erases every post, response and action and brings back the samples. Export first if you want a copy.'),
        h('li', null, 'Your session is an opaque random token kept in this tab\'s session storage. Display names are labels, not accounts, so anyone could choose the same name; the short #code tells people apart.'),
        h('li', null, 'Your private interview stays in this tab. The server relays each turn to the AI and keeps nothing; it is never in the feed, summaries or export. You never need to share a diagnosis, a name or a place to take part.'),
        h('li', null, 'Withdrawing a post removes its text for everyone connected, but anyone who already exported the data keeps their copy.'),
      ),
      h('p', null, h('a', { class: 'button primary', href: '/api/export', download: '' }, 'Download public data (JSON)')),
      h('p', { class: 'small muted' }, 'The export contains public posts, statements with their history and responses, and actions. It never contains session tokens or private interviews.'),
      h('h2', null, 'Design choices and the evidence behind them'),
      h('ul', null,
        h('li', null, 'Start from everyday life, not from institutions. Rooms and the interview begin with ordinary moments people want, what already works and what gets in the way. Income, jobs, governments and Unite itself are treated as possible means, never as the definition of success, and people\'s own words about them are kept. Rooms are starting places, not a complete list of what matters. Background: ', link('https://ijdesign.org/index.php/IJDesign/article/view/1480/589', 'Hassenzahl and colleagues on designing for everyday experiences'), ' and the ', link('https://hdr.undp.org/system/files/documents/primercomplete.pdf', 'capabilities approach (UNDP primer)'), '.'),
        h('li', null, 'Interview first, then a reviewed public post, then deliberation. Anthropic interviewed ', link('https://www.anthropic.com/features/81k-interviews', 'about 81,000 Claude users in 159 countries and 70 languages'), ' with ', link('https://www.anthropic.com/about-anthropic-interviewer', 'fixed aims and adaptive follow-up questions'), '. Participants were self-selected Claude users, so it is not a representative survey of humanity.'),
        h('li', null, 'Chronological feed, no likes, no follower counts. Reward feedback can amplify expressed outrage (', link('https://doi.org/10.1126/sciadv.abe5641', 'Brady et al., 2021'), ') and posts about out-groups draw more engagement (', link('https://doi.org/10.1073/pnas.2024292118', 'Rathje et al., 2021'), '). Removing these signals is a design bet, not a proven cure for polarisation.'),
        h('li', null, 'AI synthesis stays a private suggestion with visible sources until a person proposes it, and responses start again on every revision. People preferred AI-mediated group statements in bounded UK studies (', link('https://doi.org/10.1126/science.adq2852', 'Tessler et al., 2024'), '), which is a reason for human contestation and source visibility, not a machine mandate.'),
        h('li', null, 'Concerns are carried, not scored away. A concern raised on an action holds it back until someone records how it is handled. A concern on the room\'s statement, or a revised statement, holds it back until the owner records a review of exactly that context. Neither is a permanent veto, and the concern stays on record.'),
      ),
    ),
  );
}
