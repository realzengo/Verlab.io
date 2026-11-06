// Read-aloud scripts for the Clone a voice recorder, one set for every
// language a clone can be tagged with ("Automatic" reads the English set).
// Each set says the same three things in the same order, so the script on
// screen stays in step when the language or "Another script" changes. Each
// takes about 30-40 seconds to read, and none gives away the reader's
// gender: Hindi and Hebrew word the first-person script around their
// gendered verb forms, and second-person lines address the listener.
import type { CloneLanguage } from "./voices";

export interface CloneScriptSet {
  /** BCP 47 tag, so the browser picks the right fonts and line breaking (and screen readers the right voice). */
  lang: string;
  dir: "ltr" | "rtl";
  scripts: readonly [string, string, string];
}

const ltr = (lang: string, ...scripts: [string, string, string]): CloneScriptSet => ({ lang, dir: "ltr", scripts });
const rtl = (lang: string, ...scripts: [string, string, string]): CloneScriptSet => ({ lang, dir: "rtl", scripts });

const SCRIPTS: Record<Exclude<CloneLanguage, "Automatic">, CloneScriptSet> = {
  English: ltr(
    "en",
    "Every morning I take a few minutes to plan the day ahead. I check my messages, make a quick cup of coffee, and write down the three things that matter most. Some days go exactly to plan; others take a sharp turn before lunch. Either way, the small habits add up. A short walk clears my head, a good conversation can change my whole mood, and a little patience goes a long way.",
    "Imagine standing at the edge of a quiet harbor just before sunrise. The water is calm, the air smells of salt, and somewhere in the distance a bell is ringing. Fishing boats drift out one by one, their engines humming low and steady. Then the first light breaks over the hills, and the whole town seems to wake up at once. Shutters open, bicycles rattle over the cobblestones, and the day begins.",
    "So you want to grow an audience from scratch? Here's what actually works. First, pick one topic you could talk about for hours. Second, post consistently, not perfectly. Third, study the videos that do well and ask why: was it the hook, the pacing, or the story? Most creators quit right before things start to click. Don't be one of them. Keep testing, keep learning, and keep going."
  ),
  Spanish: ltr(
    "es",
    "Cada mañana me tomo unos minutos para planear el día. Reviso mis mensajes, me preparo un café rápido y anoto las tres cosas que más importan. Algunos días salen exactamente según lo previsto; otros dan un giro inesperado antes del almuerzo. De cualquier forma, los pequeños hábitos suman. Un paseo corto me despeja la cabeza, una buena conversación puede cambiarme el ánimo por completo y un poco de paciencia llega muy lejos.",
    "Imagina que estás al borde de un puerto tranquilo justo antes del amanecer. El agua está en calma, el aire huele a sal y, a lo lejos, suena una campana. Los barcos pesqueros salen uno a uno, con sus motores zumbando bajos y constantes. Entonces la primera luz asoma sobre las colinas y todo el pueblo parece despertar a la vez. Se abren las persianas, las bicicletas traquetean sobre los adoquines y empieza el día.",
    "¿Así que quieres crear una audiencia desde cero? Esto es lo que de verdad funciona. Primero, elige un tema del que podrías hablar durante horas. Segundo, publica con constancia, no con perfección. Tercero, estudia los videos que funcionan bien y pregúntate por qué: ¿fue el gancho, el ritmo o la historia? La mayoría de los creadores se rinden justo antes de que todo empiece a encajar. No seas uno de ellos. Sigue probando, sigue aprendiendo y sigue adelante."
  ),
  French: ltr(
    "fr",
    "Chaque matin, je prends quelques minutes pour organiser ma journée. Je consulte mes messages, je me prépare un café rapide et je note les trois choses les plus importantes. Certains jours se déroulent exactement comme prévu ; d'autres prennent un tournant inattendu avant le déjeuner. Dans tous les cas, les petites habitudes finissent par compter. Une courte promenade m'éclaircit les idées, une bonne conversation peut changer toute mon humeur, et un peu de patience mène loin.",
    "Imaginez-vous au bord d'un port tranquille, juste avant le lever du soleil. L'eau est calme, l'air sent le sel et, quelque part au loin, une cloche sonne. Les bateaux de pêche sortent un à un, leurs moteurs ronronnant doucement et régulièrement. Puis la première lumière apparaît sur les collines, et toute la ville semble se réveiller d'un coup. Les volets s'ouvrent, les vélos cliquettent sur les pavés, et la journée commence.",
    "Alors, vous voulez construire une audience à partir de zéro ? Voici ce qui marche vraiment. D'abord, choisissez un sujet dont vous pourriez parler pendant des heures. Ensuite, publiez régulièrement, pas parfaitement. Enfin, étudiez les vidéos qui marchent et demandez-vous pourquoi : était-ce l'accroche, le rythme ou l'histoire ? La plupart des créateurs abandonnent juste avant que tout se mette en place. Ne faites pas comme eux. Continuez à tester, continuez à apprendre, et continuez d'avancer."
  ),
  German: ltr(
    "de",
    "Jeden Morgen nehme ich mir ein paar Minuten Zeit, um den Tag zu planen. Ich checke meine Nachrichten, mache mir schnell einen Kaffee und schreibe die drei wichtigsten Dinge auf. Manche Tage laufen genau nach Plan, andere nehmen schon vor dem Mittagessen eine überraschende Wendung. So oder so: Die kleinen Gewohnheiten summieren sich. Ein kurzer Spaziergang macht mir den Kopf frei, ein gutes Gespräch kann meine ganze Stimmung verändern, und ein wenig Geduld bringt einen weit.",
    "Stell dir vor, du stehst kurz vor Sonnenaufgang am Rand eines stillen Hafens. Das Wasser ist ruhig, die Luft riecht nach Salz, und irgendwo in der Ferne läutet eine Glocke. Die Fischerboote fahren eines nach dem anderen hinaus, ihre Motoren brummen leise und gleichmäßig. Dann bricht das erste Licht über die Hügel, und die ganze Stadt scheint auf einmal aufzuwachen. Fensterläden öffnen sich, Fahrräder rattern über das Kopfsteinpflaster, und der Tag beginnt.",
    "Du willst also von null an ein Publikum aufbauen? Das hier funktioniert wirklich. Erstens: Such dir ein Thema aus, über das du stundenlang reden könntest. Zweitens: Poste regelmäßig, nicht perfekt. Drittens: Schau dir die Videos an, die gut laufen, und frag dich, warum. War es der Einstieg, das Tempo oder die Geschichte? Die meisten Creator geben auf, kurz bevor es richtig losgeht. Mach es nicht wie sie. Teste weiter, lerne weiter und mach weiter."
  ),
  Italian: ltr(
    "it",
    "Ogni mattina mi prendo qualche minuto per organizzare la giornata. Controllo i messaggi, mi preparo un caffè veloce e scrivo le tre cose più importanti. Alcuni giorni vanno esattamente come previsto; altri prendono una piega inaspettata prima di pranzo. In ogni caso, le piccole abitudini fanno la differenza. Una breve passeggiata mi schiarisce le idee, una bella conversazione può cambiarmi completamente l'umore e un po' di pazienza porta lontano.",
    "Immagina di trovarti sul bordo di un porto silenzioso, poco prima dell'alba. L'acqua è calma, l'aria sa di sale e, da qualche parte in lontananza, suona una campana. Le barche da pesca escono una dopo l'altra, con i motori che ronzano bassi e costanti. Poi la prima luce spunta sopra le colline e tutto il paese sembra svegliarsi all'improvviso. Le persiane si aprono, le biciclette sobbalzano sui ciottoli e la giornata comincia.",
    "Quindi vuoi costruire un pubblico da zero? Ecco cosa funziona davvero. Primo, scegli un argomento di cui potresti parlare per ore. Secondo, pubblica con costanza, non con perfezione. Terzo, studia i video che vanno bene e chiediti perché: è stato l'aggancio, il ritmo o la storia? La maggior parte dei creator molla proprio prima che le cose inizino a girare. Non fare come loro. Continua a provare, continua a imparare e vai avanti."
  ),
  Portuguese: ltr(
    "pt",
    "Toda manhã eu tiro alguns minutos para planejar o dia. Confiro minhas mensagens, preparo um café rápido e anoto as três coisas mais importantes. Alguns dias saem exatamente como planejado; outros mudam de rumo antes do almoço. De qualquer forma, os pequenos hábitos fazem diferença. Uma caminhada curta clareia minha mente, uma boa conversa pode mudar todo o meu humor e um pouco de paciência leva longe.",
    "Imagine-se na beira de um porto tranquilo, pouco antes do nascer do sol. A água está calma, o ar tem cheiro de sal e, em algum lugar ao longe, um sino está tocando. Os barcos de pesca saem um a um, com os motores zumbindo baixo e constante. Então a primeira luz surge sobre as colinas, e a cidade inteira parece acordar de uma vez. As janelas se abrem, as bicicletas chacoalham sobre as pedras da rua, e o dia começa.",
    "Então você quer construir uma audiência do zero? Veja o que realmente funciona. Primeiro, escolha um assunto sobre o qual você conseguiria falar por horas. Segundo, publique com constância, não com perfeição. Terceiro, estude os vídeos que vão bem e pergunte por quê: foi o gancho, o ritmo ou a história? A maioria dos criadores desiste logo antes de as coisas começarem a dar certo. Não faça como eles. Continue testando, continue aprendendo e siga em frente."
  ),
  Dutch: ltr(
    "nl",
    "Elke ochtend neem ik een paar minuten om de dag te plannen. Ik check mijn berichten, zet snel een kop koffie en schrijf de drie belangrijkste dingen op. Sommige dagen lopen precies volgens plan; andere nemen al voor de lunch een onverwachte wending. Hoe dan ook, kleine gewoontes tellen op. Een korte wandeling maakt mijn hoofd leeg, een goed gesprek kan mijn hele humeur veranderen, en met een beetje geduld kom je ver.",
    "Stel je voor dat je vlak voor zonsopgang aan de rand van een stille haven staat. Het water is kalm, de lucht ruikt naar zout en ergens in de verte luidt een bel. Vissersboten varen een voor een uit, hun motoren brommen laag en gelijkmatig. Dan breekt het eerste licht door boven de heuvels en lijkt het hele stadje tegelijk wakker te worden. Luiken gaan open, fietsen ratelen over de kinderkopjes en de dag begint.",
    "Dus je wilt vanaf nul een publiek opbouwen? Dit is wat echt werkt. Kies eerst één onderwerp waar je urenlang over zou kunnen praten. Post daarna regelmatig, niet perfect. En bestudeer ten slotte de video's die goed scoren en vraag je af waarom: was het de hook, het tempo of het verhaal? De meeste makers haken af vlak voordat het begint te lopen. Doe het niet zoals zij. Blijf testen, blijf leren en ga door."
  ),
  Polish: ltr(
    "pl",
    "Każdego ranka poświęcam kilka minut na zaplanowanie dnia. Sprawdzam wiadomości, robię szybką kawę i zapisuję trzy najważniejsze rzeczy. Niektóre dni idą dokładnie zgodnie z planem, inne przybierają nieoczekiwany obrót jeszcze przed obiadem. Tak czy inaczej, drobne nawyki się sumują. Krótki spacer oczyszcza mi głowę, dobra rozmowa potrafi całkowicie zmienić mój nastrój, a odrobina cierpliwości bardzo wiele daje.",
    "Wyobraź sobie, że stoisz na skraju cichego portu tuż przed wschodem słońca. Woda jest spokojna, powietrze pachnie solą, a gdzieś w oddali dzwoni dzwon. Łodzie rybackie wypływają jedna po drugiej, a ich silniki mruczą nisko i równo. Potem pierwsze światło przebija się nad wzgórzami i całe miasteczko jakby budzi się naraz. Otwierają się okiennice, rowery turkoczą po bruku i zaczyna się dzień.",
    "Chcesz zbudować widownię od zera? Oto, co naprawdę działa. Po pierwsze, wybierz jeden temat, o którym możesz mówić godzinami. Po drugie, publikuj regularnie, a nie perfekcyjnie. Po trzecie, analizuj filmy, które dobrze sobie radzą, i pytaj, dlaczego: czy to był haczyk, tempo, czy historia? Większość twórców rezygnuje tuż przed tym, jak wszystko zaczyna działać. Nie rób tak jak oni. Testuj dalej, ucz się dalej i idź naprzód."
  ),
  Russian: ltr(
    "ru",
    "Каждое утро я трачу несколько минут, чтобы спланировать день. Проверяю сообщения, быстро варю кофе и записываю три самых важных дела. Некоторые дни идут точно по плану, а другие делают неожиданный поворот ещё до обеда. Так или иначе, маленькие привычки складываются в большое. Короткая прогулка проясняет голову, хороший разговор может полностью изменить настроение, а немного терпения творит чудеса.",
    "Представьте, что вы стоите на краю тихой гавани незадолго до рассвета. Вода спокойна, воздух пахнет солью, а где-то вдалеке звонит колокол. Рыбацкие лодки одна за другой выходят в море, их моторы гудят низко и ровно. Затем над холмами пробивается первый свет, и весь городок будто просыпается разом. Открываются ставни, велосипеды грохочут по брусчатке, и начинается день.",
    "Хотите собрать аудиторию с нуля? Вот что действительно работает. Во-первых, выберите одну тему, о которой могли бы говорить часами. Во-вторых, публикуйте регулярно, а не идеально. В-третьих, изучайте видео, которые хорошо заходят, и спрашивайте себя почему: дело в зацепке, темпе или истории? Большинство авторов сдаются прямо перед тем, как всё начинает получаться. Не повторяйте их ошибку. Продолжайте пробовать, продолжайте учиться и двигайтесь дальше."
  ),
  Ukrainian: ltr(
    "uk",
    "Щоранку я витрачаю кілька хвилин, щоб спланувати день. Перевіряю повідомлення, швидко готую каву й записую три найважливіші справи. Деякі дні йдуть точно за планом, а інші роблять несподіваний поворот ще до обіду. Так чи інакше, маленькі звички складаються в щось більше. Коротка прогулянка прояснює думки, хороша розмова може повністю змінити настрій, а трохи терпіння творить дива.",
    "Уявіть, що ви стоїте на краю тихої гавані незадовго до світанку. Вода спокійна, повітря пахне сіллю, а десь удалині дзвонить дзвін. Рибальські човни один за одним виходять у море, їхні мотори гудуть низько й рівно. Потім над пагорбами пробивається перше світло, і все містечко ніби прокидається водночас. Відчиняються віконниці, велосипеди торохтять по бруківці, і починається день.",
    "Хочете зібрати аудиторію з нуля? Ось що справді працює. По-перше, оберіть одну тему, про яку могли б говорити годинами. По-друге, публікуйте регулярно, а не ідеально. По-третє, вивчайте відео, які добре заходять, і питайте себе чому: річ у гачку, темпі чи історії? Більшість авторів здаються саме тоді, коли все от-от почне виходити. Не повторюйте їхньої помилки. Пробуйте далі, навчайтеся далі й рухайтеся вперед."
  ),
  Turkish: ltr(
    "tr",
    "Her sabah günü planlamak için birkaç dakika ayırırım. Mesajlarımı kontrol eder, hızlıca bir kahve yapar ve en önemli üç işi not ederim. Bazı günler tam planlandığı gibi geçer; bazıları ise öğle yemeğinden önce beklenmedik bir yöne döner. Her iki durumda da küçük alışkanlıklar birikir. Kısa bir yürüyüş kafamı toplar, güzel bir sohbet bütün ruh halimi değiştirebilir ve biraz sabır insanı çok uzağa götürür.",
    "Gün doğmadan hemen önce sessiz bir limanın kenarında durduğunu hayal et. Su sakin, hava tuz kokuyor ve uzaklarda bir yerde bir çan çalıyor. Balıkçı tekneleri birer birer açılıyor, motorları alçak ve düzenli bir sesle uğulduyor. Sonra ilk ışık tepelerin üzerinden yükseliyor ve bütün kasaba sanki aynı anda uyanıyor. Panjurlar açılıyor, bisikletler parke taşlarının üzerinde takırdıyor ve gün başlıyor.",
    "Demek sıfırdan bir kitle oluşturmak istiyorsun? İşte gerçekten işe yarayan şey. Birincisi, saatlerce konuşabileceğin tek bir konu seç. İkincisi, mükemmel değil, düzenli paylaş. Üçüncüsü, iyi performans gösteren videoları incele ve nedenini sor: giriş miydi, tempo mu, yoksa hikâye mi? Çoğu içerik üreticisi işler tam yoluna girmeden önce bırakır. Onlardan biri olma. Denemeye devam et, öğrenmeye devam et ve yoluna devam et."
  ),
  Arabic: rtl(
    "ar",
    "كل صباح، أخصص بضع دقائق للتخطيط لليوم. أتفقد رسائلي، وأحضّر فنجان قهوة سريعًا، وأكتب أهم ثلاثة أشياء. بعض الأيام تسير تمامًا كما خططت، وبعضها يتغير مساره فجأة قبل الغداء. وفي كلتا الحالتين، العادات الصغيرة تتراكم. نزهة قصيرة تصفّي ذهني، ومحادثة جيدة قد تغيّر مزاجي بالكامل، وقليل من الصبر يصنع فرقًا كبيرًا.",
    "تخيّل أنك تقف على حافة ميناء هادئ قبيل شروق الشمس. الماء ساكن، والهواء تفوح منه رائحة الملح، ومن مكان ما في البعيد يرنّ جرس. تخرج قوارب الصيد واحدًا تلو الآخر، ومحركاتها تهمهم بصوت منخفض وثابت. ثم يبزغ أول ضوء فوق التلال، وكأن البلدة كلها تستيقظ دفعة واحدة. تُفتح النوافذ، وتهتز الدراجات فوق الحجارة المرصوفة، ويبدأ النهار.",
    "إذن تريد بناء جمهور من الصفر؟ إليك ما ينجح فعلًا. أولًا، اختر موضوعًا واحدًا يمكنك أن تتحدث عنه لساعات. ثانيًا، انشر باستمرار، لا بكمال. ثالثًا، ادرس الفيديوهات الناجحة واسأل لماذا: هل كانت البداية، أم الإيقاع، أم القصة؟ معظم صنّاع المحتوى يستسلمون قبل أن تبدأ الأمور بالنجاح مباشرة. لا تكن واحدًا منهم. استمر في التجربة، واستمر في التعلم، وواصل الطريق."
  ),
  Hindi: ltr(
    "hi",
    "हर सुबह दिन की योजना बनाने के लिए कुछ मिनट निकालना मेरी आदत है। सबसे पहले मैसेज देखना, जल्दी से एक कप कॉफ़ी बनाना, और तीन सबसे ज़रूरी काम लिख लेना। कुछ दिन बिल्कुल योजना के मुताबिक चलते हैं, तो कुछ दोपहर के खाने से पहले ही अचानक मोड़ ले लेते हैं। जो भी हो, छोटी-छोटी आदतें मिलकर बड़ा फ़र्क लाती हैं। थोड़ी सैर से दिमाग़ साफ़ हो जाता है, एक अच्छी बातचीत पूरा मूड बदल सकती है, और थोड़ा धैर्य बहुत काम आता है।",
    "कल्पना कीजिए कि सूरज उगने से ठीक पहले आप एक शांत बंदरगाह के किनारे खड़े हैं। पानी शांत है, हवा में नमक की महक है, और कहीं दूर एक घंटी बज रही है। मछुआरों की नावें एक-एक करके निकल रही हैं, उनके इंजन धीमी और लगातार आवाज़ में गुनगुना रहे हैं। फिर पहाड़ियों के ऊपर पहली रोशनी फूटती है, और पूरा कस्बा जैसे एक साथ जाग उठता है। खिड़कियाँ खुलती हैं, पत्थर की गलियों पर साइकिलें खड़खड़ाती हैं, और दिन शुरू हो जाता है।",
    "तो आप ज़ीरो से ऑडियंस बनाना चाहते हैं? ये तरीके सच में काम करते हैं। पहला, कोई एक ऐसा विषय चुनिए जिस पर आप घंटों बात कर सकें। दूसरा, लगातार पोस्ट कीजिए, परफ़ेक्ट होने की चिंता मत कीजिए। तीसरा, जो वीडियो अच्छे चल रहे हैं उन्हें ध्यान से देखिए और पूछिए क्यों: क्या वह शुरुआत थी, रफ़्तार थी, या कहानी? ज़्यादातर क्रिएटर ठीक उसी वक़्त हार मान लेते हैं जब चीज़ें बनने ही वाली होती हैं। उनकी तरह हार मत मानिए। कोशिश करते रहिए, सीखते रहिए, और आगे बढ़ते रहिए।"
  ),
  Indonesian: ltr(
    "id",
    "Setiap pagi saya meluangkan beberapa menit untuk merencanakan hari. Saya memeriksa pesan, membuat secangkir kopi dengan cepat, dan menuliskan tiga hal yang paling penting. Ada hari yang berjalan persis sesuai rencana; ada juga yang tiba-tiba berubah arah sebelum makan siang. Apa pun yang terjadi, kebiasaan kecil itu terus bertambah. Jalan kaki sebentar menjernihkan pikiran saya, obrolan yang menyenangkan bisa mengubah seluruh suasana hati, dan sedikit kesabaran membawa kita jauh.",
    "Bayangkan kamu berdiri di tepi pelabuhan yang sunyi, sesaat sebelum matahari terbit. Airnya tenang, udaranya beraroma garam, dan di kejauhan sebuah lonceng berbunyi. Perahu-perahu nelayan berangkat satu per satu, mesinnya berdengung pelan dan stabil. Lalu cahaya pertama muncul di atas perbukitan, dan seluruh kota seolah terbangun bersamaan. Jendela-jendela terbuka, sepeda berderak di atas jalan berbatu, dan hari pun dimulai.",
    "Jadi kamu mau membangun audiens dari nol? Ini yang benar-benar berhasil. Pertama, pilih satu topik yang bisa kamu bicarakan berjam-jam. Kedua, unggah secara konsisten, bukan sempurna. Ketiga, pelajari video yang performanya bagus dan tanyakan kenapa: apakah karena pembukanya, temponya, atau ceritanya? Kebanyakan kreator menyerah tepat sebelum semuanya mulai berhasil. Jangan jadi salah satunya. Terus mencoba, terus belajar, dan terus melangkah."
  ),
  Vietnamese: ltr(
    "vi",
    "Mỗi sáng, tôi dành vài phút để lên kế hoạch cho ngày mới. Tôi kiểm tra tin nhắn, pha nhanh một tách cà phê và ghi lại ba việc quan trọng nhất. Có những ngày diễn ra đúng như kế hoạch; cũng có những ngày rẽ sang hướng khác ngay trước bữa trưa. Dù thế nào đi nữa, những thói quen nhỏ cũng sẽ tích lũy dần. Một chuyến đi bộ ngắn giúp đầu óc tôi thông thoáng, một cuộc trò chuyện vui có thể thay đổi cả tâm trạng, và một chút kiên nhẫn sẽ đưa ta đi rất xa.",
    "Hãy tưởng tượng bạn đang đứng bên một bến cảng yên tĩnh, ngay trước lúc bình minh. Mặt nước phẳng lặng, không khí thoang thoảng mùi muối biển, và đâu đó xa xa vang lên tiếng chuông. Những chiếc thuyền đánh cá lần lượt ra khơi, tiếng động cơ rì rầm trầm và đều. Rồi tia nắng đầu tiên ló lên trên những ngọn đồi, và cả thị trấn như bừng tỉnh cùng một lúc. Những cánh cửa sổ mở ra, xe đạp lạch cạch trên con đường lát đá, và một ngày mới bắt đầu.",
    "Bạn muốn xây dựng khán giả từ con số không? Đây là những gì thực sự hiệu quả. Thứ nhất, hãy chọn một chủ đề mà bạn có thể nói hàng giờ liền. Thứ hai, đăng bài đều đặn, không cần hoàn hảo. Thứ ba, nghiên cứu những video làm tốt và tự hỏi tại sao: là nhờ phần mở đầu, nhịp độ hay câu chuyện? Hầu hết nhà sáng tạo bỏ cuộc ngay trước khi mọi thứ bắt đầu thành công. Đừng là một trong số họ. Hãy tiếp tục thử, tiếp tục học hỏi và tiếp tục tiến lên."
  ),
  Thai: ltr(
    "th",
    "ทุกเช้าจะใช้เวลาสักสองสามนาทีวางแผนสำหรับวันใหม่ เช็กข้อความ ชงกาแฟแก้วด่วน แล้วจดสามเรื่องที่สำคัญที่สุดเอาไว้ บางวันก็เป็นไปตามแผนทุกอย่าง บางวันก็เปลี่ยนทิศทางกะทันหันตั้งแต่ก่อนมื้อเที่ยง ไม่ว่าจะเป็นแบบไหน นิสัยเล็ก ๆ ก็ค่อย ๆ สะสมกันไป การเดินเล่นสั้น ๆ ช่วยให้หัวโล่ง บทสนทนาดี ๆ เปลี่ยนอารมณ์ได้ทั้งวัน และความอดทนเพียงเล็กน้อยก็พาไปได้ไกล",
    "ลองนึกภาพว่าคุณยืนอยู่ริมท่าเรือที่เงียบสงบ ก่อนพระอาทิตย์ขึ้นเพียงครู่เดียว น้ำนิ่งสงบ อากาศมีกลิ่นเกลือ และที่ไหนสักแห่งไกลออกไปมีเสียงระฆังดังขึ้น เรือประมงทยอยออกไปทีละลำ เสียงเครื่องยนต์ครางต่ำและสม่ำเสมอ แล้วแสงแรกของวันก็สาดขึ้นเหนือเนินเขา ทั้งเมืองเหมือนตื่นขึ้นพร้อมกัน บานหน้าต่างเปิดออก จักรยานแล่นบนถนนหินดังกึกกัก และวันใหม่ก็เริ่มต้นขึ้น",
    "อยากสร้างผู้ติดตามตั้งแต่ศูนย์ใช่ไหม นี่คือสิ่งที่ได้ผลจริง ๆ อย่างแรก เลือกหัวข้อเดียวที่คุณพูดได้เป็นชั่วโมง อย่างที่สอง โพสต์อย่างสม่ำเสมอ ไม่ต้องสมบูรณ์แบบ อย่างที่สาม ศึกษาวิดีโอที่ไปได้ดีแล้วถามตัวเองว่าทำไม เป็นเพราะช่วงเปิด จังหวะ หรือเรื่องราว ครีเอเตอร์ส่วนใหญ่ยอมแพ้ก่อนที่ทุกอย่างจะเริ่มเข้าที่เพียงนิดเดียว อย่าเป็นหนึ่งในนั้น ลองต่อไป เรียนรู้ต่อไป และเดินหน้าต่อไป"
  ),
  Japanese: ltr(
    "ja",
    "毎朝、私は数分かけてその日の予定を立てます。メッセージを確認して、さっとコーヒーを入れ、いちばん大事なことを三つ書き出します。予定どおりに進む日もあれば、お昼前に思わぬ方向へ転がる日もあります。どちらにしても、小さな習慣は積み重なっていきます。少し散歩をすると頭がすっきりするし、いい会話ひとつで気分ががらりと変わることもあります。そして、ほんの少しの忍耐が大きな力になるのです。",
    "日の出の少し前、静かな港のほとりに立っているところを想像してみてください。水面は穏やかで、空気は潮の香りがして、どこか遠くで鐘が鳴っています。漁船が一艘、また一艘と出ていき、エンジンが低く一定のリズムでうなっています。やがて最初の光が丘の上に差し込み、町全体がいっせいに目を覚ますようです。雨戸が開き、自転車が石畳の上をガタガタと走り、一日が始まります。",
    "ゼロからファンを増やしたいですか？本当に効果があるのはこれです。まず、何時間でも話せるテーマをひとつ選びましょう。次に、完璧さよりも継続を大事に投稿すること。そして、伸びている動画を研究して、その理由を考えてみてください。つかみなのか、テンポなのか、それともストーリーなのか。ほとんどのクリエイターは、うまくいき始める直前にやめてしまいます。その一人にならないでください。試し続け、学び続け、進み続けましょう。"
  ),
  Korean: ltr(
    "ko",
    "매일 아침 저는 몇 분 동안 하루 계획을 세웁니다. 메시지를 확인하고, 커피를 한 잔 빠르게 내린 다음, 가장 중요한 일 세 가지를 적어 둡니다. 어떤 날은 계획대로 흘러가고, 어떤 날은 점심 전에 예상치 못한 방향으로 바뀌기도 합니다. 어느 쪽이든 작은 습관은 쌓이기 마련입니다. 짧은 산책은 머리를 맑게 해 주고, 좋은 대화 한 번이 기분 전체를 바꿀 수 있으며, 약간의 인내심은 생각보다 큰 힘이 됩니다.",
    "해가 뜨기 직전, 고요한 항구 끝에 서 있다고 상상해 보세요. 물은 잔잔하고, 공기에서는 짠 바다 냄새가 나며, 저 멀리 어딘가에서 종소리가 울립니다. 고깃배들이 하나둘 바다로 나가고, 엔진 소리가 낮고 일정하게 웅웅거립니다. 그러다 첫 햇살이 언덕 위로 번지고, 온 마을이 한꺼번에 깨어나는 것 같습니다. 덧문이 열리고, 자전거가 돌길 위를 덜컹거리며 지나가고, 하루가 시작됩니다.",
    "처음부터 구독자를 모으고 싶으신가요? 실제로 효과가 있는 방법은 이렇습니다. 첫째, 몇 시간이고 이야기할 수 있는 주제 하나를 고르세요. 둘째, 완벽하게가 아니라 꾸준하게 올리세요. 셋째, 반응이 좋은 영상을 분석하고 이유를 물어보세요. 도입부였을까요, 속도감이었을까요, 아니면 이야기였을까요? 대부분의 크리에이터는 일이 풀리기 직전에 포기합니다. 그중 한 명이 되지 마세요. 계속 시도하고, 계속 배우고, 계속 나아가세요."
  ),
  Chinese: ltr(
    "zh-Hans",
    "每天早上，我都会花几分钟规划一天的安排。我会查看消息，快速冲一杯咖啡，然后写下最重要的三件事。有些日子完全按计划进行，有些日子还没到午饭就突然转了个弯。无论如何，小习惯都会慢慢积累起来。短短的散步能让我头脑清醒，一次愉快的谈话能改变我一整天的心情，而一点点耐心往往能走得很远。",
    "想象一下，日出前不久，你站在一个安静的港口边。海面平静，空气中带着咸咸的味道，远处的某个地方传来钟声。渔船一艘接一艘地驶出港口，发动机发出低沉而平稳的嗡嗡声。接着，第一缕阳光越过山丘，整个小镇仿佛一下子醒了过来。百叶窗被推开，自行车在石板路上咯噔作响，新的一天开始了。",
    "想从零开始积累粉丝吗？下面这些方法真正有效。第一，选一个你能聊上好几个小时的话题。第二，坚持发布，不必追求完美。第三，研究那些表现好的视频，问问自己为什么：是开头抓人、节奏紧凑，还是故事动人？大多数创作者都在快要成功之前放弃了。别成为他们中的一员。继续尝试，继续学习，继续前进。"
  ),
  Cantonese: ltr(
    "yue-Hant",
    "每朝我都會用幾分鐘計劃吓今日要做嘅嘢。我會睇吓訊息，快手沖杯咖啡，然後寫低最重要嘅三件事。有啲日子完全跟住計劃行，有啲日子未到晏晝就突然轉咗方向。無論點都好，啲小習慣會慢慢累積落嚟。出去散吓步可以令我個腦清醒啲，傾一次好偈可以改變成日嘅心情，而多少少耐性往往可以行得好遠。",
    "想像吓，就嚟日出嘅時候，你企喺一個好靜嘅海港邊。海面好平靜，空氣有陣鹹味，遠處唔知邊度傳嚟一陣鐘聲。啲漁船一隻接一隻咁出海，引擎聲低沉又穩定。跟住第一道陽光照過山頭，成個小鎮好似一下子醒晒。啲窗門打開，單車喺石板路上面嘎嘎聲咁行過，新嘅一日就開始喇。",
    "想由零開始儲粉絲？以下呢啲方法真係有用。第一，揀一個你可以講幾個鐘都唔悶嘅題目。第二，定時出片，唔使追求完美。第三，研究吓啲做得好嘅片，問吓自己點解：係開頭吸引、節奏好，定係個故事好？大部分創作者都喺就快成功之前放棄咗。唔好做佢哋其中一個。繼續試，繼續學，繼續行落去。"
  ),
  Romanian: ltr(
    "ro",
    "În fiecare dimineață îmi iau câteva minute ca să-mi planific ziua. Îmi verific mesajele, îmi fac repede o cafea și notez cele trei lucruri care contează cel mai mult. Unele zile merg exact după plan; altele o iau pe neașteptate în altă direcție înainte de prânz. Oricum ar fi, obiceiurile mici se adună. O plimbare scurtă îmi limpezește mintea, o conversație bună îmi poate schimba complet starea de spirit, iar puțină răbdare te duce departe.",
    "Imaginează-ți că stai pe marginea unui port liniștit, chiar înainte de răsărit. Apa e calmă, aerul miroase a sare și, undeva în depărtare, bate un clopot. Bărcile de pescuit ies una câte una, cu motoarele torcând jos și egal. Apoi prima lumină se ivește peste dealuri, iar tot orășelul pare să se trezească deodată. Obloanele se deschid, bicicletele zdrăngăne pe caldarâm, și ziua începe.",
    "Deci vrei să-ți construiești un public de la zero? Iată ce funcționează cu adevărat. În primul rând, alege un subiect despre care poți vorbi ore întregi. În al doilea rând, postează constant, nu perfect. În al treilea rând, studiază videoclipurile care merg bine și întreabă-te de ce: a fost începutul, ritmul sau povestea? Cei mai mulți creatori renunță chiar înainte ca lucrurile să înceapă să meargă. Nu face ca ei. Continuă să încerci, continuă să înveți și mergi mai departe."
  ),
  Greek: ltr(
    "el",
    "Κάθε πρωί αφιερώνω λίγα λεπτά για να οργανώσω τη μέρα μου. Ελέγχω τα μηνύματά μου, φτιάχνω στα γρήγορα έναν καφέ και γράφω τα τρία πιο σημαντικά πράγματα. Κάποιες μέρες κυλούν ακριβώς όπως τις σχεδίασα· άλλες παίρνουν απρόσμενη τροπή πριν από το μεσημεριανό. Όπως και να 'χει, οι μικρές συνήθειες μετράνε. Μια σύντομη βόλτα μού καθαρίζει το μυαλό, μια καλή κουβέντα μπορεί να αλλάξει όλη μου τη διάθεση, και λίγη υπομονή πάει πολύ μακριά.",
    "Φαντάσου ότι στέκεσαι στην άκρη ενός ήσυχου λιμανιού, λίγο πριν την ανατολή. Το νερό είναι ήρεμο, ο αέρας μυρίζει αλάτι και κάπου μακριά χτυπάει μια καμπάνα. Τα ψαροκάικα βγαίνουν ένα ένα, με τις μηχανές τους να βουίζουν χαμηλά και σταθερά. Ύστερα το πρώτο φως ξεπροβάλλει πάνω από τους λόφους και όλη η πόλη μοιάζει να ξυπνάει μονομιάς. Τα παντζούρια ανοίγουν, τα ποδήλατα κροταλίζουν πάνω στο καλντερίμι, και η μέρα αρχίζει.",
    "Θέλεις λοιπόν να χτίσεις κοινό από το μηδέν; Αυτό είναι που πραγματικά δουλεύει. Πρώτον, διάλεξε ένα θέμα για το οποίο θα μπορούσες να μιλάς για ώρες. Δεύτερον, ανέβαζε με συνέπεια, όχι με τελειότητα. Τρίτον, μελέτησε τα βίντεο που πάνε καλά και αναρωτήσου γιατί: ήταν η αρχή, ο ρυθμός ή η ιστορία; Οι περισσότεροι δημιουργοί τα παρατάνε λίγο πριν αρχίσουν να πηγαίνουν καλά τα πράγματα. Μην κάνεις το ίδιο. Συνέχισε να δοκιμάζεις, συνέχισε να μαθαίνεις και προχώρα."
  ),
  Czech: ltr(
    "cs",
    "Každé ráno si dávám pár minut na plánování dne. Zkontroluju zprávy, rychle si uvařím kávu a zapíšu si tři nejdůležitější věci. Některé dny jdou přesně podle plánu, jiné se ještě před obědem nečekaně zvrtnou. Tak či tak, malé zvyky se sčítají. Krátká procházka mi vyčistí hlavu, dobrý rozhovor mi dokáže úplně změnit náladu a trocha trpělivosti člověka dovede daleko.",
    "Představ si, že stojíš na okraji tichého přístavu těsně před východem slunce. Voda je klidná, vzduch voní solí a někde v dálce zvoní zvon. Rybářské lodě vyplouvají jedna po druhé a jejich motory tiše a rovnoměrně vrní. Pak se nad kopci objeví první světlo a celé městečko jako by se probudilo najednou. Okenice se otevírají, kola drnčí po dlažebních kostkách a den začíná.",
    "Takže chceš vybudovat publikum od nuly? Tohle opravdu funguje. Zaprvé si vyber jedno téma, o kterém dokážeš mluvit hodiny. Zadruhé publikuj pravidelně, ne dokonale. Zatřetí studuj videa, která se daří, a ptej se proč: byl to úvod, tempo, nebo příběh? Většina tvůrců to vzdá těsně předtím, než se věci začnou dařit. Nedělej to jako oni. Zkoušej dál, uč se dál a pokračuj."
  ),
  Finnish: ltr(
    "fi",
    "Joka aamu otan muutaman minuutin päivän suunnitteluun. Tarkistan viestini, keitän nopeasti kupin kahvia ja kirjoitan ylös kolme tärkeintä asiaa. Jotkin päivät menevät täsmälleen suunnitelman mukaan, toiset ottavat yllättävän käänteen jo ennen lounasta. Joka tapauksessa pienet tavat kasautuvat. Lyhyt kävely selkeyttää ajatukset, hyvä keskustelu voi muuttaa koko mielialani, ja pienellä kärsivällisyydellä pääsee pitkälle.",
    "Kuvittele seisovasi hiljaisen sataman reunalla juuri ennen auringonnousua. Vesi on tyyni, ilma tuoksuu suolalta, ja jossain kaukana soi kello. Kalastusveneet lähtevät liikkeelle yksi kerrallaan, moottorit hurisevat matalasti ja tasaisesti. Sitten ensimmäinen valo nousee kukkuloiden ylle, ja koko kaupunki tuntuu heräävän kerralla. Ikkunaluukut avautuvat, polkupyörät kolisevat mukulakivillä, ja päivä alkaa.",
    "Haluatko siis kasvattaa yleisön tyhjästä? Tämä oikeasti toimii. Ensinnäkin valitse yksi aihe, josta voisit puhua tuntikausia. Toiseksi julkaise säännöllisesti, älä täydellisesti. Kolmanneksi tutki hyvin menestyviä videoita ja kysy miksi: oliko se alku, tempo vai tarina? Useimmat sisällöntuottajat luovuttavat juuri ennen kuin asiat alkavat loksahtaa paikoilleen. Älä ole yksi heistä. Jatka kokeilemista, jatka oppimista ja jatka eteenpäin."
  ),
  Swedish: ltr(
    "sv",
    "Varje morgon tar jag några minuter för att planera dagen. Jag kollar mina meddelanden, gör snabbt en kopp kaffe och skriver ner de tre viktigaste sakerna. Vissa dagar går precis enligt plan; andra tar en oväntad vändning redan före lunch. Hur som helst gör de små vanorna skillnad i längden. En kort promenad rensar huvudet, ett bra samtal kan förändra hela mitt humör, och lite tålamod räcker långt.",
    "Föreställ dig att du står vid kanten av en stilla hamn strax före soluppgången. Vattnet är lugnt, luften doftar salt och någonstans långt borta ringer en klocka. Fiskebåtarna glider ut en efter en, och motorerna surrar lågt och jämnt. Sedan bryter det första ljuset fram över kullarna, och hela staden tycks vakna på en gång. Fönsterluckor öppnas, cyklar skramlar över kullerstenarna och dagen börjar.",
    "Så du vill bygga en publik från noll? Här är det som faktiskt fungerar. Först: välj ett ämne som du skulle kunna prata om i timmar. Sedan: publicera regelbundet, inte perfekt. Till sist: studera videorna som går bra och fråga dig varför. Var det inledningen, tempot eller berättelsen? De flesta kreatörer ger upp precis innan det börjar lossna. Var inte en av dem. Fortsätt testa, fortsätt lära dig och fortsätt framåt."
  ),
  Danish: ltr(
    "da",
    "Hver morgen bruger jeg et par minutter på at planlægge dagen. Jeg tjekker mine beskeder, laver hurtigt en kop kaffe og skriver de tre vigtigste ting ned. Nogle dage går præcis efter planen; andre tager en uventet drejning allerede før frokost. Uanset hvad, så tæller de små vaner. En kort gåtur klarer hovedet, en god samtale kan ændre hele mit humør, og lidt tålmodighed rækker langt.",
    "Forestil dig, at du står ved kanten af en stille havn lige før solopgang. Vandet er roligt, luften dufter af salt, og et sted langt væk ringer en klokke. Fiskerbådene sejler ud én efter én, og motorerne summer lavt og jævnt. Så bryder det første lys frem over bakkerne, og hele byen ser ud til at vågne på én gang. Skodder åbnes, cykler rasler hen over brostenene, og dagen begynder.",
    "Så du vil opbygge et publikum fra bunden? Her er, hvad der virkelig virker. For det første: vælg ét emne, du kunne tale om i timevis. For det andet: post stabilt, ikke perfekt. For det tredje: studér de videoer, der klarer sig godt, og spørg hvorfor. Var det indledningen, tempoet eller historien? De fleste skabere giver op lige før, det begynder at lykkes. Vær ikke en af dem. Bliv ved med at teste, bliv ved med at lære, og bliv ved."
  ),
  Norwegian: ltr(
    "nb",
    "Hver morgen bruker jeg noen minutter på å planlegge dagen. Jeg sjekker meldingene mine, lager en rask kopp kaffe og skriver ned de tre viktigste tingene. Noen dager går helt etter planen; andre tar en uventet vending allerede før lunsj. Uansett blir de små vanene til noe stort over tid. En kort tur klarner hodet, en god samtale kan endre hele humøret mitt, og med litt tålmodighet kommer man langt.",
    "Se for deg at du står ved kanten av en stille havn like før soloppgang. Vannet er rolig, luften lukter salt, og et sted langt borte ringer en klokke. Fiskebåtene glir ut én etter én, og motorene durer lavt og jevnt. Så bryter det første lyset fram over åsene, og hele byen ser ut til å våkne på én gang. Skodder åpnes, sykler skrangler over brosteinen, og dagen begynner.",
    "Så du vil bygge et publikum fra bunnen av? Her er det som faktisk fungerer. For det første: velg ett tema du kunne snakket om i timevis. For det andre: publiser jevnlig, ikke perfekt. For det tredje: studer videoene som gjør det bra, og spør deg selv hvorfor. Var det åpningen, tempoet eller historien? De fleste skapere gir opp rett før det begynner å løsne. Ikke vær en av dem. Fortsett å teste, fortsett å lære, og fortsett fremover."
  ),
  Hungarian: ltr(
    "hu",
    "Minden reggel szánok néhány percet arra, hogy megtervezzem a napot. Megnézem az üzeneteimet, gyorsan főzök egy kávét, és felírom a három legfontosabb dolgot. Van, amikor minden pontosan a terv szerint alakul; máskor már ebéd előtt váratlan fordulatot vesz a nap. Akárhogy is, az apró szokások összeadódnak. Egy rövid séta kitisztítja a fejem, egy jó beszélgetés teljesen megváltoztathatja a hangulatomat, és egy kis türelem sokat számít.",
    "Képzeld el, hogy egy csendes kikötő szélén állsz, közvetlenül napfelkelte előtt. A víz nyugodt, a levegő sós illatú, és valahol a távolban megszólal egy harang. A halászhajók egymás után futnak ki, motorjuk mélyen és egyenletesen zúg. Aztán az első fény felbukkan a dombok fölött, és mintha az egész város egyszerre ébredne fel. Kinyílnak a zsalugáterek, a biciklik zörögve gurulnak a macskakövön, és elkezdődik a nap.",
    "Szóval a nulláról szeretnél közönséget építeni? Ez az, ami tényleg működik. Először is válassz egy témát, amiről órákig tudnál beszélni. Másodszor posztolj rendszeresen, nem tökéletesen. Harmadszor tanulmányozd a jól teljesítő videókat, és kérdezd meg magadtól, miért működnek: a kezdés, a tempó vagy a történet miatt? A legtöbb alkotó épp azelőtt adja fel, hogy a dolgok beindulnának. Ne légy egy közülük. Próbálkozz tovább, tanulj tovább, és haladj tovább."
  ),
  Bulgarian: ltr(
    "bg",
    "Всяка сутрин отделям няколко минути, за да планирам деня. Проверявам съобщенията си, правя си набързо кафе и записвам трите най-важни неща. Някои дни вървят точно по план, а други поемат неочаквана посока още преди обяд. Така или иначе, малките навици се натрупват. Кратката разходка ми прочиства главата, хубавият разговор може напълно да промени настроението ми, а малко търпение помага много.",
    "Представи си, че стоиш на ръба на тихо пристанище точно преди изгрев. Водата е спокойна, въздухът мирише на сол, а някъде в далечината бие камбана. Рибарските лодки излизат една по една, а моторите им бучат ниско и равномерно. После първата светлина пробива над хълмовете и целият град сякаш се събужда наведнъж. Капаците на прозорците се отварят, велосипедите тракат по калдъръма и денят започва.",
    "Значи искаш да изградиш аудитория от нулата? Ето какво наистина работи. Първо, избери една тема, за която можеш да говориш с часове. Второ, публикувай редовно, а не перфектно. Трето, изучавай видеата, които се справят добре, и се питай защо: заради началото, темпото или историята? Повечето създатели се отказват точно преди нещата да потръгнат. Не прави като тях. Продължавай да опитваш, продължавай да учиш и върви напред."
  ),
  Croatian: ltr(
    "hr",
    "Svako jutro odvojim nekoliko minuta da isplaniram dan. Provjerim poruke, na brzinu skuham kavu i zapišem tri najvažnije stvari. Neki dani idu točno po planu, a drugi već prije ručka krenu u neočekivanom smjeru. Kako god bilo, male navike se zbrajaju. Kratka šetnja mi razbistri glavu, dobar razgovor mi može potpuno promijeniti raspoloženje, a malo strpljenja vodi daleko.",
    "Zamisli da stojiš na rubu tihe luke, malo prije izlaska sunca. More je mirno, zrak miriše na sol, a negdje u daljini zvoni zvono. Ribarski brodovi isplovljavaju jedan za drugim, a motori im tiho i ravnomjerno bruje. Tada prvo svjetlo izbije iznad brežuljaka i cijeli gradić kao da se odjednom probudi. Škure se otvaraju, bicikli zveckaju po kamenom pločniku i dan počinje.",
    "Dakle, želiš izgraditi publiku od nule? Evo što stvarno funkcionira. Prvo, odaberi jednu temu o kojoj možeš pričati satima. Drugo, objavljuj redovito, a ne savršeno. Treće, proučavaj videozapise koji dobro prolaze i pitaj se zašto: je li to bio početak, tempo ili priča? Većina kreatora odustane baš prije nego što stvari počnu funkcionirati. Nemoj raditi kao oni. Nastavi pokušavati, nastavi učiti i nastavi dalje."
  ),
  Slovak: ltr(
    "sk",
    "Každé ráno si nájdem pár minút na plánovanie dňa. Skontrolujem si správy, rýchlo si uvarím kávu a zapíšem si tri najdôležitejšie veci. Niektoré dni idú presne podľa plánu, iné sa ešte pred obedom nečakane zvrtnú. Tak či onak, malé zvyky sa sčítavajú. Krátka prechádzka mi vyčistí hlavu, dobrý rozhovor mi dokáže úplne zmeniť náladu a trocha trpezlivosti človeka dovedie ďaleko.",
    "Predstav si, že stojíš na okraji tichého prístavu tesne pred východom slnka. Voda je pokojná, vzduch vonia soľou a niekde v diaľke zvoní zvon. Rybárske člny vyplávajú jeden za druhým a ich motory tlmene a rovnomerne vrčia. Potom sa nad kopcami objaví prvé svetlo a celé mestečko akoby sa zobudilo naraz. Okenice sa otvárajú, bicykle drnčia po dlažobných kockách a deň sa začína.",
    "Takže chceš vybudovať publikum od nuly? Toto naozaj funguje. Po prvé, vyber si jednu tému, o ktorej dokážeš hovoriť celé hodiny. Po druhé, zverejňuj pravidelne, nie dokonale. Po tretie, študuj videá, ktorým sa darí, a pýtaj sa prečo: bol to úvod, tempo alebo príbeh? Väčšina tvorcov to vzdá tesne predtým, než sa veci začnú dariť. Nerob to ako oni. Skúšaj ďalej, uč sa ďalej a pokračuj."
  ),
  Slovenian: ltr(
    "sl",
    "Vsako jutro si vzamem nekaj minut za načrtovanje dneva. Preverim sporočila, na hitro skuham kavo in zapišem tri najpomembnejše stvari. Nekateri dnevi gredo natanko po načrtu, drugi pa že pred kosilom nepričakovano zavijejo drugam. Tako ali drugače se majhne navade seštevajo. Kratek sprehod mi zbistri glavo, dober pogovor mi lahko popolnoma spremeni razpoloženje, malo potrpežljivosti pa človeka pripelje daleč.",
    "Predstavljaj si, da stojiš na robu tihega pristanišča tik pred sončnim vzhodom. Voda je mirna, zrak diši po soli, nekje v daljavi pa zvoni zvon. Ribiški čolni odplujejo eden za drugim, njihovi motorji brnijo nizko in enakomerno. Nato se nad griči prikaže prva svetloba in zdi se, da se celo mestece zbudi naenkrat. Polkna se odpirajo, kolesa ropotajo po tlakovcih in dan se začne.",
    "Torej želiš zgraditi občinstvo iz nič? Tukaj je, kar res deluje. Prvič, izberi eno temo, o kateri lahko govoriš ure in ure. Drugič, objavljaj redno, ne popolno. Tretjič, preučuj videoposnetke, ki so uspešni, in se vprašaj zakaj: je bil to uvod, tempo ali zgodba? Večina ustvarjalcev obupa tik preden se stvari začnejo premikati. Ne delaj kot oni. Preizkušaj naprej, uči se naprej in pojdi naprej."
  ),
  Hebrew: rtl(
    "he",
    "כל בוקר מתחיל אצלי בכמה דקות של תכנון היום. בדיקת הודעות, כוס קפה מהירה, ורשימה של שלושת הדברים החשובים ביותר. יש ימים שמתנהלים בדיוק לפי התוכנית, ויש ימים שמקבלים תפנית חדה עוד לפני הצהריים. כך או כך, ההרגלים הקטנים מצטברים. הליכה קצרה מנקה לי את הראש, שיחה טובה יכולה לשנות לי את כל מצב הרוח, וקצת סבלנות עושה הבדל גדול.",
    "דמיינו שאתם עומדים על שפת נמל שקט, רגע לפני הזריחה. המים רגועים, האוויר מריח ממלח, ואיפשהו במרחק מצלצל פעמון. סירות הדייגים יוצאות אחת אחרי השנייה, והמנועים שלהן מזמזמים נמוך ויציב. ואז האור הראשון מבצבץ מעל הגבעות, ונדמה שכל העיירה מתעוררת בבת אחת. התריסים נפתחים, אופניים מקרקשים על אבני המרצפת, והיום מתחיל.",
    "אז אתם רוצים לבנות קהל מאפס? הנה מה שבאמת עובד. קודם כול, תבחרו נושא אחד שהייתם יכולים לדבר עליו שעות. שנית, תפרסמו בעקביות, לא בשלמות. ושלישית, תלמדו את הסרטונים שמצליחים ותשאלו למה: האם זה היה הפתיח, הקצב או הסיפור? רוב היוצרים מוותרים ממש לפני שהדברים מתחילים להסתדר. אל תעשו כמוהם. תמשיכו לנסות, תמשיכו ללמוד ותמשיכו קדימה."
  ),
  Persian: rtl(
    "fa",
    "هر روز صبح چند دقیقه وقت می‌گذارم تا برنامه‌ی روزم را بچینم. پیام‌هایم را چک می‌کنم، یک فنجان قهوه‌ی سریع درست می‌کنم و سه کار مهمِ روز را یادداشت می‌کنم. بعضی روزها دقیقاً طبق برنامه پیش می‌روند و بعضی روزها پیش از ناهار مسیرشان ناگهان عوض می‌شود. در هر حال، عادت‌های کوچک کم‌کم جمع می‌شوند. یک پیاده‌روی کوتاه ذهنم را آرام می‌کند، یک گفت‌وگوی خوب می‌تواند کل حال‌وهوایم را عوض کند، و کمی صبر راه درازی را هموار می‌کند.",
    "تصور کن درست پیش از طلوع آفتاب، لب یک بندر آرام ایستاده‌ای. آب آرام است، هوا بوی نمک می‌دهد و جایی در دوردست زنگی به صدا درمی‌آید. قایق‌های ماهیگیری یکی‌یکی راه می‌افتند و موتورهایشان آرام و یکنواخت می‌غرند. بعد نخستین نور از پشت تپه‌ها سر می‌زند و انگار تمام شهر یک‌باره بیدار می‌شود. پنجره‌ها باز می‌شوند، دوچرخه‌ها روی سنگفرش تلق‌تلق می‌کنند و روز آغاز می‌شود.",
    "پس می‌خواهی از صفر مخاطب جذب کنی؟ این چیزی است که واقعاً جواب می‌دهد. اول، یک موضوع انتخاب کن که بتوانی ساعت‌ها درباره‌اش حرف بزنی. دوم، مرتب پست بگذار، نه بی‌نقص. سوم، ویدیوهایی را که خوب دیده می‌شوند بررسی کن و از خودت بپرس چرا: شروعش بود، ریتمش یا داستانش؟ بیشتر تولیدکنندگان محتوا درست قبل از اینکه کارها راه بیفتد، کنار می‌کشند. تو مثل آن‌ها نباش. به امتحان کردن ادامه بده، به یاد گرفتن ادامه بده و جلو برو."
  ),
  Malay: ltr(
    "ms",
    "Setiap pagi saya meluangkan beberapa minit untuk merancang hari. Saya menyemak mesej, membancuh secawan kopi dengan cepat, dan mencatat tiga perkara yang paling penting. Ada hari yang berjalan tepat seperti yang dirancang; ada juga yang tiba-tiba berubah arah sebelum makan tengah hari. Walau apa pun, tabiat kecil itu akan bertambah. Berjalan kaki sebentar menjernihkan fikiran saya, perbualan yang baik boleh mengubah seluruh mood saya, dan sedikit kesabaran membawa kita jauh.",
    "Bayangkan anda berdiri di tepi sebuah pelabuhan yang sunyi, sejurus sebelum matahari terbit. Airnya tenang, udaranya berbau garam, dan di kejauhan sebuah loceng sedang berbunyi. Bot-bot nelayan keluar satu demi satu, enjinnya berdengung perlahan dan tetap. Kemudian cahaya pertama muncul di atas bukit, dan seluruh pekan seolah-olah terjaga serentak. Tingkap-tingkap dibuka, basikal berdetak-detak di atas jalan berbatu, dan hari pun bermula.",
    "Jadi anda mahu membina penonton dari kosong? Inilah yang benar-benar berkesan. Pertama, pilih satu topik yang boleh anda bincangkan berjam-jam. Kedua, siarkan secara konsisten, bukan sempurna. Ketiga, kaji video yang berprestasi baik dan tanya kenapa: adakah kerana pembukaannya, rentaknya, atau ceritanya? Kebanyakan pencipta kandungan berputus asa betul-betul sebelum segalanya mula menjadi. Jangan jadi salah seorang daripada mereka. Teruskan mencuba, teruskan belajar, dan teruskan melangkah."
  ),
  Filipino: ltr(
    "fil",
    "Tuwing umaga, naglalaan ako ng ilang minuto para planuhin ang araw. Tinitingnan ko ang mga mensahe ko, mabilis na nagtitimpla ng kape, at isinusulat ang tatlong pinakamahalagang bagay. May mga araw na sumusunod talaga sa plano; may mga araw namang biglang nag-iiba bago pa magtanghalian. Anuman ang mangyari, nag-iipon ang maliliit na gawi. Ang maikling paglalakad ay nagpapalinaw ng isip ko, ang magandang kuwentuhan ay kayang baguhin ang buong mood ko, at ang kaunting pasensya ay malayo ang nararating.",
    "Isipin mong nakatayo ka sa gilid ng isang tahimik na daungan, bago pa sumikat ang araw. Kalmado ang tubig, amoy-alat ang hangin, at sa may kalayuan ay may tumutunog na kampana. Isa-isang pumapalaot ang mga bangkang pangisda, mahina at tuloy-tuloy ang ugong ng kanilang makina. Pagkatapos, sumilip ang unang liwanag sa ibabaw ng mga burol, at parang sabay-sabay na nagising ang buong bayan. Bumubukas ang mga bintana, kumakalampag ang mga bisikleta sa batong kalsada, at nagsisimula ang araw.",
    "Gusto mo bang bumuo ng audience mula sa wala? Ito ang talagang gumagana. Una, pumili ka ng isang paksang kaya mong pag-usapan nang ilang oras. Pangalawa, mag-post nang tuloy-tuloy, hindi kailangang perpekto. Pangatlo, pag-aralan ang mga video na pumapatok at tanungin kung bakit: dahil ba sa simula, sa bilis, o sa kuwento? Karamihan sa mga creator ay sumusuko bago pa magsimulang umayos ang lahat. Huwag kang maging isa sa kanila. Patuloy na sumubok, patuloy na matuto, at patuloy na sumulong."
  ),
  Tamil: ltr(
    "ta",
    "ஒவ்வொரு காலையும் அன்றைய நாளைத் திட்டமிட சில நிமிடங்களை ஒதுக்குகிறேன். என் மெசேஜ்களைப் பார்க்கிறேன், சீக்கிரமாக ஒரு கப் காபி போடுகிறேன், மிக முக்கியமான மூன்று விஷயங்களை எழுதி வைக்கிறேன். சில நாட்கள் திட்டமிட்டபடியே சரியாக நடக்கும்; சில நாட்கள் மதிய உணவுக்கு முன்பே திடீரென்று திசை மாறிவிடும். எப்படியிருந்தாலும், சிறிய பழக்கங்கள் மெல்ல மெல்லச் சேர்ந்துகொண்டே போகும். ஒரு சிறிய நடை என் மனதைத் தெளிவாக்கும், ஒரு நல்ல உரையாடல் என் மனநிலையையே முழுதாக மாற்றிவிடும், கொஞ்சம் பொறுமை நம்மை வெகுதூரம் கொண்டு செல்லும்.",
    "சூரியன் உதிப்பதற்குச் சற்று முன், அமைதியான ஒரு துறைமுகத்தின் ஓரத்தில் நீங்கள் நின்றுகொண்டிருப்பதாகக் கற்பனை செய்து பாருங்கள். தண்ணீர் அமைதியாக இருக்கிறது, காற்றில் உப்பு வாசனை வீசுகிறது, தூரத்தில் எங்கோ ஒரு மணி ஒலிக்கிறது. மீன்பிடிப் படகுகள் ஒவ்வொன்றாகக் கடலுக்குள் செல்கின்றன, அவற்றின் இன்ஜின்கள் தாழ்வாகவும் சீராகவும் இரைகின்றன. பிறகு மலைகளுக்கு மேலே முதல் வெளிச்சம் தோன்றுகிறது, ஊர் முழுவதும் ஒரே நேரத்தில் விழித்துக்கொள்வது போலத் தெரிகிறது. ஜன்னல்கள் திறக்கின்றன, கற்கள் பதித்த தெருவில் சைக்கிள்கள் கடகடவென ஓடுகின்றன, நாள் தொடங்குகிறது.",
    "புதிதாக ஒரு ஆடியன்ஸை உருவாக்க வேண்டுமா? உண்மையில் வேலை செய்வது இதுதான். முதலில், மணிக்கணக்கில் பேசக்கூடிய ஒரு தலைப்பைத் தேர்ந்தெடுங்கள். இரண்டாவது, கச்சிதமாக அல்ல, தொடர்ந்து பதிவிடுங்கள். மூன்றாவது, நன்றாகப் போகும் வீடியோக்களை ஆராய்ந்து ஏன் என்று கேளுங்கள்: தொடக்கமா, வேகமா, அல்லது கதையா? பெரும்பாலான கிரியேட்டர்கள் எல்லாம் சரியாகத் தொடங்குவதற்குச் சற்று முன்பே கைவிட்டுவிடுகிறார்கள். அவர்களில் ஒருவராக இருக்காதீர்கள். தொடர்ந்து முயற்சி செய்யுங்கள், தொடர்ந்து கற்றுக்கொள்ளுங்கள், தொடர்ந்து முன்னேறுங்கள்."
  ),
  Catalan: ltr(
    "ca",
    "Cada matí em prenc uns minuts per planificar el dia. Miro els missatges, em faig un cafè ràpid i apunto les tres coses que més importen. Alguns dies van exactament com estava previst; d'altres fan un gir inesperat abans de dinar. Sigui com sigui, els petits hàbits sumen. Una passejada curta m'aclareix el cap, una bona conversa em pot canviar tot l'estat d'ànim, i una mica de paciència arriba molt lluny.",
    "Imagina que ets a la vora d'un port tranquil just abans de la sortida del sol. L'aigua està en calma, l'aire fa olor de sal i, en algun lloc a la llunyania, sona una campana. Les barques de pesca surten una rere l'altra, amb els motors brunzint baixos i constants. Llavors la primera llum treu el cap per sobre dels turons, i tot el poble sembla despertar-se de cop. Els porticons s'obren, les bicicletes repiquen sobre les llambordes i comença el dia.",
    "Així que vols crear una audiència des de zero? Això és el que funciona de veritat. Primer, tria un tema del qual podries parlar durant hores. Segon, publica amb constància, no amb perfecció. Tercer, estudia els vídeos que funcionen bé i pregunta't per què: va ser el ganxo, el ritme o la història? La majoria de creadors ho deixen just abans que les coses comencin a encaixar. No facis com ells. Continua provant, continua aprenent i tira endavant."
  ),
  Afrikaans: ltr(
    "af",
    "Elke oggend neem ek 'n paar minute om die dag te beplan. Ek kyk na my boodskappe, maak gou 'n koppie koffie en skryf die drie belangrikste dinge neer. Party dae loop presies volgens plan; ander neem al voor middagete 'n skielike draai. Hoe dit ook al sy, die klein gewoontes tel op. 'n Kort stappie maak my kop skoon, 'n goeie gesprek kan my hele bui verander, en 'n bietjie geduld bring jou ver.",
    "Stel jou voor jy staan aan die rand van 'n stil hawe, net voor sonop. Die water is kalm, die lug ruik na sout, en iewers in die verte lui 'n klok. Die vissersbote vaar een na die ander uit, hul enjins brom laag en egalig. Dan breek die eerste lig oor die heuwels, en dit lyk asof die hele dorp gelyk wakker word. Luike gaan oop, fietse ratel oor die klipstraat, en die dag begin.",
    "So jy wil van nuuts af 'n gehoor opbou? Hier is wat regtig werk. Eerstens, kies een onderwerp waaroor jy ure lank kan praat. Tweedens, plaas gereeld, nie perfek nie. Derdens, bestudeer die video's wat goed vaar en vra hoekom: was dit die begin, die tempo of die storie? Die meeste skeppers gee op net voordat dinge begin werk. Moenie soos hulle wees nie. Hou aan toets, hou aan leer en hou aan beweeg."
  ),
};

export function cloneScriptsFor(language: CloneLanguage): CloneScriptSet {
  return SCRIPTS[language === "Automatic" ? "English" : language];
}
