import { Link } from 'react-router';
import { Layout } from '../../ui/Layout';

const STEPS: { name: string; text: string }[] = [
  { name: 'Listen', text: 'You have a private conversation about a real, recent day in your life: what mattered, what got in the way, and what a good ordinary day would look like a few years from now. At the end you see a few points in your own words. Only the points you approve are shared.' },
  { name: 'See', text: 'Only then do you see the picture of what everyone said: the main themes, real quotes, where people differ, and who has not been heard yet. Every sentence can be opened to show the words and the number of people behind it.' },
  { name: 'Talk', text: 'Statements are drafted from everyone’s points. You can agree, disagree, say you are unsure, or word it better. You see how others answered only after you answer. Small live rooms work through the real disagreements.' },
  { name: 'Decide', text: 'Statements pass by a rule the host set before anyone spoke. As soon as they pass, you choose the three that matter most to you, and the list is ordered so that smaller groups’ priorities reach the top too.' },
  { name: 'Deliver', text: 'By the date in the pledge, the host answers every priority: accepted, changed, delayed or refused, each with reasons. Accepted decisions get plans, owners and dates.' },
  { name: 'Check', text: 'Someone other than the host, a panel drawn by lot or an independent body, checks what was delivered against numbered tests written in advance. Every decision appears in a public register.' },
];

export default function How() {
  return (
    <Layout title="How Unite works">
      <p className="mb-4">
        Unite is a place where people say, in a private conversation, what a good ordinary life looks like for them, see an honest picture of
        what everyone else said, work through the real disagreements together, decide by a rule agreed in advance, and then watch what was
        decided get built or get a public reason why not.
      </p>
      <p className="mb-6">It runs as one loop of six steps.</p>
      <ol className="mb-8 space-y-4">
        {STEPS.map((s, i) => (
          <li key={s.name}>
            <h2 className="mb-1 text-[1.1rem]">
              {i + 1}. {s.name}
            </h2>
            <p>{s.text}</p>
          </li>
        ))}
      </ol>

      <h2 className="mb-2">Two layers</h2>
      <p className="mb-3">
        <strong>Open listening</strong> is always on. Anyone can have the conversation at any time, about their own life, with no question set
        by anyone else. It promises only this: your words are counted, shown faithfully, and you are told when an assembly opens on something
        you raised.
      </p>
      <p className="mb-8">
        <strong>Assemblies</strong> are where things get decided. An assembly is one question, one host and one written pledge. The host is
        whoever can act on the answer. The pledge says what the host has set aside, how the decision will be made, and the date by which every
        item will get a reasoned answer. An assembly cannot open without one.
      </p>

      <h2 className="mb-2">The interviewer is an AI that asks and never argues</h2>
      <p className="mb-8">
        It asks one question at a time and follows what you said. It has no opinions, offers no facts and suggests no answers. Every reply is
        checked against fixed rules before you see it. You can skip any question, stop at any time, and take part without the AI by answering
        written questions instead.
      </p>

      <ul className="space-y-2">
        <li>
          <Link to="/how/rules">The rules Unite’s code enforces</Link>
        </li>
        <li>
          <Link to="/how/prompts">Every prompt the AI is given, word for word</Link>
        </li>
      </ul>
    </Layout>
  );
}
