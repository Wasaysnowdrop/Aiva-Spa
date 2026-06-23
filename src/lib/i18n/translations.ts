/**
 * In-widget UI translations.
 *
 * The AI's natural-language replies are produced by the LLM and the
 * `language` field in the chat request tells the LLM which language to
 * answer in. This file only contains the FIXED, canned UI strings:
 * greetings, buttons, errors, form labels, the "powered by" line, and
 * the consent text. Keeping them in code (not the database) means the
 * translations ship with the app and don't require owner input.
 */

export const SUPPORTED_LANGUAGES = [
  "en",
  "es",
  "fr",
  "de",
  "it",
  "pt",
  "nl",
  "pl",
  "tr",
  "ar",
  "zh",
  "ja",
] as const

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]

export type TranslationKey =
  | "header.online"
  | "header.offline"
  | "consent"
  | "powered_by"
  | "book_cta"
  | "book_form_title"
  | "book_form_subtitle"
  | "field.name"
  | "field.email"
  | "field.phone"
  | "field.service"
  | "field.preferred_time"
  | "field.preferred_time_placeholder"
  | "field.notes"
  | "field.notes_placeholder"
  | "submit.send"
  | "submit.sending"
  | "submit.open_calendar"
  | "error.consent_required"
  | "error.required_fields"
  | "error.pick_time"
  | "error.save_failed"
  | "placeholder.input"
  | "typing"
  | "thanks_after_booking"
  | "thanks_after_lead"
  | "lead_received_banner"
  | "language.aria"

export type TranslationDictionary = Partial<Record<TranslationKey, string>>

function build(
  entries: Array<[TranslationKey, string]>,
): TranslationDictionary {
  const out = {} as TranslationDictionary
  for (const [k, v] of entries) {
    out[k] = v
  }
  return out
}

const en = build([
  ["header.online", "Online · 24/7"],
  ["header.offline", "We'll reply soon"],
  [
    "consent",
    "By chatting, you agree to our privacy policy. We'll only contact you about your inquiry.",
  ],
  ["powered_by", "Powered by"],
  ["book_cta", "Book a consult"],
  ["book_form_title", "Book a quick consult"],
  [
    "book_form_subtitle",
    "Share a few details and the team will confirm within 1 business hour.",
  ],
  ["field.name", "Full name"],
  ["field.email", "Email"],
  ["field.phone", "Phone"],
  ["field.service", "Service (e.g. Botox)"],
  ["field.preferred_time", "Preferred time"],
  [
    "field.preferred_time_placeholder",
    "Or type a time (e.g. 'Tue afternoon')",
  ],
  ["field.notes", "Goals or notes"],
  ["field.notes_placeholder", "Anything you'd like the provider to know?"],
  ["submit.send", "Send to {brand}"],
  ["submit.sending", "Sending…"],
  ["submit.open_calendar", "Pick a time"],
  [
    "error.consent_required",
    "Please confirm consent before submitting.",
  ],
  [
    "error.required_fields",
    "Please fill in your name, phone, and service of interest.",
  ],
  ["error.pick_time", "Pick a time slot or type a preferred time."],
  ["error.save_failed", "Could not save. Please try again."],
  ["placeholder.input", "Type a question…"],
  ["typing", "{brand} is typing…"],
  [
    "thanks_after_booking",
    "Thanks {first}! You're booked. The {brand} team will confirm your {service} appointment by email.",
  ],
  [
    "thanks_after_lead",
    "Thanks {first}! I've passed your details to the {brand} team. They'll reach out within 1 business hour to confirm your {service} consultation.",
  ],
  [
    "lead_received_banner",
    "Your details have been sent to the team. You'll get a confirmation shortly.",
  ],
  ["language.aria", "Chat language"],
])

const es = build([
  ["header.online", "En línea · 24/7"],
  ["header.offline", "Te responderemos pronto"],
  [
    "consent",
    "Al chatear, aceptas nuestra política de privacidad. Solo te contactaremos sobre tu consulta.",
  ],
  ["powered_by", "Con tecnología de"],
  ["book_cta", "Reservar consulta"],
  ["book_form_title", "Reserva una consulta rápida"],
  [
    "book_form_subtitle",
    "Comparte tus datos y el equipo confirmará en 1 hora hábil.",
  ],
  ["field.name", "Nombre completo"],
  ["field.email", "Correo electrónico"],
  ["field.phone", "Teléfono"],
  ["field.service", "Servicio (ej. Botox)"],
  ["field.preferred_time", "Horario preferido"],
  [
    "field.preferred_time_placeholder",
    "O escribe un horario (ej. 'martes por la tarde')",
  ],
  ["submit.send", "Enviar a {brand}"],
  ["submit.sending", "Enviando…"],
  ["submit.open_calendar", "Elegir horario"],
  [
    "error.consent_required",
    "Por favor confirma el consentimiento antes de enviar.",
  ],
  [
    "error.required_fields",
    "Por favor completa tu nombre, teléfono y servicio de interés.",
  ],
  ["error.pick_time", "Elige un horario o escribe tu preferencia."],
  ["error.save_failed", "No se pudo guardar. Inténtalo de nuevo."],
  ["placeholder.input", "Escribe una pregunta…"],
  ["typing", "{brand} está escribiendo…"],
  [
    "thanks_after_booking",
    "¡Gracias {first}! Tu cita está reservada. El equipo de {brand} confirmará tu cita de {service} por correo.",
  ],
  [
    "thanks_after_lead",
    "¡Gracias {first}! He pasado tus datos al equipo de {brand}. Te contactarán en 1 hora hábil para confirmar tu consulta de {service}.",
  ],
  [
    "lead_received_banner",
    "Tus datos se han enviado al equipo. Recibirás una confirmación pronto.",
  ],
  ["language.aria", "Idioma del chat"],
])

const fr = build([
  ["header.online", "En ligne · 24/7"],
  ["header.offline", "Nous répondrons bientôt"],
  [
    "consent",
    "En discutant, vous acceptez notre politique de confidentialité. Nous vous contacterons uniquement à propos de votre demande.",
  ],
  ["powered_by", "Propulsé par"],
  ["book_cta", "Réserver une consultation"],
  ["book_form_title", "Réservez une consultation rapide"],
  [
    "book_form_subtitle",
    "Partagez quelques informations et l'équipe confirmera sous 1 heure ouvrée.",
  ],
  ["field.name", "Nom complet"],
  ["field.email", "E-mail"],
  ["field.phone", "Téléphone"],
  ["field.service", "Service (ex. Botox)"],
  ["field.preferred_time", "Heure préférée"],
  [
    "field.preferred_time_placeholder",
    "Ou saisissez un horaire (ex. 'mardi après-midi')",
  ],
  ["submit.send", "Envoyer à {brand}"],
  ["submit.sending", "Envoi…"],
  ["submit.open_calendar", "Choisir un horaire"],
  [
    "error.consent_required",
    "Veuillez confirmer le consentement avant d'envoyer.",
  ],
  [
    "error.required_fields",
    "Veuillez remplir votre nom, téléphone et service souhaité.",
  ],
  ["error.pick_time", "Choisissez un créneau ou saisissez votre préférence."],
  ["error.save_failed", "Impossible d'enregistrer. Réessayez."],
  ["placeholder.input", "Posez une question…"],
  ["typing", "{brand} écrit…"],
  [
    "thanks_after_booking",
    "Merci {first} ! Votre rendez-vous est réservé. L'équipe {brand} confirmera votre rendez-vous {service} par e-mail.",
  ],
  [
    "thanks_after_lead",
    "Merci {first} ! J'ai transmis vos coordonnées à l'équipe {brand}. Ils vous recontacteront sous 1 heure ouvrée pour confirmer votre consultation {service}.",
  ],
  [
    "lead_received_banner",
    "Vos informations ont été envoyées à l'équipe. Vous recevrez une confirmation sous peu.",
  ],
  ["language.aria", "Langue du chat"],
])

const de = build([
  ["header.online", "Online · 24/7"],
  ["header.offline", "Wir melden uns bald"],
  [
    "consent",
    "Mit dem Chat stimmen Sie unserer Datenschutzerklärung zu. Wir kontaktieren Sie nur zu Ihrer Anfrage.",
  ],
  ["powered_by", "Bereitgestellt von"],
  ["book_cta", "Beratung buchen"],
  ["book_form_title", "Schnelle Beratung buchen"],
  [
    "book_form_subtitle",
    "Geben Sie einige Daten ein und das Team bestätigt innerhalb von 1 Arbeitsstunde.",
  ],
  ["field.name", "Vollständiger Name"],
  ["field.email", "E-Mail"],
  ["field.phone", "Telefon"],
  ["field.service", "Behandlung (z. B. Botox)"],
  ["field.preferred_time", "Wunschtermin"],
  [
    "field.preferred_time_placeholder",
    "Oder Zeit eingeben (z. B. 'Dienstagnachmittag')",
  ],
  ["submit.send", "An {brand} senden"],
  ["submit.sending", "Wird gesendet…"],
  ["submit.open_calendar", "Termin wählen"],
  [
    "error.consent_required",
    "Bitte bestätigen Sie die Einwilligung vor dem Absenden.",
  ],
  [
    "error.required_fields",
    "Bitte füllen Sie Name, Telefon und Wunschbehandlung aus.",
  ],
  ["error.pick_time", "Wählen Sie einen Termin oder geben Sie Ihren Wunsch ein."],
  ["error.save_failed", "Speichern fehlgeschlagen. Bitte erneut versuchen."],
  ["placeholder.input", "Frage eingeben…"],
  ["typing", "{brand} schreibt…"],
  [
    "thanks_after_booking",
    "Danke {first}! Ihr Termin ist gebucht. Das {brand}-Team bestätigt Ihren {service}-Termin per E-Mail.",
  ],
  [
    "thanks_after_lead",
    "Danke {first}! Ich habe Ihre Daten an das {brand}-Team weitergegeben. Sie melden sich innerhalb 1 Arbeitsstunde, um Ihre {service}-Beratung zu bestätigen.",
  ],
  [
    "lead_received_banner",
    "Ihre Daten wurden an das Team gesendet. Sie erhalten in Kürze eine Bestätigung.",
  ],
  ["language.aria", "Chat-Sprache"],
])

const it = build([
  ["header.online", "Online · 24/7"],
  ["header.offline", "Risponderemo presto"],
  [
    "consent",
    "Chattando accetti la nostra informativa sulla privacy. Ti contatteremo solo per la tua richiesta.",
  ],
  ["powered_by", "Powered by"],
  ["book_cta", "Prenota una consulenza"],
  ["book_form_title", "Prenota una consulenza rapida"],
  [
    "book_form_subtitle",
    "Condividi alcuni dati e il team confermerà entro 1 ora lavorativa.",
  ],
  ["field.name", "Nome completo"],
  ["field.email", "E-mail"],
  ["field.phone", "Telefono"],
  ["field.service", "Servizio (es. Botox)"],
  ["field.preferred_time", "Orario preferito"],
  [
    "field.preferred_time_placeholder",
    "Oppure digita un orario (es. 'martedì pomeriggio')",
  ],
  ["submit.send", "Invia a {brand}"],
  ["submit.sending", "Invio…"],
  ["submit.open_calendar", "Scegli un orario"],
  ["error.consent_required", "Conferma il consenso prima di inviare."],
  [
    "error.required_fields",
    "Compila nome, telefono e servizio di interesse.",
  ],
  ["error.pick_time", "Scegli un orario o digita la tua preferenza."],
  ["error.save_failed", "Salvataggio non riuscito. Riprova."],
  ["placeholder.input", "Scrivi una domanda…"],
  ["typing", "{brand} sta scrivendo…"],
  [
    "thanks_after_booking",
    "Grazie {first}! Il tuo appuntamento è prenotato. Il team {brand} confermerà il tuo appuntamento {service} via e-mail.",
  ],
  [
    "thanks_after_lead",
    "Grazie {first}! Ho passato i tuoi dati al team {brand}. Ti contatteranno entro 1 ora lavorativa per confermare la consulenza {service}.",
  ],
  [
    "lead_received_banner",
    "I tuoi dati sono stati inviati al team. Riceverai una conferma a breve.",
  ],
  ["language.aria", "Lingua della chat"],
])

const pt = build([
  ["header.online", "Online · 24/7"],
  ["header.offline", "Responderemos em breve"],
  [
    "consent",
    "Ao conversar, você concorda com nossa política de privacidade. Entraremos em contato apenas sobre sua solicitação.",
  ],
  ["powered_by", "Com tecnologia"],
  ["book_cta", "Agendar consulta"],
  ["book_form_title", "Agende uma consulta rápida"],
  [
    "book_form_subtitle",
    "Compartilhe alguns dados e a equipe confirmará em 1 hora útil.",
  ],
  ["field.name", "Nome completo"],
  ["field.email", "E-mail"],
  ["field.phone", "Telefone"],
  ["field.service", "Serviço (ex. Botox)"],
  ["field.preferred_time", "Horário preferido"],
  [
    "field.preferred_time_placeholder",
    "Ou digite um horário (ex. 'terça à tarde')",
  ],
  ["submit.send", "Enviar para {brand}"],
  ["submit.sending", "Enviando…"],
  ["submit.open_calendar", "Escolher horário"],
  ["error.consent_required", "Confirme o consentimento antes de enviar."],
  [
    "error.required_fields",
    "Preencha nome, telefone e serviço de interesse.",
  ],
  ["error.pick_time", "Escolha um horário ou digite sua preferência."],
  ["error.save_failed", "Não foi possível salvar. Tente novamente."],
  ["placeholder.input", "Digite uma pergunta…"],
  ["typing", "{brand} está digitando…"],
  [
    "thanks_after_booking",
    "Obrigado {first}! Sua consulta está agendada. A equipe {brand} confirmará sua consulta de {service} por e-mail.",
  ],
  [
    "thanks_after_lead",
    "Obrigado {first}! Passei seus dados para a equipe {brand}. Eles entrarão em contato em 1 hora útil para confirmar sua consulta de {service}.",
  ],
  [
    "lead_received_banner",
    "Seus dados foram enviados para a equipe. Você receberá uma confirmação em breve.",
  ],
  ["language.aria", "Idioma do chat"],
])

const nl = build([
  ["header.online", "Online · 24/7"],
  ["header.offline", "We reageren snel"],
  [
    "consent",
    "Door te chatten ga je akkoord met ons privacybeleid. We nemen alleen contact op over je vraag.",
  ],
  ["powered_by", "Mogelijk gemaakt door"],
  ["book_cta", "Consult boeken"],
  ["book_form_title", "Boek snel een consult"],
  [
    "book_form_subtitle",
    "Deel een paar gegevens en het team bevestigt binnen 1 werkdag.",
  ],
  ["field.name", "Volledige naam"],
  ["field.email", "E-mail"],
  ["field.phone", "Telefoon"],
  ["field.service", "Behandeling (bijv. Botox)"],
  ["field.preferred_time", "Voorkeurstijd"],
  [
    "field.preferred_time_placeholder",
    "Of typ een tijd (bijv. 'dinsdagmiddag')",
  ],
  ["submit.send", "Verstuur naar {brand}"],
  ["submit.sending", "Verzenden…"],
  ["submit.open_calendar", "Kies een tijd"],
  [
    "error.consent_required",
    "Bevestig de toestemming voor het versturen.",
  ],
  [
    "error.required_fields",
    "Vul naam, telefoon en gewenste behandeling in.",
  ],
  ["error.pick_time", "Kies een tijdslot of typ je voorkeur."],
  ["error.save_failed", "Opslaan mislukt. Probeer opnieuw."],
  ["placeholder.input", "Typ een vraag…"],
  ["typing", "{brand} typt…"],
  [
    "thanks_after_booking",
    "Bedankt {first}! Je afspraak is geboekt. Het {brand}-team bevestigt je {service}-afspraak per e-mail.",
  ],
  [
    "thanks_after_lead",
    "Bedankt {first}! Ik heb je gegevens doorgegeven aan het {brand}-team. Ze nemen binnen 1 werkdag contact op om je {service}-consult te bevestigen.",
  ],
  [
    "lead_received_banner",
    "Je gegevens zijn naar het team gestuurd. Je ontvangt snel een bevestiging.",
  ],
  ["language.aria", "Chattaal"],
])

const pl = build([
  ["header.online", "Online · 24/7"],
  ["header.offline", "Odpowiemy wkrótce"],
  [
    "consent",
    "Rozmawiając, akceptujesz naszą politykę prywatności. Skontaktujemy się tylko w sprawie Twojego zapytania.",
  ],
  ["powered_by", "Obsługiwane przez"],
  ["book_cta", "Umów konsultację"],
  ["book_form_title", "Umów szybką konsultację"],
  [
    "book_form_subtitle",
    "Podaj kilka danych, a zespół potwierdzi w ciągu 1 godziny roboczej.",
  ],
  ["field.name", "Imię i nazwisko"],
  ["field.email", "E-mail"],
  ["field.phone", "Telefon"],
  ["field.service", "Usługa (np. Botox)"],
  ["field.preferred_time", "Preferowany termin"],
  [
    "field.preferred_time_placeholder",
    "Lub wpisz termin (np. 'wtorek po południu')",
  ],
  ["submit.send", "Wyślij do {brand}"],
  ["submit.sending", "Wysyłanie…"],
  ["submit.open_calendar", "Wybierz termin"],
  ["error.consent_required", "Potwierdź zgodę przed wysłaniem."],
  ["error.required_fields", "Wypełnij imię, telefon i usługę."],
  ["error.pick_time", "Wybierz termin lub wpisz preferencję."],
  ["error.save_failed", "Nie udało się zapisać. Spróbuj ponownie."],
  ["placeholder.input", "Wpisz pytanie…"],
  ["typing", "{brand} pisze…"],
  [
    "thanks_after_booking",
    "Dzięki {first}! Twoja wizyta jest zarezerwowana. Zespół {brand} potwierdzi wizytę {service} e-mailem.",
  ],
  [
    "thanks_after_lead",
    "Dzięki {first}! Przekazałem Twoje dane zespołowi {brand}. Skontaktują się w ciągu 1 godziny roboczej, aby potwierdzić konsultację {service}.",
  ],
  [
    "lead_received_banner",
    "Twoje dane zostały wysłane do zespołu. Wkrótce otrzymasz potwierdzenie.",
  ],
  ["language.aria", "Język czatu"],
])

const tr = build([
  ["header.online", "Çevrimiçi · 7/24"],
  ["header.offline", "Yakında yanıt vereceğiz"],
  [
    "consent",
    "Sohbet ederek gizlilik politikamızı kabul edersiniz. Yalnızca sorunuzla ilgili sizinle iletişime geçeceğiz.",
  ],
  ["powered_by", "Destekleyen"],
  ["book_cta", "Danışmanlık ayır"],
  ["book_form_title", "Hızlı danışmanlık ayır"],
  [
    "book_form_subtitle",
    "Birkaç bilgi paylaşın, ekibimiz 1 iş saati içinde onaylayacak.",
  ],
  ["field.name", "Ad Soyad"],
  ["field.email", "E-posta"],
  ["field.phone", "Telefon"],
  ["field.service", "Hizmet (örn. Botox)"],
  ["field.preferred_time", "Tercih edilen zaman"],
  [
    "field.preferred_time_placeholder",
    "Veya bir zaman yazın (örn. 'salı öğleden sonra')",
  ],
  ["submit.send", "{brand}'a gönder"],
  ["submit.sending", "Gönderiliyor…"],
  ["submit.open_calendar", "Zaman seç"],
  ["error.consent_required", "Göndermeden önce onayı işaretleyin."],
  ["error.required_fields", "Ad, telefon ve hizmeti doldurun."],
  ["error.pick_time", "Bir zaman seçin veya tercihinizi yazın."],
  ["error.save_failed", "Kaydedilemedi. Tekrar deneyin."],
  ["placeholder.input", "Bir soru yazın…"],
  ["typing", "{brand} yazıyor…"],
  [
    "thanks_after_booking",
    "Teşekkürler {first}! Randevunuz alındı. {brand} ekibi {service} randevunuzu e-posta ile onaylayacak.",
  ],
  [
    "thanks_after_lead",
    "Teşekkürler {first}! Bilgilerinizi {brand} ekibine ilettim. {service} danışmanlığınızı onaylamak için 1 iş saati içinde sizinle iletişime geçecekler.",
  ],
  [
    "lead_received_banner",
    "Bilgileriniz ekibe gönderildi. Kısa süre içinde onay alacaksınız.",
  ],
  ["language.aria", "Sohbet dili"],
])

const ar = build([
  ["header.online", "متصل · 24/7"],
  ["header.offline", "سنرد قريباً"],
  [
    "consent",
    "بمحادثتك، فأنت توافق على سياسة الخصوصية الخاصة بنا. سنتواصل معك فقط بخصوص استفسارك.",
  ],
  ["powered_by", "مدعوم من"],
  ["book_cta", "احجز استشارة"],
  ["book_form_title", "احجز استشارة سريعة"],
  [
    "book_form_subtitle",
    "شارك بعض التفاصيل وسيؤكد الفريق خلال ساعة عمل واحدة.",
  ],
  ["field.name", "الاسم الكامل"],
  ["field.email", "البريد الإلكتروني"],
  ["field.phone", "الهاتف"],
  ["field.service", "الخدمة (مثل بوتوكس)"],
  ["field.preferred_time", "الوقت المفضل"],
  [
    "field.preferred_time_placeholder",
    "أو اكتب وقتاً (مثل 'الثلاثاء مساءً')",
  ],
  ["submit.send", "إرسال إلى {brand}"],
  ["submit.sending", "جاري الإرسال…"],
  ["submit.open_calendar", "اختر وقتاً"],
  [
    "error.consent_required",
    "يرجى تأكيد الموافقة قبل الإرسال.",
  ],
  ["error.required_fields", "يرجى تعبئة الاسم والهاتف والخدمة."],
  ["error.pick_time", "اختر وقتاً أو اكتب تفضيلك."],
  ["error.save_failed", "تعذر الحفظ. حاول مرة أخرى."],
  ["placeholder.input", "اكتب سؤالاً…"],
  ["typing", "{brand} يكتب…"],
  [
    "thanks_after_booking",
    "شكراً {first}! تم حجز موعدك. سيؤكد فريق {brand} موعد {service} عبر البريد الإلكتروني.",
  ],
  [
    "thanks_after_lead",
    "شكراً {first}! لقد أرسلت بياناتك إلى فريق {brand}. سيتواصلون معك خلال ساعة عمل لتأكيد استشارتك في {service}.",
  ],
  [
    "lead_received_banner",
    "تم إرسال بياناتك إلى الفريق. ستحصل على تأكيد قريباً.",
  ],
  ["language.aria", "لغة الدردشة"],
])

const zh = build([
  ["header.online", "在线 · 24/7"],
  ["header.offline", "我们将尽快回复"],
  [
    "consent",
    "开始聊天即表示您同意我们的隐私政策。我们仅会就您的咨询与您联系。",
  ],
  ["powered_by", "技术支持"],
  ["book_cta", "预约咨询"],
  ["book_form_title", "快速预约咨询"],
  [
    "book_form_subtitle",
    "分享一些信息,团队将在 1 个工作小时内确认。",
  ],
  ["field.name", "姓名"],
  ["field.email", "电子邮件"],
  ["field.phone", "电话"],
  ["field.service", "服务(例如 Botox)"],
  ["field.preferred_time", "首选时间"],
  [
    "field.preferred_time_placeholder",
    "或输入时间(例如 '周二下午')",
  ],
  ["submit.send", "发送给 {brand}"],
  ["submit.sending", "发送中…"],
  ["submit.open_calendar", "选择时间"],
  ["error.consent_required", "请先同意条款再提交。"],
  ["error.required_fields", "请填写姓名、电话和服务项目。"],
  ["error.pick_time", "请选择时间段或输入您偏好的时间。"],
  ["error.save_failed", "保存失败,请重试。"],
  ["placeholder.input", "输入问题…"],
  ["typing", "{brand} 正在输入…"],
  [
    "thanks_after_booking",
    "谢谢 {first}!预约已成功。{brand} 团队将通过邮件确认您的 {service} 预约。",
  ],
  [
    "thanks_after_lead",
    "谢谢 {first}!我已将您的信息转交给 {brand} 团队。他们将在 1 个工作小时内联系您确认 {service} 咨询。",
  ],
  [
    "lead_received_banner",
    "您的信息已发送给团队。您将很快收到确认。",
  ],
  ["language.aria", "聊天语言"],
])

const ja = build([
  ["header.online", "オンライン · 24時間"],
  ["header.offline", "すぐにご返信します"],
  [
    "consent",
    "チャットを開始することで、プライバシーポリシーに同意したものとみなされます。お問い合わせについてのみご連絡いたします。",
  ],
  ["powered_by", "提供"],
  ["book_cta", "カウンセリングを予約"],
  ["book_form_title", "クイックカウンセリングを予約"],
  [
    "book_form_subtitle",
    "いくつかの情報を共有いただければ、1営業時間以内にチームが確認します。",
  ],
  ["field.name", "氏名"],
  ["field.email", "メール"],
  ["field.phone", "電話番号"],
  ["field.service", "サービス(例:ボトックス)"],
  ["field.preferred_time", "希望時間"],
  [
    "field.preferred_time_placeholder",
    "または時間を入力(例:「火曜の午後」)",
  ],
  ["submit.send", "{brand} に送信"],
  ["submit.sending", "送信中…"],
  ["submit.open_calendar", "時間を選択"],
  ["error.consent_required", "送信前に同意を確認してください。"],
  [
    "error.required_fields",
    "お名前、電話番号、サービスをご入力ください。",
  ],
  ["error.pick_time", "時間を選択するか、希望を入力してください。"],
  ["error.save_failed", "保存できませんでした。もう一度お試しください。"],
  ["placeholder.input", "質問を入力…"],
  ["typing", "{brand} が入力中…"],
  [
    "thanks_after_booking",
    "{first}さん、ありがとうございます!ご予約を承りました。{brand} チームが {service} のご予約をメールで確認いたします。",
  ],
  [
    "thanks_after_lead",
    "{first}さん、ありがとうございます!{brand} チームに情報を共有しました。1営業時間以内に {service} カウンセリングの確認のご連絡をいたします。",
  ],
  [
    "lead_received_banner",
    "情報がチームに送信されました。まもなく確認のご連絡が届きます。",
  ],
  ["language.aria", "チャットの言語"],
])

const TRANSLATIONS: Record<LanguageCode, TranslationDictionary> = {
  en,
  es,
  fr,
  de,
  it,
  pt,
  nl,
  pl,
  tr,
  ar,
  zh,
  ja,
}

export function getDictionary(lang: LanguageCode): TranslationDictionary {
  return TRANSLATIONS[lang] ?? TRANSLATIONS.en
}

export function isSupportedLanguage(value: unknown): value is LanguageCode {
  return typeof value === "string" && (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
}
