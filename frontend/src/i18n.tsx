import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getLocales } from "expo-localization";
import dayjs from "dayjs";
import "dayjs/locale/es-mx";
import { storage } from "@/src/utils/storage";

export type Lang = "en" | "es";
const LANG_KEY = "ddom_lang";

type Catalog = Record<string, string>;

const en: Catalog = {
  // common
  "common.back": "Back",
  "common.cancel": "Cancel",
  "common.you": "You",
  "common.partner": "Partner",
  "common.notNow": "Not now",
  "common.openSettings": "Open Settings",
  "common.tryAgain": "Please try again.",
  "common.oops": "Oops",
  // tabs
  "tab.home": "Home",
  "tab.play": "Play",
  "tab.us": "Us",
  // login
  "login.badge": "just the two of us",
  "login.subtitle": "Your private little world — date nights, voice notes, playful challenges, and the small moments that make us, us.",
  "login.google": "Continue with Google",
  "login.terms": "Sign in to link with your partner using an invite code.",
  // onboarding
  "onb.title": "Link with your\nother half",
  "onb.subtitle": "This space is just for the two of you. Create a code to invite your partner, or enter the code they sent you.",
  "onb.yourCode": "YOUR INVITE CODE",
  "onb.share": "Share invite",
  "onb.waiting": "Waiting for your partner to join…",
  "onb.enterApp": "Enter the app",
  "onb.enterCode": "ENTER INVITE CODE",
  "onb.codePlaceholder": "e.g. AB12CD",
  "onb.linkUs": "Link us together",
  "onb.createCode": "Create an invite code",
  "onb.haveCode": "I have an invite code",
  "onb.errCode": "Enter the 6-character code your partner shared.",
  "onb.shareMsg": "Join me on Daily Dose of Me 💕 Use my invite code: {code}",
  // home
  "home.pts": "{n} pts",
  "home.daysTogether": "days together",
  "home.setAnniversary": "Set your anniversary",
  "home.ourMemories": "Our memories",
  "home.thisMonth": "{n} this month",
  "home.noMemories": "No memories yet this month",
  "home.noMemoriesSub": "Tap the + to capture your first date night.",
  "home.voiceNote": "Voice note 🎙️",
  "home.aMoment": "A moment together",
  // capture
  "cap.title": "New memory",
  "cap.when": "WHEN",
  "cap.today": "Today",
  "cap.photos": "PHOTOS ({n}/{max})",
  "cap.library": "Library",
  "cap.camera": "Camera",
  "cap.caption": "CAPTION ({n}/{max})",
  "cap.captionPlaceholder": "What made today special?",
  "cap.voiceNote": "VOICE NOTE",
  "cap.save": "Save memory",
  "cap.limitTitle": "Up to 5 photos",
  "cap.limitMsg": "You've reached the limit for this memory.",
  "cap.addSomething": "Add something sweet",
  "cap.addSomethingMsg": "Add a photo, a caption, or a voice note first.",
  "cap.couldntSave": "Couldn't save",
  "cap.permTitle": "Permission needed",
  "cap.permMsg": "Enable photo access in Settings to add photos.",
  // day
  "day.nothing": "Nothing logged for this day",
  "day.nothingSub": "Add a photo, caption or voice note to remember it.",
  "day.add": "Add to this day",
  "day.deleteTitle": "Delete memory?",
  "day.deleteMsg": "This can't be undone.",
  "day.delete": "Delete",
  "day.someone": "Someone",
  "day.couldntDelete": "Couldn't delete",
  // play
  "play.title": "Play together",
  "play.subtitle": "A little game of us, every day.",
  "play.wagerTitle": "This week's wager",
  "play.monSun": "MON–SUN",
  "play.noWager": "No wager yet — propose one, or play for bragging rights.",
  "play.wagerPlaceholder": "e.g. Loser buys Sunday brunch",
  "play.proposeWager": "Propose wager",
  "play.accept": "Accept",
  "play.decline": "Decline",
  "play.waitingAccept": "Waiting for your partner to accept…",
  "play.wagerOn": "Wager on!",
  "play.setStake": "Set a stake",
  "play.setStakeMsg": "Type what the loser owes this week.",
  "play.couldntPropose": "Couldn't propose",
  "play.dailyQuestion": "Daily question",
  "play.justForFun": "just for fun",
  "play.you": "YOU",
  "play.partner": "PARTNER",
  "play.answerPlaceholder": "Type your answer…",
  "play.answerToReveal": "🙈 Answer first to reveal",
  "play.dailyTrivia": "Daily trivia",
  "play.pt1": "+1 PT",
  "play.pickCategory": "Pick a category to start today's round:",
  "play.triviaCorrect": "Nailed it! +1 point 🎉",
  "play.triviaWrong": "Not quite — better luck tomorrow!",
  "play.couldntTrivia": "Couldn't load trivia",
  "play.mission": "Weekly secret mission",
  "play.pts5": "+5 PTS",
  "play.missionSub": "Drops every Monday · hidden from your partner until you pull it off 🤫",
  "play.acceptMission": "Accept mission",
  "play.skip": "Skip",
  "play.markDone": "Mark as done (+5)",
  "play.missionComplete": "Mission complete! +5 points",
  "play.skipped": "Skipped this week",
  "play.partnerDid": "YOUR PARTNER SECRETLY DID",
  "play.partnerSecret": "Your partner has their own secret mission this week…",
  // profile
  "prof.us": "Us",
  "prof.togetherFor": "Together for {n} days",
  "prof.setAnniBelow": "Set your anniversary below 💕",
  "prof.waitingPartner": "Waiting for your partner",
  "prof.shareCodeSub": "Share your invite code so they can join.",
  "prof.leaderboard": "Leaderboard",
  "prof.scoresAfterJoin": "Scores show up once your partner joins.",
  "prof.anniversary": "Anniversary",
  "prof.whenBegin": "When did it all begin?",
  "prof.invalidDate": "Invalid date",
  "prof.invalidDateMsg": "Use the format YYYY-MM-DD, e.g. 2023-06-15.",
  "prof.couldntSave": "Couldn't save",
  "prof.account": "Account",
  "prof.signOut": "Sign out",
  "prof.language": "Language",
  "prof.youSuffix": " (you)",
  "prof.save": "Save",
  // voice
  "voice.recording": "Recording…",
  "voice.tapToRecord": "Tap to record a voice note",
  "voice.upTo": "Up to 1 minute",
  "voice.web": "Voice notes record best on the phone app.",
  "voice.micTitle": "Microphone access needed",
  "voice.micMsg": "Enable microphone access to record a voice note for your memory.",
  "voice.couldntStart": "Couldn't start recording",
  "voice.couldntSave": "Couldn't save recording",
};

const es: Catalog = {
  "common.back": "Regresar",
  "common.cancel": "Cancelar",
  "common.you": "Tú",
  "common.partner": "Tu pareja",
  "common.notNow": "Ahora no",
  "common.openSettings": "Abrir Ajustes",
  "common.tryAgain": "Inténtalo de nuevo.",
  "common.oops": "Ups",
  "tab.home": "Inicio",
  "tab.play": "Jugar",
  "tab.us": "Nosotros",
  "login.badge": "solo nosotros dos",
  "login.subtitle": "Su mundito privado — citas, notas de voz, retos juguetones y los pequeños momentos que nos hacen, nosotros.",
  "login.google": "Continuar con Google",
  "login.terms": "Inicia sesión para conectarte con tu pareja usando un código.",
  "onb.title": "Conéctate con tu\nmedia naranja",
  "onb.subtitle": "Este espacio es solo para ustedes dos. Crea un código para invitar a tu pareja, o ingresa el que te mandaron.",
  "onb.yourCode": "TU CÓDIGO DE INVITACIÓN",
  "onb.share": "Compartir invitación",
  "onb.waiting": "Esperando a que tu pareja se una…",
  "onb.enterApp": "Entrar a la app",
  "onb.enterCode": "INGRESA EL CÓDIGO",
  "onb.codePlaceholder": "ej. AB12CD",
  "onb.linkUs": "Conectarnos",
  "onb.createCode": "Crear código de invitación",
  "onb.haveCode": "Tengo un código",
  "onb.errCode": "Ingresa el código de 6 caracteres que te compartió tu pareja.",
  "onb.shareMsg": "Únete a mí en Daily Dose of Me 💕 Usa mi código: {code}",
  "home.pts": "{n} pts",
  "home.daysTogether": "días juntos",
  "home.setAnniversary": "Pon su aniversario",
  "home.ourMemories": "Nuestros recuerdos",
  "home.thisMonth": "{n} este mes",
  "home.noMemories": "Aún no hay recuerdos este mes",
  "home.noMemoriesSub": "Toca el + para guardar su primera cita.",
  "home.voiceNote": "Nota de voz 🎙️",
  "home.aMoment": "Un momento juntos",
  "cap.title": "Nuevo recuerdo",
  "cap.when": "CUÁNDO",
  "cap.today": "Hoy",
  "cap.photos": "FOTOS ({n}/{max})",
  "cap.library": "Galería",
  "cap.camera": "Cámara",
  "cap.caption": "DESCRIPCIÓN ({n}/{max})",
  "cap.captionPlaceholder": "¿Qué hizo especial este día?",
  "cap.voiceNote": "NOTA DE VOZ",
  "cap.save": "Guardar recuerdo",
  "cap.limitTitle": "Hasta 5 fotos",
  "cap.limitMsg": "Llegaste al límite de fotos.",
  "cap.addSomething": "Agrega algo bonito",
  "cap.addSomethingMsg": "Primero agrega una foto, descripción o nota de voz.",
  "cap.couldntSave": "No se pudo guardar",
  "cap.permTitle": "Permiso necesario",
  "cap.permMsg": "Activa el acceso a fotos en Ajustes para agregar fotos.",
  "day.nothing": "No hay nada guardado este día",
  "day.nothingSub": "Agrega una foto, descripción o nota de voz para recordarlo.",
  "day.add": "Agregar a este día",
  "day.deleteTitle": "¿Eliminar recuerdo?",
  "day.deleteMsg": "Esto no se puede deshacer.",
  "day.delete": "Eliminar",
  "day.someone": "Alguien",
  "day.couldntDelete": "No se pudo eliminar",
  "play.title": "Jueguen juntos",
  "play.subtitle": "Un pequeño juego de nosotros, cada día.",
  "play.wagerTitle": "La apuesta de la semana",
  "play.monSun": "LUN–DOM",
  "play.noWager": "Aún no hay apuesta — propón una, o jueguen por el puro orgullo.",
  "play.wagerPlaceholder": "ej. El perdedor paga el brunch del domingo",
  "play.proposeWager": "Proponer apuesta",
  "play.accept": "Aceptar",
  "play.decline": "Rechazar",
  "play.waitingAccept": "Esperando a que tu pareja acepte…",
  "play.wagerOn": "¡Apuesta aceptada!",
  "play.setStake": "Define la apuesta",
  "play.setStakeMsg": "Escribe lo que debe el perdedor esta semana.",
  "play.couldntPropose": "No se pudo proponer",
  "play.dailyQuestion": "Pregunta del día",
  "play.justForFun": "solo por diversión",
  "play.you": "TÚ",
  "play.partner": "TU PAREJA",
  "play.answerPlaceholder": "Escribe tu respuesta…",
  "play.answerToReveal": "🙈 Responde primero para ver",
  "play.dailyTrivia": "Trivia del día",
  "play.pt1": "+1 PT",
  "play.pickCategory": "Elige una categoría para la ronda de hoy:",
  "play.triviaCorrect": "¡Correcto! +1 punto 🎉",
  "play.triviaWrong": "Casi — ¡mañana será!",
  "play.couldntTrivia": "No se pudo cargar la trivia",
  "play.mission": "Misión secreta semanal",
  "play.pts5": "+5 PTS",
  "play.missionSub": "Llega cada lunes · oculta de tu pareja hasta que lo logres 🤫",
  "play.acceptMission": "Aceptar misión",
  "play.skip": "Saltar",
  "play.markDone": "Marcar como hecho (+5)",
  "play.missionComplete": "¡Misión cumplida! +5 puntos",
  "play.skipped": "Saltada esta semana",
  "play.partnerDid": "TU PAREJA HIZO EN SECRETO",
  "play.partnerSecret": "Tu pareja tiene su propia misión secreta esta semana…",
  "prof.us": "Nosotros",
  "prof.togetherFor": "Juntos por {n} días",
  "prof.setAnniBelow": "Pon su aniversario abajo 💕",
  "prof.waitingPartner": "Esperando a tu pareja",
  "prof.shareCodeSub": "Comparte tu código para que se una.",
  "prof.leaderboard": "Marcador",
  "prof.scoresAfterJoin": "Los puntos aparecen cuando tu pareja se una.",
  "prof.anniversary": "Aniversario",
  "prof.whenBegin": "¿Cuándo empezó todo?",
  "prof.invalidDate": "Fecha inválida",
  "prof.invalidDateMsg": "Usa el formato AAAA-MM-DD, ej. 2023-06-15.",
  "prof.couldntSave": "No se pudo guardar",
  "prof.account": "Cuenta",
  "prof.signOut": "Cerrar sesión",
  "prof.language": "Idioma",
  "prof.youSuffix": " (tú)",
  "prof.save": "Guardar",
  "voice.recording": "Grabando…",
  "voice.tapToRecord": "Toca para grabar una nota de voz",
  "voice.upTo": "Hasta 1 minuto",
  "voice.web": "Las notas de voz funcionan mejor en la app del teléfono.",
  "voice.micTitle": "Se necesita el micrófono",
  "voice.micMsg": "Activa el micrófono para grabar una nota de voz para tu recuerdo.",
  "voice.couldntStart": "No se pudo iniciar la grabación",
  "voice.couldntSave": "No se pudo guardar la grabación",
};

const catalogs: Record<Lang, Catalog> = { en, es };

function detectLang(): Lang {
  try {
    const code = getLocales()[0]?.languageCode?.toLowerCase();
    return code === "es" ? "es" : "en";
  } catch {
    return "en";
  }
}

type I18n = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  ready: boolean;
};

const I18nContext = createContext<I18n>({} as I18n);
export const useI18n = () => useContext(I18nContext);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const l = detectLang();
    dayjs.locale(l === "es" ? "es-mx" : "en");
    return l;
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await storage.getItem<string>(LANG_KEY, "");
      if (stored === "en" || stored === "es") {
        setLangState(stored as Lang);
        dayjs.locale(stored === "es" ? "es-mx" : "en");
      }
      setReady(true);
    })();
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    dayjs.locale(l === "es" ? "es-mx" : "en");
    storage.setItem(LANG_KEY, l);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      let str = catalogs[lang][key] ?? catalogs.en[key] ?? key;
      if (params) {
        Object.keys(params).forEach((p) => {
          str = str.replace(new RegExp(`\\{${p}\\}`, "g"), String(params[p]));
        });
      }
      return str;
    },
    [lang]
  );

  return <I18nContext.Provider value={{ lang, setLang, t, ready }}>{children}</I18nContext.Provider>;
}
