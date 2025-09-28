// Simple weekly quote service; cycles through a local list deterministically by ISO week
export type Quote = { id?: number; text: string; author?: string; source?: string }

const QUOTES: Quote[] = [
    { text: 'Beginne, wo du bist. Nutze, was du hast. Tu, was du kannst.', author: 'Arthur Ashe' }, // KW 1
    { text: 'Das Leben ist kein Problem, das gelöst werden muss, sondern eine Wirklichkeit, die erfahren werden will.', author: 'Søren Kierkegaard' }, // KW 2
    { text: 'Wer immer tut, was er schon kann, bleibt immer das, was er schon ist.', author: 'Henry Ford' }, // KW 3
    { text: 'Zwischen Reiz und Reaktion liegt ein Raum. In diesem Raum liegt unsere Macht zur Wahl.', author: 'Viktor Frankl' }, // KW 4
    { text: 'Nicht weil es schwer ist, wagen wir es nicht. Weil wir es nicht wagen, ist es schwer.', author: 'Seneca' }, // KW 5
    { text: 'Die Freiheit des Menschen liegt nicht darin, dass er tun kann, was er will, sondern dass er nicht tun muss, was er nicht will.', author: 'Jean-Jacques Rousseau' }, // KW 6
    { text: 'Handle stets so, dass die Maxime deines Handelns zugleich Grundlage einer allgemeinen Gesetzgebung sein könnte.', author: 'Immanuel Kant' }, // KW 7
    { text: 'Die größte Offenbarung ist die Stille.', author: 'Laozi' }, // KW 8
    { text: 'Der Sinn des Lebens besteht nicht darin, ein erfolgreicher Mensch zu sein, sondern ein wertvoller.', author: 'Albert Einstein' }, // KW 9
    { text: 'Was du bist, zeigt sich in dem, was du tust.', author: 'Thomas von Aquin' }, // KW 10
    { text: 'Die Welt ist nicht so, wie sie ist. Sie ist so, wie wir sie sehen.', author: 'Anaïs Nin' }, // KW 11
    { text: 'Nur wer sich ändert, bleibt sich treu.', author: 'Wolf Biermann' }, // KW 12
    { text: 'Das Gegenteil von Spiel ist nicht Ernst, sondern Zwang.', author: 'Friedrich Schiller' }, // KW 13
    { text: 'Die Seele ernährt sich von dem, worüber sie sich freut.', author: 'Augustinus' }, // KW 14
    { text: 'Es ist nicht wenig Zeit, die wir haben, sondern viel Zeit, die wir nicht nutzen.', author: 'Seneca' }, // KW 15
    { text: 'Wer hohe Türme bauen will, muss lange beim Fundament verweilen.', author: 'Anton Bruckner' }, // KW 16
    { text: 'Die beste Zeit, einen Baum zu pflanzen, war vor 20 Jahren. Die zweitbeste ist jetzt.', author: 'Chinesisches Sprichwort' }, // KW 17
    { text: 'Man sieht nur mit dem Herzen gut. Das Wesentliche ist für die Augen unsichtbar.', author: 'Antoine de Saint-Exupéry' }, // KW 18
    { text: 'Die Wahrheit ist dem Menschen zumutbar.', author: 'Ingeborg Bachmann' }, // KW 19
    { text: 'Wenn du schnell gehen willst, geh allein. Wenn du weit kommen willst, geh gemeinsam.', author: 'Afrikanisches Sprichwort' }, // KW 20
    { text: 'Die Grenzen meiner Sprache bedeuten die Grenzen meiner Welt.', author: 'Ludwig Wittgenstein' }, // KW 21
    { text: 'Wer nicht weiß, wohin er will, darf sich nicht wundern, wenn er ganz woanders ankommt.', author: 'Mark Twain' }, // KW 22
    { text: 'Das Denken ist das Gespräch der Seele mit sich selbst.', author: 'Platon' }, // KW 23
    { text: 'Die Zukunft gehört denen, die an die Schönheit ihrer Träume glauben.', author: 'Eleanor Roosevelt' }, // KW 24
    { text: 'Jeder Mensch ist ein Abgrund. Es schwindelt einem, wenn man hinabsieht.', author: 'Georg Büchner' }, // KW 25
    { text: 'Die größte Gefahr im Leben ist, dass man zu vorsichtig wird.', author: 'Alfred Adler' }, // KW 26
    { text: 'Was wir wissen, ist ein Tropfen. Was wir nicht wissen, ein Ozean.', author: 'Isaac Newton' }, // KW 27
    { text: 'Die beste Art, sich selbst zu finden, ist, sich in den Dienst anderer zu stellen.', author: 'Mahatma Gandhi' }, // KW 28
    { text: 'Nicht der Gedanke zählt, sondern das Denken.', author: 'Hannah Arendt' }, // KW 29
    { text: 'Der Mensch ist zur Freiheit verurteilt.', author: 'Jean-Paul Sartre' }, // KW 30
    { text: 'Es gibt keine Fakten, nur Interpretationen.', author: 'Friedrich Nietzsche' }, // KW 31
    { text: 'Die größte Form des Mutes ist, sich selbst treu zu bleiben.', author: 'Søren Kierkegaard' }, // KW 32
    { text: 'Die Wirklichkeit ist nur ein Teil des Möglichen.', author: 'Friedrich Dürrenmatt' }, // KW 33
    { text: 'Die Kunst ist, einmal mehr aufzustehen, als man hingefallen ist.', author: 'Winston Churchill' }, // KW 34
    { text: 'Wer die Jugend erreicht, verändert die Zukunft.', author: 'Unbekannt' }, // KW 35
    { text: 'Das Spiel ist die höchste Form der Forschung.', author: 'Albert Einstein' }, // KW 36
    { text: 'Die Welt verändert sich durch dein Beispiel, nicht durch deine Meinung.', author: 'Paulo Coelho' }, // KW 37
    { text: 'Jeder Mensch trägt einen Zauber im Herzen, der ihn einzigartig macht.', author: 'Hermann Hesse' }, // KW 38
    { text: 'Die Frage ist nicht, was du willst, sondern was du bereit bist zu tun.', author: 'Unbekannt' }, // KW 39
    { text: 'Nur wer sich selbst kennt, kann andere verstehen.', author: 'Konfuzius' }, // KW 40
    { text: 'Die beste Bildung findet ein gescheiter Mensch auf Reisen.', author: 'Johann Wolfgang von Goethe' }, // KW 41
    { text: 'Die Zukunft ist schon da – sie ist nur ungleich verteilt.', author: 'William Gibson' }, // KW 42
    { text: 'Verstehen heißt nicht zustimmen. Aber ohne Verstehen gibt es keine Veränderung.', author: 'Unbekannt' }, // KW 43
    { text: 'Die größte Revolution beginnt im Inneren.', author: 'Unbekannt' }, // KW 44
    { text: 'Das Leben ist das, was passiert, während du andere Pläne machst.', author: 'John Lennon' }, // KW 45
    { text: 'Die Wahrheit beginnt zu zweit.', author: 'Martin Buber' }, // KW 46
    { text: 'Wer nicht neugierig ist, erfährt nichts.', author: 'Johann Wolfgang von Goethe' }, // KW 47
    { text: 'Die beste Antwort auf das Leben ist Kreativität.', author: 'Unbekannt' }, // KW 48
    { text: 'Jeder Tag ist ein neues Blatt – du entscheidest, was darauf steht.', author: 'Unbekannt' }, // KW 49
    { text: 'Die Würde des Menschen ist unantastbar – auch in Gedanken.', source: 'Erweiterung des Grundgesetzes' }, // KW 50
    { text: 'Das Licht scheint in der Dunkelheit, und die Dunkelheit hat es nicht erfasst.', source: 'Johannes 1,5' }, // KW 51
    { text: 'Und plötzlich weißt du: Es ist Zeit, etwas Neues zu beginnen und dem Zauber des Anfangs zu vertrauen.', author: 'Meister Eckhart' } // KW 52
]

function isoWeekIndex(d: Date): number {
    const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    // Thursday in current week decides the year
    const dayNr = (date.getUTCDay() + 6) % 7
    date.setUTCDate(date.getUTCDate() - dayNr + 3)
    const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
    const diff = date.getTime() - firstThursday.getTime()
    const week = 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000))
    return week
}

export function getWeeklyQuote(dateStr?: string): Quote {
    const d = dateStr ? new Date(dateStr) : new Date()
    const week = isoWeekIndex(d)
    const idx = ((week - 1) % 52 + 52) % 52
    const q = QUOTES[idx]
    return { ...q, id: idx + 1 }
}
