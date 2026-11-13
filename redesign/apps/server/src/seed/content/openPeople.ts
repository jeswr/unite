import type { PersonSpec, ThemeSpec } from './types.js';
import { NGOZI, RAVI } from './transcripts.js';

/**
 * Open listening: 60 invented people in 14 countries, talking about their own lives, many in
 * their own language. The country is the region subtag of each person’s locale.
 */

const LATAM = 'Latin America and the Caribbean';
const about = (region: string, age: string) => ({ region, age });
const U = 'Under 25';
const M = '25 to 49';
const F = '50 to 64';
const O = '65 or over';

export const OPEN_PEOPLE: PersonSpec[] = [
  /* ---------------------------------------------------------------- Mexico */
  {
    key: 'lupita',
    name: 'Lupita',
    locale: 'es-MX',
    language: 'es',
    about: about(LATAM, F),
    points: [
      ['barrier', 'a', 'care', 'Cuido a mi mamá por las mañanas y trabajo en la tienda por las tardes. No me queda tiempo para mí.', 'I look after my mum in the mornings and work at the shop in the afternoons. There’s no time left for me.'],
      ['matters', 'c', 'time', 'Los domingos comemos todos juntos. Eso no lo cambio por nada.', 'On Sundays we all eat together. I wouldn’t change that for anything.'],
      ['idea', 'n', 'carecover', 'Un centro de día cerca de casa, aunque sea dos días a la semana.', 'A day centre near home, even if it’s just two days a week.'],
      ['doubt', 'a', null, 'No sé quién me va a cuidar a mí cuando sea vieja.', 'I don’t know who will look after me when I’m old.'],
    ],
  },
  {
    key: 'diego',
    name: 'Diego',
    locale: 'es-MX',
    language: 'es',
    about: about(LATAM, M),
    points: [
      ['barrier', 'a', 'commute', 'Hago dos horas de camino a la obra y dos de regreso. Cuatro horas diarias en camión.', 'Two hours to the building site and two back. Four hours a day on the bus.'],
      ['matters', 'n', 'proud', 'Me gusta ver una casa terminada y saber que yo levanté esas paredes.', 'I like seeing a finished house and knowing I put those walls up.'],
      ['wish', 'c', 'goodday', 'Llegar a casa con luz y jugar fútbol con mi hijo en la calle.', 'Getting home while it’s still light and playing football with my son in the street.'],
      ['barrier', 'a', 'streets', 'La calle no es segura para que mi hijo juegue solo. Los coches pasan muy rápido.', 'The street isn’t safe for my son to play on his own. The cars go past very fast.'],
    ],
  },
  {
    key: 'fernanda',
    name: 'Fernanda',
    locale: 'es-MX',
    language: 'es',
    about: about(LATAM, U),
    points: [
      ['moment', 'a', 'morning', 'Ayer tuve clase a las siete, trabajo en la cafetería a las dos y tarea hasta la medianoche.', 'Yesterday I had class at seven, work at the café at two and homework until midnight.'],
      ['barrier', 'c', 'rent', 'Quiero independizarme, pero una renta cuesta casi todo mi sueldo.', 'I want to move out, but rent costs almost my whole wage.'],
      ['doubt', 'a', null, 'Estudio diseño y ya hay programas que lo hacen solos. No sé si fue buena idea.', 'I’m studying design and there are already programs that do it by themselves. I don’t know if it was a good idea.'],
      ['wish', 'n', 'goodday', 'Un trabajo donde me paguen por pensar, no solo por estar.', 'A job where they pay me to think, not just to be there.'],
    ],
  },
  {
    key: 'rocio',
    name: 'Rocío',
    locale: 'es-MX',
    language: 'es',
    about: about(LATAM, M),
    points: [
      ['barrier', 'n', 'streets', 'Mis hijas caminan a la escuela y no hay banqueta en la mitad del camino.', 'My daughters walk to school and there’s no pavement for half the way.'],
      ['matters', 'a', 'neighbours', 'Las vecinas nos cuidamos a los niños entre nosotras. Sin eso no podría trabajar.', 'We neighbours look after each other’s children. Without that I couldn’t work.'],
      ['idea', 'c', 'saferoads', 'Que pongan un semáforo en la esquina de la escuela. No es mucho pedir.', 'Put a traffic light at the school corner. It’s not much to ask.'],
    ],
  },
  {
    key: 'ernesto',
    name: 'Ernesto',
    locale: 'es-MX',
    language: 'es',
    about: about(LATAM, O),
    points: [
      ['moment', 'a', 'morning', 'Abro mi tiendita a las ocho y platico con todos los que pasan. Eso me mantiene vivo.', 'I open my little shop at eight and chat with everyone who goes by. That keeps me alive.'],
      ['matters', 'n', 'lonely', 'Mis nietos viven en Monterrey. Los veo por el teléfono, pero no es lo mismo.', 'My grandchildren live in Monterrey. I see them on the phone, but it’s not the same.'],
      ['doubt', 'c', null, 'Dicen que todo va a ser por internet. Yo quiero seguir pagando con billetes.', 'They say everything will be online. I want to keep paying with notes.'],
    ],
  },
  /* ---------------------------------------------------------------- United States */
  {
    key: 'maria',
    name: 'María',
    locale: 'es-US',
    language: 'es',
    about: about('North America', M),
    points: [
      ['moment', 'a', 'morning', 'Limpio oficinas de noche. Llego a casa a las seis, despierto a los niños y los llevo a la escuela.', 'I clean offices at night. I get home at six, wake the kids and take them to school.'],
      ['barrier', 'c', 'care', 'Mi papá vive con nosotros desde el derrame. Yo lo baño antes de irme a trabajar.', 'My dad has lived with us since his stroke. I bathe him before I go to work.'],
      ['wish', 'n', 'goodday', 'Dormir de noche, como la gente normal. Eso sería un buen día.', 'Sleeping at night, like normal people. That would be a good day.'],
    ],
  },
  {
    key: 'denise',
    name: 'Denise',
    locale: 'en-US',
    about: about('North America', F),
    points: [
      ['barrier', 'n', 'care', 'I’ve used every vacation day this year on Dad’s appointments. My boss is kind, but kind doesn’t pay for respite care.'],
      ['matters', 'a', 'time', 'Dad still knows me most days. I want to be there for the days he does.'],
      ['doubt', 'c', null, 'They’re testing a robot companion at his facility. I can’t decide if that’s sad or sensible.'],
      ['idea', 'a', 'carecover', 'Let me work four longer days so I can have Fridays with him. Same hours, just arranged differently.'],
    ],
  },
  {
    key: 'tyler',
    name: 'Tyler',
    locale: 'en-US',
    about: about('North America', U),
    points: [
      ['moment', 'c', 'morning', 'Open the coffee place at 5am, then community college, then I fall asleep doing homework.'],
      ['barrier', 'a', 'rent', 'Three roommates and I still spend half my paycheck on rent. Half.'],
      ['matters', 'a', 'proud', 'I want to fix HVAC systems. Nobody’s automating crawling into an attic in August.'],
      ['wish', 'n', 'goodday', 'My own place, a truck that starts, and Sundays off.'],
    ],
  },
  {
    key: 'marcus',
    name: 'Marcus',
    locale: 'en-US',
    about: about('North America', M),
    points: [
      ['barrier', 'a', 'commute', 'The bus line to the warehouse got cut. Now it’s an hour’s walk or thirty dollars for a ride.'],
      ['matters', 'n', 'time', 'I coach my daughter’s basketball team on Saturdays. Best two hours of my week.'],
      ['doubt', 'c', null, 'Every app wants to know where I am. I don’t know who’s watching that.'],
      ['idea', 'a', 'closer', 'Bring back the night bus. Plenty of us work nights.'],
    ],
  },
  {
    key: 'linda',
    name: 'Linda',
    locale: 'en-US',
    about: about('North America', O),
    points: [
      ['matters', 'a', 'lonely', 'My husband died two years ago. Some days the cashier at the grocery store is the only person I talk to.'],
      ['idea', 'n', 'meet', 'The library has a coffee morning on Thursdays. Every town should have five of those.'],
      ['doubt', 'c', null, 'Everyone tells me to get an app for things. I’d rather have a phone number with a person on the end.'],
    ],
  },
  /* ---------------------------------------------------------------- Brazil */
  {
    key: 'rita',
    name: 'Rita',
    locale: 'pt-BR',
    language: 'pt',
    about: about(LATAM, F),
    points: [
      ['barrier', 'a', 'care', 'Meu pai mora comigo desde que caiu. Eu trabalho de noite pra poder levar ele ao médico de dia.', 'My dad has lived with me since he fell. I work nights so I can take him to the doctor in the day.'],
      ['matters', 'c', 'time', 'No domingo a família inteira vem almoçar. A casa fica cheia e eu fico feliz.', 'On Sunday the whole family comes for lunch. The house fills up and I’m happy.'],
      ['barrier', 'n', 'care', 'O posto de saúde marca consulta pra daqui a três meses. Meu pai não tem paciência pra três meses.', 'The health clinic books appointments three months ahead. My dad doesn’t have the patience for three months.'],
    ],
  },
  {
    key: 'lucas',
    name: 'Lucas',
    locale: 'pt-BR',
    language: 'pt',
    about: about(LATAM, U),
    points: [
      ['barrier', 'a', 'nowork', 'Faço entrega de bicicleta pelo aplicativo. Se chove, não ganho nada.', 'I do bike deliveries through the app. If it rains, I earn nothing.'],
      ['barrier', 'c', 'commute', 'Andar de bicicleta aqui é perigoso. Os ônibus me fecharam três vezes este mês.', 'Cycling here is dangerous. Buses have cut me up three times this month.'],
      ['wish', 'n', 'goodday', 'Terminar a faculdade e trabalhar com o que eu estudei, sem medo do fim do mês.', 'Finish university and work in what I studied, without dreading the end of the month.'],
    ],
  },
  {
    key: 'ana',
    name: 'Ana',
    locale: 'pt-BR',
    language: 'pt',
    about: about(LATAM, M),
    points: [
      ['barrier', 'a', 'streets', 'Minha filha tem dez anos e eu ainda levo ela até o portão da escola. A rua não é segura.', 'My daughter is ten and I still take her right to the school gate. The street isn’t safe.'],
      ['matters', 'c', 'neighbours', 'Na minha rua as vizinhas se ajudam. Uma busca as crianças, outra faz o almoço.', 'On my street the neighbours help each other. One collects the children, another makes lunch.'],
      ['moment', 'a', 'morning', 'Ontem o ônibus quebrou na avenida e eu cheguei atrasada de novo. A chefe nem perguntou.', 'Yesterday the bus broke down on the avenue and I was late again. My boss didn’t even ask.'],
    ],
  },
  {
    key: 'jorge',
    name: 'Jorge',
    locale: 'pt-BR',
    language: 'pt',
    about: about(LATAM, F),
    points: [
      ['matters', 'a', 'proud', 'Pesco desde menino. O mar é o meu escritório, e eu não troco.', 'I’ve fished since I was a boy. The sea is my office, and I wouldn’t swap it.'],
      ['barrier', 'c', 'prices', 'O diesel do barco subiu e o peixe não. Cada mês fica mais apertado.', 'Diesel for the boat went up and fish didn’t. Every month gets tighter.'],
      ['doubt', 'n', null, 'Meu neto quer ser programador. Eu não entendo o que ele faz, mas fico orgulhoso.', 'My grandson wants to be a programmer. I don’t understand what he does, but I’m proud.'],
    ],
  },
  /* ---------------------------------------------------------------- Senegal */
  {
    key: 'awa',
    name: 'Awa',
    locale: 'fr-SN',
    language: 'fr',
    about: about('Africa', M),
    points: [
      ['moment', 'a', 'morning', 'Je me lève à cinq heures pour aller au marché. Je vends du poisson jusqu’à midi.', 'I get up at five to go to the market. I sell fish until midday.'],
      ['barrier', 'c', 'prices', 'Le transport a encore augmenté. Je gagne moins qu’avant pour le même travail.', 'Transport went up again. I earn less than before for the same work.'],
      ['matters', 'n', 'time', 'Le soir, je mange avec mes enfants. C’est mon meilleur moment.', 'In the evening I eat with my children. It’s my best moment.'],
      ['idea', 'a', 'startup', 'Une tontine entre les femmes du marché pour acheter un congélateur ensemble.', 'A savings club among the market women to buy a freezer together.'],
    ],
  },
  {
    key: 'moussa',
    name: 'Moussa',
    locale: 'fr-SN',
    language: 'fr',
    about: about('Africa', U),
    points: [
      ['barrier', 'a', 'nowork', 'J’ai mon diplôme depuis deux ans et je n’ai toujours pas de travail.', 'I’ve had my diploma for two years and I still don’t have work.'],
      ['wish', 'c', 'goodday', 'Avoir un petit atelier de réparation de téléphones, ici, à Thiès.', 'Having a little phone repair workshop, here, in Thiès.'],
      ['doubt', 'a', null, 'Beaucoup de mes amis veulent partir en Europe. Moi, je ne sais pas.', 'Lots of my friends want to leave for Europe. Me, I don’t know.'],
      ['idea', 'n', 'startup', 'Des petits prêts pour les jeunes qui veulent commencer un métier.', 'Small loans for young people who want to start a trade.'],
    ],
  },
  {
    key: 'fatou',
    name: 'Fatou',
    locale: 'fr-SN',
    language: 'fr',
    about: about('Africa', F),
    points: [
      ['barrier', 'a', 'care', 'Ma mère est malade et je suis la seule fille. Je ne peux plus aller au marché tous les jours.', 'My mother is ill and I’m the only daughter. I can’t go to the market every day any more.'],
      ['matters', 'c', 'neighbours', 'Les voisines viennent m’aider quand je dois sortir. Sans elles, je ne sais pas.', 'The neighbours come to help when I have to go out. Without them, I don’t know.'],
      ['wish', 'n', 'goodday', 'Que ma mère soit soignée ici, et pas à trois heures de route.', 'That my mother can be treated here, and not three hours away by road.'],
    ],
  },
  {
    key: 'ibrahima',
    name: 'Ibrahima',
    locale: 'fr-SN',
    language: 'fr',
    about: about('Africa', M),
    points: [
      ['barrier', 'a', 'power', 'Il y a des coupures d’électricité presque chaque semaine. Mon atelier de couture s’arrête.', 'There are power cuts almost every week. My tailoring workshop stops.'],
      ['matters', 'n', 'proud', 'Des gens se marient avec des habits que j’ai cousus. J’en suis fier.', 'People get married in clothes I’ve sewn. I’m proud of that.'],
      ['doubt', 'c', null, 'Les vêtements importés coûtent moins cher que mon tissu. Je ne sais pas combien de temps je vais tenir.', 'Imported clothes cost less than my fabric. I don’t know how long I’ll hold on.'],
    ],
  },
  /* ---------------------------------------------------------------- Nigeria */
  { key: 'ngozi', name: 'Ngozi', locale: 'en-NG', about: about('Africa', M), points: [], transcript: NGOZI },
  {
    key: 'tunde',
    name: 'Tunde',
    locale: 'en-NG',
    about: about('Africa', M),
    points: [
      ['barrier', 'a', 'power', 'Light goes off three times a day. I spend more on diesel for the generator than on food.'],
      ['barrier', 'c', 'commute', 'I leave at 5am to reach the office by 8. Same story coming back.'],
      ['matters', 'a', 'proud', 'I build websites for small businesses. When their sales go up, I feel it too.'],
      ['idea', 'n', 'closer', 'Let us work from home two days. The roads would breathe and so would we.'],
    ],
  },
  {
    key: 'chiamaka',
    name: 'Chiamaka',
    locale: 'en-NG',
    about: about('Africa', U),
    points: [
      ['moment', 'a', 'morning', 'I sell fabric in my aunty’s shop in the morning and do my lectures online at night when the network allows.'],
      ['barrier', 'c', 'nowork', 'I graduated in microbiology. I’m selling fabric. Nobody is hiring.'],
      ['wish', 'n', 'goodday', 'A lab job, my own flat, and enough left to send something home every month.'],
      ['doubt', 'a', null, 'People say AI will take our jobs. We don’t even have the jobs yet.'],
    ],
  },
  {
    key: 'emeka',
    name: 'Emeka',
    locale: 'en-NG',
    about: about('Africa', F),
    points: [
      ['barrier', 'a', 'streets', 'Children cross the expressway to get to school because there is no footbridge near us.'],
      ['matters', 'n', 'neighbours', 'My church members check on my wife when I travel. That is real security.'],
      ['idea', 'c', 'saferoads', 'Build the footbridge first, before the next child is knocked down.'],
    ],
  },
  {
    key: 'blessing',
    name: 'Blessing',
    locale: 'en-NG',
    about: about('Africa', M),
    points: [
      ['barrier', 'a', 'prices', 'Rice has doubled since January. Now I cook once and we eat it for two days.'],
      ['matters', 'c', 'time', 'Sitting with my husband in the evening, no phones, just talking. That’s what I look forward to.'],
      ['barrier', 'n', 'power', 'When there’s no light, my children do their homework with a torch.'],
      ['wish', 'a', 'goodday', 'School fees paid on time, without borrowing from anybody.'],
    ],
  },
  /* ---------------------------------------------------------------- Kenya */
  {
    key: 'wanjiru',
    name: 'Wanjiru',
    locale: 'en-KE',
    about: about('Africa', M),
    points: [
      ['barrier', 'a', 'care', 'My mother-in-law has dementia. I work at the bank and pay a girl to watch her, but they keep leaving.'],
      ['matters', 'n', 'time', 'Saturday mornings at the market with my daughter. We don’t rush.'],
      ['idea', 'c', 'carecover', 'A day centre for old people in our estate. Many of us would pay a little.'],
    ],
  },
  {
    key: 'otieno',
    name: 'Otieno',
    locale: 'en-KE',
    about: about('Africa', F),
    points: [
      ['moment', 'a', 'morning', 'I wake at four, milk the cows, and the milk is on the motorbike to the collection centre by six.'],
      ['barrier', 'c', 'prices', 'Feed went up and the milk price didn’t. I’m working harder for less.'],
      ['matters', 'n', 'proud', 'My father kept these cows, and his father. I want my son to want them too.'],
      ['doubt', 'a', null, 'My son says an app can tell me when a cow is sick. Maybe. I still look at their eyes.'],
    ],
  },
  {
    key: 'achieng',
    name: 'Achieng',
    locale: 'en-KE',
    about: about('Africa', U),
    points: [
      ['barrier', 'a', 'commute', 'Walking home from college after dark isn’t safe. There are no streetlights on our road.'],
      ['matters', 'a', 'proud', 'I’m training as a nurse. When a patient smiles at me, I know I chose right.'],
      ['wish', 'c', 'goodday', 'Working at a hospital near home, so I can still help my mum with my brothers.'],
      ['idea', 'n', 'saferoads', 'Solar streetlights on the main roads. They work even when the power goes.'],
    ],
  },
  {
    key: 'kamau',
    name: 'Kamau',
    locale: 'en-KE',
    about: about('Africa', M),
    points: [
      ['barrier', 'a', 'rent', 'Rent in Nairobi takes half of what I make driving a matatu.'],
      ['moment', 'c', 'morning', 'Yesterday was fourteen hours on the road. Good money day, but my back is finished.'],
      ['matters', 'n', 'time', 'I want to see my kids awake. Most days I don’t.'],
      ['tradeoff', 'a', null, 'I’d earn less if I drove fewer hours, but I’d actually know my children.'],
    ],
  },
  /* ---------------------------------------------------------------- France */
  {
    key: 'sylvie',
    name: 'Sylvie',
    locale: 'fr-FR',
    language: 'fr',
    about: about('Europe', F),
    points: [
      ['moment', 'a', 'morning', 'Je commence à l’hôpital à six heures. Je prends la voiture parce qu’il n’y a pas de bus si tôt.', 'I start at the hospital at six. I take the car because there’s no bus that early.'],
      ['barrier', 'c', 'prices', 'L’essence me coûte presque deux cents euros par mois. C’est trop.', 'Petrol costs me almost two hundred euros a month. It’s too much.'],
      ['matters', 'n', 'proud', 'Je suis aide-soignante depuis vingt ans. Les patients, c’est ma raison d’y aller.', 'I’ve been a care assistant for twenty years. The patients are my reason for going in.'],
      ['doubt', 'a', null, 'On nous parle de tablettes pour remplir les dossiers. Moi, je veux du temps avec les gens.', 'They talk to us about tablets for filling in records. I want time with people.'],
    ],
  },
  {
    key: 'julien',
    name: 'Julien',
    locale: 'fr-FR',
    language: 'fr',
    about: about('Europe', M),
    points: [
      ['barrier', 'a', 'rent', 'On vit à quatre dans un trois-pièces à Lyon. On ne peut pas se payer plus grand.', 'There are four of us in a three-room flat in Lyon. We can’t afford anything bigger.'],
      ['wish', 'n', 'goodday', 'Aller au travail à vélo, sans voitures qui me frôlent.', 'Cycling to work, without cars brushing past me.'],
      ['matters', 'c', 'time', 'Le mercredi après-midi, je le garde pour mes enfants. Mon patron le sait.', 'Wednesday afternoon I keep for my children. My boss knows it.'],
    ],
  },
  {
    key: 'ines',
    name: 'Inès',
    locale: 'fr-FR',
    language: 'fr',
    about: about('Europe', U),
    points: [
      ['barrier', 'a', 'nowork', 'J’enchaîne les stages mal payés. Je ne sais pas quand ça s’arrête.', 'I go from one badly paid internship to the next. I don’t know when it stops.'],
      ['matters', 'c', 'lonely', 'Ma colocataire et moi, on cuisine ensemble le dimanche. Ça me fait tenir.', 'My flatmate and I cook together on Sundays. That keeps me going.'],
      ['doubt', 'n', null, 'Tout le monde écrit ses lettres de motivation avec l’IA. Du coup, elles se ressemblent toutes.', 'Everyone writes their cover letters with AI. So they all look the same.'],
    ],
  },
  {
    key: 'bernard',
    name: 'Bernard',
    locale: 'fr-FR',
    language: 'fr',
    about: about('Europe', O),
    points: [
      ['matters', 'a', 'lonely', 'Depuis que la boulangerie a fermé, je ne vois plus personne le matin.', 'Since the bakery closed, I don’t see anyone in the morning.'],
      ['idea', 'n', 'meet', 'Un café associatif dans l’ancienne boulangerie. Je serais le premier client.', 'A community café in the old bakery. I’d be the first customer.'],
      ['doubt', 'c', null, 'Je n’ai rien contre le progrès. Mais la mairie ne répond plus qu’en ligne.', 'I’ve nothing against progress. But the town hall only answers online now.'],
    ],
  },
  /* ---------------------------------------------------------------- Germany */
  {
    key: 'juergen',
    name: 'Jürgen',
    locale: 'de-DE',
    language: 'de',
    about: about('Europe', F),
    points: [
      ['barrier', 'a', 'care', 'Meine Mutter wohnt zwei Stunden entfernt. Jedes Wochenende fahre ich hin, und am Montag bin ich fertig.', 'My mother lives two hours away. Every weekend I drive there, and by Monday I’m worn out.'],
      ['idea', 'c', 'carecover', 'Pflegezeit, die man wirklich nehmen kann, ohne Angst um den Job.', 'Care leave you can actually take, without being afraid for your job.'],
      ['matters', 'n', 'lonely', 'Ich will nicht, dass sie allein ist, wenn es so weit ist.', 'I don’t want her to be alone when the time comes.'],
    ],
  },
  {
    key: 'leonie',
    name: 'Leonie',
    locale: 'de-DE',
    language: 'de',
    about: about('Europe', M),
    points: [
      ['moment', 'a', 'morning', 'Kita um halb acht, Büro um acht, und schon im Zug die ersten Mails.', 'Nursery at half seven, office at eight, and the first emails already on the train.'],
      ['matters', 'n', 'time', 'Abends eine Stunde ohne Handy mit meinem Sohn. Mehr will ich gar nicht.', 'An hour in the evening with my son, without my phone. That’s all I want.'],
      ['tradeoff', 'c', null, 'Ich würde gern Teilzeit arbeiten und weniger verdienen. Aber dann reicht es nicht für die Miete.', 'I’d like to work part-time and earn less. But then there isn’t enough for the rent.'],
      ['barrier', 'a', 'streets', 'Vor der Schule parken alle in zweiter Reihe. Die Kinder laufen zwischen den Autos durch.', 'Outside the school everyone double-parks. The children walk between the cars.'],
    ],
  },
  {
    key: 'mehmet',
    name: 'Mehmet',
    locale: 'de-DE',
    language: 'de',
    about: about('Europe', M),
    points: [
      ['moment', 'a', 'morning', 'Ich fahre Bus in Duisburg. Um vier geht es los, die ersten Fahrgäste sind die Putzkräfte.', 'I drive a bus in Duisburg. I start at four; the first passengers are the cleaners.'],
      ['matters', 'c', 'proud', 'Ich kenne meine Stammgäste. Die alte Dame an der Haltestelle wartet auf mich, nicht auf irgendeinen Bus.', 'I know my regulars. The old lady at the stop waits for me, not for any bus.'],
      ['doubt', 'n', null, 'Alle reden von Bussen ohne Fahrer. Wer hilft dann dem Mann mit dem Rollstuhl?', 'Everyone talks about buses without drivers. Who helps the man in the wheelchair then?'],
    ],
  },
  /* ---------------------------------------------------------------- Italy */
  {
    key: 'giulia',
    name: 'Giulia',
    locale: 'it-IT',
    language: 'it',
    about: about('Europe', M),
    points: [
      ['barrier', 'a', 'care', 'Lavoro in banca e mio padre ha l’Alzheimer. Ho chiesto il part-time e me l’hanno negato.', 'I work at a bank and my father has Alzheimer’s. I asked to go part-time and they said no.'],
      ['matters', 'c', 'time', 'La domenica pranzo da mia madre, tutti insieme. È sacro.', 'Sunday lunch at my mother’s, all together. It’s sacred.'],
      ['idea', 'n', 'carecover', 'Un’assistente di quartiere che passi da mio padre a mezzogiorno.', 'A neighbourhood care worker who drops in on my father at midday.'],
    ],
  },
  {
    key: 'salvatore',
    name: 'Salvatore',
    locale: 'it-IT',
    language: 'it',
    about: about('Europe', O),
    points: [
      ['matters', 'a', 'lonely', 'La mattina al bar ci sono sempre gli stessi amici. Parliamo di calcio e di niente.', 'In the morning at the bar it’s always the same friends. We talk about football and nothing.'],
      ['doubt', 'c', null, 'I giovani se ne vanno al Nord o all’estero. Il paese si svuota.', 'The young people leave for the North or abroad. The village is emptying.'],
      ['wish', 'n', 'goodday', 'Che mio nipote trovi lavoro qui e non debba partire.', 'That my grandson finds work here and doesn’t have to leave.'],
    ],
  },
  {
    key: 'chiara',
    name: 'Chiara',
    locale: 'it-IT',
    language: 'it',
    about: about('Europe', U),
    points: [
      ['barrier', 'n', 'rent', 'Pago quattrocentocinquanta euro per una stanza a Milano. Metà del mio stipendio.', 'I pay four hundred and fifty euros for a room in Milan. Half my salary.'],
      ['moment', 'c', 'morning', 'Ieri sono uscita dal lavoro alle otto di sera e ho cenato in metro.', 'Yesterday I left work at eight in the evening and had dinner on the metro.'],
      ['wish', 'a', 'goodday', 'Un lavoro che mi faccia tornare a casa con la luce e il tempo per cucinare.', 'A job that gets me home in daylight with time to cook.'],
    ],
  },
  /* ---------------------------------------------------------------- United Kingdom */
  {
    key: 'pauline',
    name: 'Pauline',
    locale: 'en-GB',
    about: about('Europe', F),
    points: [
      ['barrier', 'n', 'care', 'I’m looking after my mum and working full time, and some weeks I’m failing at both.'],
      ['moment', 'c', 'morning', 'Rang Mum at seven, did her tablets at eight, then a nine o’clock meeting with my coat still on.'],
      ['idea', 'a', 'carecover', 'If work let me start at ten twice a week, I could do her mornings without lying about the dentist.'],
      ['doubt', 'a', null, 'They offered a sensor that tells me if she’s fallen. I’d still rather someone popped in.'],
    ],
  },
  {
    key: 'callum',
    name: 'Callum',
    locale: 'en-GB',
    about: about('Europe', M),
    points: [
      ['barrier', 'a', 'rent', 'Our rent’s gone up three times in two years. We both work and still can’t save a deposit.'],
      ['matters', 'n', 'time', 'Bath time with my daughter. Twenty minutes and it’s the best bit of my day.'],
      ['barrier', 'c', 'streets', 'There’s no crossing between our estate and the school. I won’t let her walk it alone till she’s twelve.'],
      ['doubt', 'a', null, 'Honestly? I’m all right. I’d just like things to stop getting more expensive.'],
    ],
  },
  {
    key: 'hollie',
    name: 'Hollie',
    locale: 'en-GB',
    about: about('Europe', U),
    points: [
      ['moment', 'a', 'morning', 'Worked a double at the pub, waited for the last bus at 11:40. It didn’t come.'],
      ['barrier', 'c', 'commute', 'If the bus doesn’t come, I can’t get home. A taxi is a whole shift’s tips.'],
      ['wish', 'n', 'goodday', 'Living somewhere I can walk to work, with a garden for a dog.'],
    ],
  },
  {
    key: 'raj',
    name: 'Raj',
    locale: 'en-GB',
    about: about('Europe', M),
    points: [
      ['matters', 'a', 'proud', 'I’m a pharmacist. Half my day now is chasing shortages, not talking to patients.'],
      ['matters', 'c', 'time', 'Friday nights at my parents’ with my brothers. We’ve done it for ten years.'],
      ['wish', 'n', 'goodday', 'Patients who know my name, and shelves that aren’t always short of something.'],
    ],
  },
  {
    key: 'margaret',
    name: 'Margaret',
    locale: 'en-GB',
    about: about('Europe', O),
    points: [
      ['matters', 'n', 'lonely', 'I help at the food bank on Tuesdays. More of my old neighbours come in than I’d like.'],
      ['moment', 'c', 'morning', 'Yesterday I walked to the post office and back. Forty minutes, three people said hello.'],
      ['doubt', 'a', null, 'The surgery wants me to book online. I’m not daft, I just don’t like it.'],
      ['idea', 'a', 'meet', 'Keep the library open. It’s the only warm place where nobody expects you to buy anything.'],
    ],
  },
  {
    key: 'kwame',
    name: 'Kwame',
    locale: 'en-GB',
    about: about('Europe', M),
    points: [
      ['barrier', 'a', 'care', 'Dad’s in Ghana and getting frail. I work nights here so I can send money. I feel like a stranger to him.'],
      ['matters', 'c', 'time', 'Video calls with Dad on Sundays. He tells the same stories. I don’t mind.'],
      ['wish', 'n', 'goodday', 'Working days, and flying home twice a year without it wiping out our savings.'],
    ],
  },
  {
    key: 'sophie',
    name: 'Sophie',
    locale: 'en-GB',
    about: about('Europe', M),
    points: [
      ['barrier', 'a', 'streets', 'Cars mount the pavement outside the school every morning. Someone’s going to get hurt.'],
      ['idea', 'n', 'saferoads', 'Close the road outside the school for half an hour at drop-off. Other towns do it.'],
      ['matters', 'c', 'time', 'Walking to school with my two, holding hands, talking rubbish. I love that ten minutes.'],
    ],
  },
  /* ---------------------------------------------------------------- Japan */
  {
    key: 'keiko',
    name: 'Keiko',
    locale: 'ja-JP',
    language: 'ja',
    about: about('Asia', F),
    points: [
      ['barrier', 'a', 'care', '母の介護のために、仕事を週三日に減らしました。収入も半分です。', 'I cut my work to three days a week to care for my mother. My income halved too.'],
      ['matters', 'c', 'lonely', 'デイサービスの職員さんと話すと、ほっとします。', 'Talking with the staff at the day service is a relief.'],
      ['doubt', 'n', null, '介護ロボットの話を聞きますが、母は人の手が好きです。', 'I hear about care robots, but my mother likes human hands.'],
    ],
  },
  {
    key: 'haruto',
    name: 'Haruto',
    locale: 'ja-JP',
    language: 'ja',
    about: about('Asia', M),
    points: [
      ['moment', 'a', 'morning', '毎朝六時の電車に乗って、一時間半かけて会社に行きます。', 'Every morning I take the six o’clock train and spend an hour and a half getting to work.'],
      ['matters', 'n', 'time', '週末に子どもと公園に行くのが一番の楽しみです。', 'Going to the park with my children at the weekend is what I look forward to most.'],
      ['tradeoff', 'c', null, '給料が少し下がっても、家の近くで働きたいです。', 'Even if my pay went down a little, I’d like to work near home.'],
    ],
  },
  {
    key: 'sakura',
    name: 'Sakura',
    locale: 'ja-JP',
    language: 'ja',
    about: about('Asia', U),
    points: [
      ['barrier', 'a', 'nowork', 'コンビニのバイトを二つ掛け持ちしています。正社員の仕事が見つかりません。', 'I work two part-time jobs at convenience stores. I can’t find a full-time job.'],
      ['wish', 'c', 'goodday', '自分の部屋で、静かに本を読む時間がほしいです。', 'I want time to read quietly in a room of my own.'],
      ['doubt', 'a', null, 'AIで仕事が減ると言われても、正直よくわかりません。', 'People say AI will mean fewer jobs, but honestly I don’t really understand it.'],
    ],
  },
  /* ---------------------------------------------------------------- Indonesia */
  {
    key: 'siti',
    name: 'Siti',
    locale: 'id-ID',
    language: 'id',
    about: about('Asia', M),
    points: [
      ['moment', 'a', 'morning', 'Saya bangun jam empat, masak, lalu jualan nasi uduk di depan rumah sampai jam sembilan.', 'I get up at four, cook, then sell coconut rice outside my house until nine.'],
      ['barrier', 'c', 'streets', 'Jalan ke sekolah anak saya tidak ada trotoar. Motor lewat sangat cepat.', 'The road to my child’s school has no pavement. Motorbikes go past very fast.'],
      ['matters', 'n', 'time', 'Sore hari saya mengaji bersama anak-anak. Itu waktu yang tenang.', 'In the late afternoon I read the Qur’an with the children. It’s a calm time.'],
    ],
  },
  {
    key: 'budi',
    name: 'Budi',
    locale: 'id-ID',
    language: 'id',
    about: about('Asia', F),
    points: [
      ['barrier', 'a', 'prices', 'Harga beras naik terus, tapi ongkos ojek tidak naik.', 'The price of rice keeps going up, but motorbike taxi fares don’t.'],
      ['matters', 'c', 'proud', 'Saya kenal semua pelanggan saya. Mereka telepon saya langsung, bukan lewat aplikasi.', 'I know all my customers. They phone me directly, not through the app.'],
      ['doubt', 'n', null, 'Aplikasi yang menentukan tarif. Saya tidak tahu caranya.', 'The app decides the fares. I don’t know how.'],
    ],
  },
  {
    key: 'dewi',
    name: 'Dewi',
    locale: 'en-ID',
    about: about('Asia', U),
    points: [
      ['barrier', 'a', 'commute', 'Two hours each way to campus in the Jakarta traffic. I study on the bus when I’m not too carsick.'],
      ['wish', 'c', 'goodday', 'A tech job that lets me live near my parents, not in a tiny kos in the city.'],
      ['idea', 'n', 'closer', 'Let students follow some lectures online. The roads would be emptier and we’d sleep.'],
    ],
  },
  /* ---------------------------------------------------------------- India */
  { key: 'ravi', name: 'Ravi', locale: 'en-IN', about: about('Asia', M), points: [], transcript: RAVI },
  {
    key: 'ritu',
    name: 'Ritu',
    locale: 'en-IN',
    about: about('Asia', F),
    points: [
      ['barrier', 'a', 'care', 'My mother-in-law is bedridden. I teach at a school till three, then I’m her nurse till midnight.'],
      ['matters', 'c', 'neighbours', 'My husband helps more now. Two years ago he didn’t know where the medicines were kept.'],
      ['idea', 'n', 'carecover', 'A trained person who could come for four hours a day, at a price a teacher can pay.'],
    ],
  },
  {
    key: 'arjun',
    name: 'Arjun',
    locale: 'en-IN',
    about: about('Asia', U),
    points: [
      ['barrier', 'a', 'nowork', 'I finished engineering and I’m preparing for the government exam for the third year. My father’s patience is running out.'],
      ['wish', 'c', 'goodday', 'Any steady job in my own city. I don’t need Bangalore money.'],
      ['doubt', 'n', null, 'Coding was supposed to be safe. Now AI writes code. What do I study next?'],
    ],
  },
  {
    key: 'meena',
    name: 'Meena',
    locale: 'en-IN',
    about: about('Asia', M),
    points: [
      ['barrier', 'n', 'streets', 'We need safe streets for children. Footpaths, not just more flyovers.'],
      ['barrier', 'c', 'power', 'Power cuts in summer, three or four hours. The fan stops and the baby won’t sleep.'],
      ['matters', 'a', 'neighbours', 'The women in my building take turns walking the children to the bus stop.'],
      ['idea', 'a', 'saferoads', 'Speed breakers near every school gate. It’s not expensive.'],
    ],
  },
  {
    key: 'suresh',
    name: 'Suresh',
    locale: 'en-IN',
    about: about('Asia', F),
    points: [
      ['moment', 'a', 'morning', 'I open my tailoring shop at ten. Most days the first customer comes after twelve.'],
      ['barrier', 'c', 'prices', 'People buy ready-made online now. Alterations are all that’s left for me.'],
      ['doubt', 'a', null, 'My son says put the shop on Instagram. I don’t know what to post. A photo of a sleeve?'],
      ['matters', 'n', 'proud', 'When a bride’s blouse fits perfectly, her mother blesses me. No website gives that.'],
    ],
  },
  {
    key: 'lakshmi',
    name: 'Lakshmi',
    locale: 'en-IN',
    about: about('Asia', O),
    points: [
      ['matters', 'a', 'lonely', 'My children are in Dubai and Chennai. The neighbour’s girl comes to check on me every evening.'],
      ['doubt', 'n', null, 'The bank says use the app. I go to the branch anyway. The manager knows me.'],
      ['wish', 'c', 'goodday', 'Tea on the balcony, the temple bell, and nobody in a hurry.'],
    ],
  },
  /* ---------------------------------------------------------------- Australia */
  {
    key: 'jack',
    name: 'Jack',
    locale: 'en-AU',
    about: about('Oceania', M),
    points: [
      ['moment', 'a', 'morning', 'Up at 4:30, on site in Penrith by six, home at five. Rinse, repeat.'],
      ['barrier', 'c', 'rent', 'We’re paying seven hundred and twenty a week for a three-bedroom. Buying is a joke at this point.'],
      ['matters', 'n', 'time', 'Footy with my boy on Saturday arvo. That’s the week sorted.'],
      ['tradeoff', 'a', null, 'I’d move further out to buy, but then I’m two hours in the ute each way.'],
    ],
  },
  {
    key: 'mia',
    name: 'Mia',
    locale: 'en-AU',
    about: about('Oceania', U),
    points: [
      ['barrier', 'a', 'commute', 'One bus an hour from our suburb. Miss it and I’m late for my shift.'],
      ['wish', 'n', 'goodday', 'Finish my nursing degree, work at the local hospital, and not have to move to the city.'],
      ['doubt', 'c', null, 'I love my phone and I also think it’s making me miserable. Both.'],
    ],
  },
  {
    key: 'graham',
    name: 'Graham',
    locale: 'en-AU',
    about: about('Oceania', O),
    points: [
      ['matters', 'a', 'lonely', 'My wife’s in a nursing home now. I go every day at eleven and stay for lunch.'],
      ['doubt', 'c', null, 'They’ve got a robot seal that purrs. She likes it. I don’t know how I feel about that.'],
      ['idea', 'n', 'meet', 'A shed in every town. Somewhere to make things and talk without having to talk.'],
    ],
  },
  {
    key: 'talia',
    name: 'Talia',
    locale: 'en-AU',
    about: about('Oceania', M),
    points: [
      ['barrier', 'a', 'care', 'Mum’s in Darwin and I’m in Brisbane. Every time she has a fall I’m on a plane and using up leave.'],
      ['matters', 'c', 'time', 'Sunday breakfast with my partner. We don’t plan anything else.'],
      ['idea', 'n', 'carecover', 'Let carers take their leave in hours, not whole days.'],
    ],
  },
];

/** Themes of the open-listening picture. Only the care theme has an assembly answering it so far. */
export const OPEN_THEMES: ThemeSpec[] = [
  {
    key: 'time',
    kind: 'matters',
    name: 'See my kids awake',
    sentences: [
      { text: 'Across every country, people name a small fixed time with family as what matters most: a meal, bath time, a game on Saturday.', from: ['lupita/2', 'awa/3', 'callum/2', 'haruto/2', 'jack/3', 'giulia/2'] },
      { text: 'Long hours and long journeys are what take that time away.', from: ['kamau/3', 'ravi/3', 'leonie/2'] },
    ],
  },
  {
    key: 'proud',
    kind: 'matters',
    name: 'I’m proud of that',
    sentences: [
      { text: 'People take pride in work that others can see and use: a house, a wedding outfit, a cared-for patient, a regular passenger.', from: ['diego/2', 'ibrahima/2', 'sylvie/3', 'mehmet/2', 'suresh/4'] },
      { text: 'Some fear that pride is being squeezed out by apps, shortages or prices.', from: ['raj/1', 'budi/2'] },
    ],
  },
  {
    key: 'neighbours',
    kind: 'matters',
    name: 'Neighbours look after each other',
    sentences: [{ text: 'Neighbours, church members and family take turns with children and with the sick, and people say they could not manage without them.', from: ['rocio/2', 'fatou/2', 'emeka/2', 'meena/3', 'ana/2'] }],
  },
  {
    key: 'lonely',
    kind: 'matters',
    name: 'The only person I talk to',
    sentences: [
      { text: 'Older people especially describe days with few people in them, since a partner died, children moved away or a shop closed.', from: ['linda/1', 'bernard/1', 'lakshmi/1', 'ernesto/2', 'graham/1'] },
      { text: 'Small daily meetings, at a bar or a day service, are what keep people going.', from: ['salvatore/1', 'keiko/2', 'ines/2'] },
    ],
  },
  {
    key: 'care',
    kind: 'barrier',
    name: 'Looking after my mum and working full time',
    sentences: [
      { text: 'People in many countries are caring for an ageing parent while holding down a job, and say they are failing at one or both.', from: ['pauline/1', 'lupita/1', 'ngozi/2', 'giulia/1', 'keiko/1'] },
      { text: 'They use up leave, cut their hours or change shifts to fit appointments and bad days.', from: ['denise/1', 'rita/1', 'talia/1', 'maria/2'] },
      { text: 'Some live far from the parent they care for, in another city or another country.', from: ['juergen/1', 'kwame/1'] },
    ],
  },
  {
    key: 'streets',
    kind: 'barrier',
    name: 'Safe streets for children',
    sentences: [
      { text: 'Parents say traffic, not strangers, is why their children cannot walk to school or play outside alone.', from: ['callum/3', 'diego/4', 'sophie/1', 'leonie/4', 'ana/1'] },
      { text: 'Many roads have no pavement, crossing or footbridge near the school.', from: ['meena/1', 'rocio/1', 'emeka/1', 'siti/2'] },
    ],
  },
  {
    key: 'rent',
    kind: 'barrier',
    name: 'Half my paycheck on rent',
    sentences: [{ text: 'Young people and families say rent takes half or more of what they earn, even when two people work.', from: ['tyler/2', 'chiara/1', 'kamau/1', 'callum/1', 'fernanda/2'] }],
  },
  {
    key: 'commute',
    kind: 'barrier',
    name: 'Four hours a day on the bus',
    sentences: [
      { text: 'Long, unreliable journeys to work and college eat hours from people’s days.', from: ['diego/1', 'ravi/2', 'tunde/2', 'dewi/1'] },
      { text: 'Where buses are cut or stop early, people walk, pay for taxis or miss shifts.', from: ['marcus/1', 'hollie/2', 'mia/1'] },
    ],
  },
  {
    key: 'prices',
    kind: 'barrier',
    name: 'Less than before for the same work',
    sentences: [{ text: 'Costs such as food, fuel and transport have gone up while what people are paid for their work has not.', from: ['awa/2', 'otieno/2', 'budi/1', 'jorge/2', 'blessing/1'] }],
  },
  {
    key: 'power',
    kind: 'barrier',
    name: 'Power cuts almost every week',
    sentences: [{ text: 'Regular power cuts stop work and homework, and generators cost more than many can afford.', from: ['ibrahima/1', 'tunde/1', 'blessing/3', 'meena/2'] }],
  },
  {
    key: 'nowork',
    kind: 'barrier',
    name: 'I can’t find a full-time job',
    sentences: [{ text: 'Young people with qualifications describe years of part-time, unpaid or app work while they wait for a proper job.', from: ['sakura/1', 'moussa/1', 'chiamaka/2', 'arjun/1', 'ines/1', 'lucas/1'] }],
  },
  {
    key: 'morning',
    kind: 'day',
    name: 'Rinse, repeat',
    sentences: [{ text: 'Real days start early, often before five, and many include a long journey before work begins.', from: ['jack/1', 'otieno/1', 'awa/1', 'siti/1', 'haruto/1', 'mehmet/1'] }],
  },
  {
    key: 'goodday',
    kind: 'day',
    name: 'Nobody in a hurry',
    sentences: [
      { text: 'A good ordinary day is mostly modest: home in daylight, a steady job near family, sleep at night.', from: ['diego/3', 'maria/3', 'chiara/3', 'arjun/2', 'lakshmi/3'] },
      { text: 'Younger people picture work that uses what they studied, without dreading the end of the month.', from: ['lucas/3', 'chiamaka/3', 'fernanda/4'] },
    ],
  },
  {
    key: 'carecover',
    kind: 'idea',
    name: 'A day centre near home',
    sentences: [
      { text: 'People suggest day centres and visiting carers near home, at a price ordinary workers can pay.', from: ['lupita/3', 'wanjiru/3', 'giulia/3', 'ritu/3', 'ngozi/4'] },
      { text: 'Others ask for work that bends: care leave without fear, leave in hours, or later starts.', from: ['juergen/2', 'talia/3', 'pauline/3', 'denise/4'] },
    ],
  },
  {
    key: 'saferoads',
    kind: 'idea',
    name: 'Build the footbridge first',
    sentences: [{ text: 'People ask for simple fixes near schools: a footbridge, a traffic light, speed bumps, streetlights or closing the road at drop-off.', from: ['emeka/3', 'rocio/3', 'meena/4', 'sophie/2', 'achieng/4'] }],
  },
  {
    key: 'meet',
    kind: 'idea',
    name: 'Somewhere to make things and talk',
    sentences: [{ text: 'People suggest warm, free places to meet: a library, a coffee morning, a community café, a shed.', from: ['graham/3', 'linda/2', 'bernard/2', 'margaret/4'] }],
  },
  {
    key: 'closer',
    kind: 'idea',
    name: 'The roads would breathe',
    sentences: [{ text: 'People suggest working or studying nearer home some days, or buses that run when people work.', from: ['tunde/4', 'ravi/4', 'dewi/3', 'marcus/4'] }],
  },
  {
    key: 'startup',
    kind: 'idea',
    name: 'Small loans for young people',
    sentences: [{ text: 'In Senegal, people suggest small loans and savings clubs so people can start a trade or buy equipment together.', from: ['moussa/4', 'awa/4'] }],
  },
];

/** The open-listening theme the AI-and-care assembly was opened to answer. */
export const OPEN_CARE_THEME_KEY = 'care';
