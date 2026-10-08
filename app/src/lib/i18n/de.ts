import type { MessageKey } from "./en";

/** German UI text, formal "Sie". Must cover every key in en.ts. */
export const de: Record<MessageKey, string> = {
  // Language switch
  "language.label": "Sprache",
  // Shared states
  "state.loading": "Ihre Inhalte werden geladen …",
  "state.emptyTitle": "Für {section} wurde noch nichts veröffentlicht",
  "state.emptyBody":
    "Ihre Führungskraft hat diesen Bereich noch nicht veröffentlicht. Er erscheint hier, sobald er freigegeben ist.",
  "state.error":
    "Ihre Onboarding-Inhalte konnten gerade nicht geladen werden. Bitte versuchen Sie es in Kürze erneut.",
  "placeholder.back": "Zurück zum Dashboard",
  "placeholder.wip": "Diese Seite befindet sich im Aufbau.",
  // Root error and 404 pages
  "root.notFoundTitle": "Seite nicht gefunden",
  "root.notFoundBody": "Die gesuchte Seite existiert nicht oder wurde verschoben.",
  "root.goHome": "Zur Startseite",
  "root.errorTitle": "Diese Seite konnte nicht geladen werden",
  "root.errorBody":
    "Bei uns ist etwas schiefgelaufen. Laden Sie die Seite neu oder kehren Sie zur Startseite zurück.",
  "root.errorDetails": "Details",
  "root.tryAgain": "Erneut versuchen",
  "root.setupTitle": "Einrichtung unvollständig",
  "root.setupBody":
    "Tragen Sie sie in die Umgebungsvariablen des Hosting-Anbieters ein (für die Production-Umgebung) und stellen Sie die Seite neu bereit. Sie werden beim Erstellen der Seite gelesen, Speichern allein genügt daher nicht.",
  // Auth
  "auth.email": "E-Mail",
  "auth.password": "Passwort",
  "auth.subtitle": "Zugang zu Ihrem Onboarding-Coach und Ihren Rolleninhalten.",
  "auth.loginTitle": "Bei Onboardie anmelden",
  "auth.loginButton": "Anmelden",
  "auth.toSignup": "Noch kein Konto? Registrieren",
  "auth.signupTitle": "Konto erstellen",
  "auth.fullName": "Vollständiger Name",
  "auth.jobTitle": "Berufsbezeichnung",
  "auth.iAm": "Ich bin",
  "auth.newHire": "Neu im Team",
  "auth.manager": "Führungskraft",
  "auth.startDate": "Startdatum",
  "auth.startDateHint": "Ihr erster Arbeitstag – damit zählen wir Ihre 90 Tage.",
  "auth.inviteCode": "Firmen-/Einladungscode (optional)",
  "auth.inviteHint":
    "Sie haben einen Code von Ihrer Führungskraft erhalten? Geben Sie ihn ein, um dem Unternehmen beizutreten. Ohne Code ordnen wir Sie anhand Ihrer E-Mail-Adresse zu.",
  "auth.signupButton": "Registrieren",
  "auth.toLogin": "Bereits ein Konto? Anmelden",
  "auth.checkEmail":
    "Bitte bestätigen Sie Ihr Konto über den Link in Ihrer E-Mail und melden Sie sich dann an.",
  "auth.signingIn": "Sie werden angemeldet …",
  "auth.err.invalidLogin": "E-Mail-Adresse oder Passwort ist falsch.",
  "auth.err.notConfirmed":
    "Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse – sehen Sie in Ihrem Posteingang nach.",
  "auth.err.alreadyRegistered":
    "Für diese E-Mail-Adresse gibt es bereits ein Konto. Bitte melden Sie sich an.",
  "auth.err.weakPassword": "Bitte wählen Sie ein Passwort mit mindestens 6 Zeichen.",
  "auth.err.rateLimit":
    "Zu viele Versuche. Bitte warten Sie einen Moment und versuchen Sie es erneut.",
  // Sidebar
  "nav.dashboard": "Ihr Onboarding-Dashboard",
  "nav.coach": "Chat mit Ihrem KI-Coach",
  "nav.plan": "Lernplan",
  "nav.resources": "Ressourcen und Tools",
  "nav.contacts": "Ansprechpersonen",
  "nav.roleOverview": "Rollenüberblick & FAQ",
  "nav.settings": "Einstellungen",
  "nav.manager": "Manager-Dashboard",
  "nav.upload": "Rolleninhalte hochladen",
  "nav.review": "Prüfen & Freigeben",
  "nav.manage": "Inhalte verwalten",
  "nav.newHireView": "Ansicht Mitarbeitende",
  "nav.managerView": "Ansicht Führungskraft",
  "nav.managerPortal": "Manager-Portal",
  "nav.sectionManager": "Führungskraft",
  "nav.sectionNewHire": "Neue Mitarbeitende",
  "nav.yourAccount": "Ihr Konto",
  "nav.yourProfile": "Ihr Profil",
  "nav.logout": "Abmelden",
  // Auth callback
  "auth.signInFailed": "Die Anmeldung wurde nicht abgeschlossen. Bitte versuchen Sie es erneut.",
  // Plan phase names (content keeps English keys; these are display only)
  "phase.week": "Woche {n}",
  "phase.month": "Monat {n}",
  "phase.day": "Tag {n}",
  "phase.other": "Weitere Schwerpunkte",
  // New hire dashboard
  "dash.greetMorning": "Guten Morgen",
  "dash.greetAfternoon": "Guten Tag",
  "dash.greetEvening": "Guten Abend",
  "dash.welcome": "Willkommen in Ihrem KI-Onboarding-Tool, {name}",
  "dash.welcomeNoName": "Willkommen in Ihrem KI-Onboarding-Tool",
  "dash.intro": "{greeting} – hier finden Sie alles für Ihre ersten 90 Tage.",
  "dash.workingDays": "Arbeitstage",
  "dash.journey": "Ihr 30/60/90-Tage-Plan",
  "dash.progress": "Arbeitstag {day} von 90 · Woche {week} · {pct} % erledigt",
  "dash.noStart":
    "Tragen Sie Ihr Startdatum in den Einstellungen ein, um Ihre 90 Tage zu verfolgen",
  "dash.phaseBadge": "Phase: {phase}",
  "dash.days": "{n} Tage",
  "dash.stage1": "Lernen & beobachten",
  "dash.stage2": "Mitwirken",
  "dash.stage3": "Verantwortung übernehmen",
  "dash.youreIn": "Sie befinden sich in der Phase „{phase}“.",
  "dash.focus1": "Lernen Sie Ihr Team kennen und schließen Sie die Einführungsmodule ab.",
  "dash.focus2": "Arbeiten Sie mit Unterstützung Ihres Teams an ersten echten Aufgaben mit.",
  "dash.focus3": "Übernehmen Sie die volle Verantwortung für Ihre Aufgaben.",
  "dash.accomplished": "Was Sie bereits erreicht haben",
  "dash.nothingTicked": "Noch nichts abgehakt – beginnen Sie mit Woche 1 in Ihrem Lernplan.",
  "dash.nextSteps": "Nächste Schritte",
  "dash.caughtUp": "Sie sind auf dem aktuellen Stand – gut gemacht.",
  "dash.openPlan": "Lernplan öffnen",
  "dash.quickAccess": "Schnellzugriff",
  "dash.card.coachDesc": "Fragen Sie jederzeit alles. Ihr persönlicher Onboarding-Begleiter.",
  "dash.card.planDesc": "Ihr Weg Schritt für Schritt durch die ersten 90 Tage.",
  "dash.card.resourcesDesc": "Alle Tools, die Sie nutzen werden, und wie sie funktionieren.",
  "dash.card.contactsDesc": "Lernen Sie die Menschen kennen, die Sie unterstützen.",
  "dash.card.roleDesc":
    "Verstehen Sie Ihre Rolle, die Erwartungen und die Antworten auf häufige Fragen.",
  // Onboarding calendar
  "cal.weekdays": "Mo,Di,Mi,Do,Fr",
  "cal.prev": "Vorheriger Monat",
  "cal.next": "Nächster Monat",
  "cal.daysIn": "{n} Tage geschafft",
  "cal.toGo": "noch {n}",
  "cal.holidayTitle": "{name} – Feiertag in Bayern, zählt nicht",
  "cal.countedDay": "Gezählter Onboarding-Tag",
  "cal.upcoming": "Kommender Arbeitstag",
  "cal.legendCounted": "Gezählter Arbeitstag",
  "cal.legendHoliday": "Feiertag in Bayern",
  "cal.today": "Heute",
  "cal.note": "Wochenenden sind ausgeblendet; Wochenenden und bayerische Feiertage zählen nie.",
  // Preview banner
  "preview.title": "Vorschau aus Sicht neuer Mitarbeitender",
  "preview.showing": "Live-Inhalte für",
  "preview.exit": "Vorschau beenden",
  // Invite code card
  "invite.title": "Einladungscode des Unternehmens",
  "invite.body":
    "Geben Sie diesen Code an Ihre neuen Mitarbeitenden weiter, damit sie bei der Registrierung Ihrem Unternehmen beitreten – unabhängig von ihrer E-Mail-Adresse.",
  "invite.copy": "Kopieren",
  "invite.copied": "Kopiert",
  // Company update banner and editor
  "update.badge": "Neuigkeiten aus dem Unternehmen",
  "update.editorTitle": "Banner für Unternehmensneuigkeiten",
  "update.editorBody":
    "Eine aktuelle Meldung, die oben im Dashboard aller neuen Mitarbeitenden erscheint.",
  "update.titleLabel": "Titel",
  "update.titlePlaceholder": "z. B. Q3-Kickoff: Unser neues Mittelstands-Playbook ist online",
  "update.imageLabel": "URL des Titelbilds (optional)",
  "update.linkLabel": "Link-URL (optional)",
  "update.saving": "Wird gespeichert …",
  "update.save": "Meldung speichern",
  "update.saved": "Gespeichert und veröffentlicht.",
  "update.failed": "Speichern fehlgeschlagen – bitte erneut versuchen.",
  // Question topics card (topic names are stored in English)
  "topics.title": "Häufigste Fragen in diesem Monat",
  "topics.subtitleOne": "Alle neuen Mitarbeitenden · {n} Frage",
  "topics.subtitleMany": "Alle neuen Mitarbeitenden · {n} Fragen",
  "topics.loading": "Fragenthemen werden geladen …",
  "topics.error": "Die Fragenthemen konnten gerade nicht geladen werden.",
  "topics.empty":
    "In diesem Monat gab es noch keine Fragen an den KI-Coach. Die Themen erscheinen hier, sobald neue Mitarbeitende Fragen stellen.",
  "topics.chartLabel": "Verteilung der Fragenthemen",
  "topics.questions": "Fragen",
  "topics.noneStored": "Noch keine Fragen gespeichert.",
  "topics.footnote":
    "Klicken Sie auf ein Thema, um die Fragen zu lesen. Die Fragen werden anonym angezeigt und nie einer bestimmten Person zugeordnet.",
  "topic.Tools": "Tools",
  "topic.Process": "Abläufe",
  "topic.Contacts": "Ansprechpersonen",
  "topic.Role Expectations": "Erwartungen an die Rolle",
  "topic.Other": "Sonstiges",
  // AI service messages (sent back by the server)
  "ai.busy":
    "Der KI-Dienst ist gerade ausgelastet – ich habe es mehrmals versucht. Bitte versuchen Sie es gleich noch einmal.",
  "ai.credits":
    "Der KI-Dienst ist nicht verfügbar, weil das Guthaben oder Limit des KI-Kontos erreicht ist. Bitte wenden Sie sich an Ihre Administration.",
  "ai.config":
    "Der KI-Dienst ist auf dem Server nicht richtig eingerichtet. Bitte informieren Sie Ihre Administration.",
  "ai.tooLong":
    "Der Text ist zu lang, um ihn in einem Schritt zu verarbeiten. Bitte teilen Sie ihn in kleinere Abschnitte auf.",
  "ai.network":
    "Der KI-Dienst ist nicht erreichbar. Bitte prüfen Sie Ihre Verbindung und versuchen Sie es erneut.",
  "ai.empty": "Die KI hat diesmal keine Antwort geliefert. Bitte formulieren Sie Ihre Frage um.",
  "ai.unknown":
    "Beim Zugriff auf den KI-Dienst ist etwas schiefgelaufen. Bitte versuchen Sie es erneut.",
  "ai.roleContentUnavailable":
    "Ihre Rolleninhalte können gerade nicht gelesen werden. Bitte versuchen Sie es in Kürze erneut und informieren Sie Ihre Führungskraft, falls das Problem bestehen bleibt.",
  "ai.badFormat":
    "Die Antwort der KI hatte ein unerwartetes Format. Bitte versuchen Sie es erneut oder teilen Sie den Inhalt in kleinere Abschnitte auf.",
  // AI Coach page
  "coach.verified": "Jede Antwort zeigt ihre Quelle",
  "coach.fallback1": "Woran erkenne ich Erfolg in meinen ersten 90 Tagen?",
  "coach.fallback2": "Für welche Tools brauche ich einen Zugang?",
  "coach.fallback3": "An wen wende ich mich, wenn ich nicht weiterkomme?",
  "coach.error": "Der Coach ist gerade nicht erreichbar. Bitte versuchen Sie es erneut.",
  "coach.helloName": "Hallo {name}, wie kann ich Ihnen helfen?",
  "coach.hello": "Hallo, wie kann ich Ihnen helfen?",
  "coach.intro":
    "Fragen Sie alles zu Ihrer Rolle, Ihren Tools oder Ihren ersten Wochen. Die Antworten beruhen auf von Ihrer Führungskraft geprüften Inhalten.",
  "coach.placeholder": "Fragen Sie Ihren KI-Coach …",
  "coach.send": "Nachricht senden",
  "coach.webSources": "Quellen aus dem Web",
  "coach.noWebSources": "Aus allgemeinem Wissen — nicht aus den Dokumenten Ihres Unternehmens und nicht mit Webquellen abgeglichen.",
  "coach.searchSuggestions": "Google-Suchvorschläge",
  "coach.fromRoleDoc": "Aus Ihrem Onboarding-Dokument ({role}):",
  "coach.fromCompanyDoc": "Aus dem unternehmensweiten Dokument „{doc}“:",
  "coach.noDocument": "Für Ihre Rolle („{role}“) ist noch kein Onboarding-Dokument veröffentlicht, daher kann ich nicht daraus antworten. Bitte bitten Sie Ihre Führungskraft, es hochzuladen, oder prüfen Sie Ihre Jobbezeichnung in den Einstellungen.",
  "coach.diagnostics": "Diagnose (nur für Führungskräfte sichtbar)",
  "coach.diagRole": "Verwendetes Rollendokument",
  "coach.diagJobTitle": "Gesuchte Jobbezeichnung",
  "coach.diagDocument": "Dokument",
  "coach.diagChars": "Zeichen",
  "coach.diagOriginal": "Original-Upload",
  "coach.diagSummary": "nur Zusammenfassung — erneut hochladen, um das Original zu speichern",
  "coach.diagCompanyDocs": "unternehmensweite Dokumente",
  "coach.diagAttempt": "KI-Versuch {n}",
  "coach.diagNoQuotes": "Die KI hat auf keine Passagen verwiesen.",
  "coach.fromDocument": "Aus Ihrem Onboarding-Dokument:",
  "coach.notCovered": "Dazu steht nichts in Ihrem Onboarding-Dokument. Bitte fragen Sie Ihre Führungskraft.",
  "coach.newChat": "Neuer Chat",
  "coach.newChatConfirm": "Einen neuen Chat beginnen? Ihr bisheriger Verlauf wird gelöscht.",
  "coach.sources": "Genauer Wortlaut im Dokument ({count})",
  "coach.disclaimer": "Der KI-Coach kann sich irren. Fragen Sie im Zweifel Ihre Führungskraft.",
  // FAQ groups
  "faqcat.tooling": "Tools & Systeme",
  "faqcat.scheduling": "Termine & Zeit",
  "faqcat.process": "Abläufe & Prozesse",
  "faqcat.people": "Menschen & Ansprechpersonen",
  "faqcat.expectations": "Rolle & Erwartungen",
  "faqcat.other": "Weitere Fragen",
  // Role Overview & Q&A page
  "role.subtitle": "Alles Wichtige über Ihre Rolle.",
  "role.subtitleAs": "Alles Wichtige über Ihre Rolle als {role}.",
  "role.loading": "Ihr Rollenüberblick wird geladen …",
  "role.emptyOverview": "Ihren Rollenüberblick",
  "role.nutshell": "Die Rolle auf einen Blick",
  "role.coreFunction": "Kernaufgabe",
  "role.impact": "Ihr Beitrag",
  "role.success": "Woran Erfolg erkennbar ist",
  "role.goodToKnow": "Gut zu wissen",
  "role.keyFacts": "Wichtige Fakten",
  "role.commonQuestions": "Häufige Fragen",
  "role.emptyQuestions": "häufige Fragen",
  // Learning Plan page
  "plan.subtitle": "Ihr Weg Schritt für Schritt durch die ersten 90 Tage.",
  "plan.subtitleAs": "Ihr Weg Schritt für Schritt durch die ersten 90 Tage als {role}.",
  "plan.loading": "Ihr Lernplan wird geladen …",
  "plan.empty": "Ihren Lernplan",
  "plan.overall": "Gesamtfortschritt",
  "plan.progress": "{done} von {total} Aufgaben · {pct} %",
  // Resources and Tools page
  "res.subtitle": "Alle Tools, die Sie nutzen werden – und wie sie funktionieren.",
  "res.subtitleAs": "Alle Tools, die Sie als {role} nutzen werden – und wie sie funktionieren.",
  "res.loading": "Ihre Ressourcen und Tools werden geladen …",
  "res.empty": "Ressourcen und Tools",
  "res.search": "Tools, Ressourcen oder Fachleute suchen …",
  "res.logoAlt": "Logo von {name}",
  "res.useFor": "Wofür Sie es nutzen",
  "res.ask": "Fragen Sie {name}",
  "res.open": "Ressource öffnen",
  "res.noMatch": "Keine Tools passen zu „{query}“.",
  // Who to Contact page
  "contacts.subtitle":
    "Lernen Sie die Menschen kennen, die Sie in Ihren ersten 90 Tagen unterstützen.",
  "contacts.loading": "Ihre Ansprechpersonen werden geladen …",
  "contacts.empty": "Ihre Ansprechpersonen",
  "contacts.search": "Nach Name, Rolle, Abteilung oder E-Mail suchen …",
  "contacts.all": "Alle",
  "contacts.other": "Sonstige",
  "contacts.missing": "Noch nicht angegeben",
  "contacts.noMatch": "Keine Ansprechpersonen passen zu Ihrer Suche.",
  // Settings page
  "settings.previewSubtitle":
    "Vorschaumodus – legen Sie ein Startdatum fest, um zu sehen, wie die 90 Tage aussehen würden.",
  "settings.subtitle": "Ihre Profildaten.",
  "settings.profile": "Profil",
  "settings.managerAccount": "Konto für Führungskräfte",
  "settings.newHireAccount": "Konto für neue Mitarbeitende",
  "settings.loading": "Ihr Profil wird geladen …",
  "settings.notSignedIn": "Sie sind nicht angemeldet.",
  "settings.signIn": "Melden Sie sich an",
  "settings.toManage": ", um Ihr Profil zu verwalten.",
  "settings.role": "Rolle",
  "settings.saving": "Wird gespeichert …",
  "settings.save": "Speichern",
  "settings.saved": "Gespeichert",
  "settings.saveFailed":
    "Ihre Änderungen konnten nicht gespeichert werden. Bitte versuchen Sie es erneut.",
  "settings.language": "Sprache",
  "settings.languageHint":
    "Standardsprache ist Englisch. Ihre Auswahl wird auf diesem Gerät gespeichert.",
  "settings.company": "Unternehmen / Einladungscode",
  "settings.currentlyIn": "Sie gehören derzeit zu {company}.",
  "settings.yourCode":
    "Einladungscode Ihres Unternehmens – geben Sie ihn an Ihr Team weiter, damit es Ihrem Unternehmen beitritt, unabhängig von der E-Mail-Adresse.",
  "settings.joinLabel": "Mit einem Einladungscode einem Unternehmen beitreten",
  "settings.joining": "Beitritt läuft …",
  "settings.join": "Unternehmen beitreten",
  "settings.joinHint":
    "Lassen Sie das Feld leer, um wie bisher anhand Ihrer E-Mail-Adresse zugeordnet zu bleiben.",
  "settings.codeNotFound":
    "Dieser Code passt zu keinem Unternehmen. Bitte prüfen Sie ihn mit der Person, die ihn Ihnen gegeben hat.",
  "settings.joinFailed": "Der Beitritt ist gerade nicht möglich. Bitte versuchen Sie es erneut.",
  "settings.joined": "Sie gehören jetzt zu {company}.",
  // Manager dashboard
  "mgr.subtitle":
    "Verfolgen Sie das Onboarding in Ihrem Team und halten Sie die Rolleninhalte aktuell.",
  "mgr.roles": "Rollen",
  "mgr.rolesHint":
    "Ihre eigenen Rollen sind nur für Ihr Unternehmen sichtbar. Beispielrollen sind Muster von Onboardie und für alle Konten sichtbar.",
  "mgr.loadingRoles": "Rollen werden geladen …",
  "mgr.noRoles": "Noch keine eigenen Rollen",
  "mgr.noRolesBody":
    "Laden Sie Ihre erste Rolle hoch, um loszulegen – die Beispielrollen dienen als Vorlage.",
  "mgr.live": "Live",
  "mgr.companyContent": "Inhalte Ihres Unternehmens",
  "mgr.mockupRole": "Beispielrolle",
  "mgr.exampleContent": "Beispielinhalt · nur ansehen",
  // File reading errors
  "file.empty":
    "Diese Datei scheint leer zu sein. Wählen Sie eine andere Datei oder fügen Sie den Text unten ein.",
  "file.tooLarge":
    "Diese Datei ist größer als 25 MB. Verwenden Sie eine kleinere Datei oder fügen Sie den Text unten ein.",
  "file.oldDoc":
    "Ältere Word-Dateien (.doc) können nicht gelesen werden. Speichern Sie die Datei als .docx oder PDF oder fügen Sie den Text unten ein.",
  "file.unsupportedExport":
    ".{ext}-Dateien werden nicht unterstützt. Exportieren Sie die Datei als PDF, .docx oder .txt oder fügen Sie den Text unten ein.",
  "file.unsupported":
    ".{ext}-Dateien können nicht gelesen werden. Verwenden Sie PDF, Word (.docx) oder .txt oder fügen Sie den Text unten ein.",
  "file.unreadable":
    "Diese Datei konnte nicht gelesen werden – sie ist möglicherweise passwortgeschützt oder beschädigt. Fügen Sie den Text stattdessen direkt ein.",
  "file.scannedPdf":
    "Dieses PDF enthält keinen lesbaren Text – es scheint ein Scan oder ein Bild zu sein. Verwenden Sie ein textbasiertes PDF oder fügen Sie den Text unten ein.",
  "file.noText":
    "In dieser Datei wurde kein lesbarer Text gefunden. Fügen Sie den Text stattdessen direkt ein.",
  // Upload Role Content page
  "upload.intro":
    "Fügen Sie Ihre Onboarding-Notizen, Dokumente oder sonstiges vorhandenes Material ein – wir gliedern es für Sie in Rollenüberblick, Lernplan, FAQ, Tools und Ansprechpersonen. Sie können mehrere Dateien auf einmal hinzufügen.",
  "upload.role": "Rolle",
  "upload.rolePlaceholder": "Berufsbezeichnung eingeben, z. B. Sales Development Representative",
  "upload.roleMissing":
    "Geben Sie vor dem Strukturieren die Berufsbezeichnung ein – neue Mitarbeitende sehen die Inhalte, die zu ihrer eigenen Berufsbezeichnung passen.",
  "upload.roleHint":
    "Neue Mitarbeitende sehen die Inhalte für ihre eigene Berufsbezeichnung – verwenden Sie daher genau dieselbe Schreibweise.",
  "upload.reading": "Dateien werden gelesen …",
  "upload.uploadFiles": "Dateien hochladen",
  "upload.fileTypes":
    "PDF, Word (.docx), .txt oder .rtf – auch mehrere Dateien gleichzeitig oder per Drag & Drop, oder",
  "upload.pasteBelow": "fügen Sie Ihre Inhalte unten ein.",
  "upload.words": "{n} Wörter",
  "upload.scopeFor": "Geltungsbereich für {name}",
  "upload.roleSpecific": "Rollenspezifisch",
  "upload.companyWide": "Unternehmensweit",
  "upload.remove": "{name} entfernen",
  "upload.scopeHint":
    "Unternehmensweite Dateien (z. B. eine HR-Richtlinie) werden zusätzlich für das ganze Unternehmen gespeichert, damit der KI-Coach sie auch für andere Rollen nutzen kann. Rollenspezifische Dateien bleiben bei dieser Rolle.",
  "upload.fileFailed":
    "Diese Datei konnte nicht gelesen werden. Fügen Sie den Text stattdessen direkt ein.",
  "upload.material": "Onboarding-Material",
  "upload.totalWords": "{n} Wörter insgesamt",
  "upload.textPlaceholder":
    "Fügen Sie Onboarding-Notizen, Dokumente, Checklisten oder Playbooks ein – alles, was Sie bereits haben. Die Strukturierung übernehmen wir.",
  "upload.draftSaved": "Als Entwurf gespeichert – Sie finden ihn unter „Prüfen & Freigeben“.",
  "upload.nothingPublished":
    "Nichts wird veröffentlicht, bevor Sie es geprüft und freigegeben haben.",
  "upload.draftWhere": "Ihr Entwurf wird unter „Prüfen & Freigeben“ gespeichert.",
  "upload.savingDraft": "Entwurf wird gespeichert …",
  "upload.saveDraft": "Als Entwurf speichern",
  "upload.structuring": "Ihre Inhalte werden strukturiert …",
  "upload.structure": "Strukturieren",
  "upload.noCompany":
    "Wir konnten Ihr Konto keinem Unternehmen zuordnen. Bitte kontaktieren Sie uns.",
  "upload.draftFailed":
    "Ihr Entwurf konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.",
  "upload.draftOffline":
    "Ihr Entwurf konnte nicht gespeichert werden. Bitte prüfen Sie Ihre Verbindung und versuchen Sie es erneut.",
  "upload.structureOffline":
    "Der Strukturierungsdienst ist nicht erreichbar. Bitte prüfen Sie Ihre Verbindung und versuchen Sie es erneut.",
  // Review & Approve page
  "section.overview": "Rollenüberblick",
  "section.overviewDesc": "Worum es in dieser Rolle geht und woran Erfolg erkennbar ist.",
  "section.plan": "Lernplan",
  "section.planDesc": "Der 30/60/90-Tage-Plan für die ersten drei Monate.",
  "section.faq": "FAQ",
  "section.faqDesc": "Häufige Fragen mit geprüften Antworten.",
  "section.tools": "Tools & ihre Nutzung",
  "section.toolsDesc": "Die Systeme, mit denen diese Rolle täglich arbeitet.",
  "section.contacts": "Ansprechpersonen",
  "section.contactsDesc": "Die Menschen, die neue Mitarbeitende unterstützen.",
  "section.facts": "Wichtige Fakten",
  "section.factsDesc": "Urlaub, Budgets, Arbeitszeiten und weitere konkrete Angaben.",
  "review.today": "heute, {time}",
  "review.listIntro":
    "Rollen, die auf Ihre Freigabe warten. Nach der Veröffentlichung finden Sie sie unter „Inhalte verwalten“.",
  "review.uploadNew": "Neue Rolle hochladen",
  "review.listFailed":
    "Die Rollen zur Prüfung konnten nicht geladen werden. Bitte versuchen Sie es in Kürze erneut.",
  "review.deleteFailed":
    "Dieser Entwurf konnte nicht gelöscht werden. Bitte versuchen Sie es erneut.",
  "review.loadingList": "Rollen zur Prüfung werden geladen …",
  "review.nothing": "Nichts zu prüfen",
  "review.nothingBody":
    "Alles, was Sie strukturiert haben, ist veröffentlicht. Laden Sie neues Material hoch, um eine weitere Rolle hinzuzufügen.",
  "review.statusRaw": "Gespeicherter Entwurf – noch nicht strukturiert",
  "review.statusRevised": "Überarbeitet – erneute Freigabe ausstehend",
  "review.statusDraft": "Entwurf – erste Prüfung ausstehend",
  "review.lastSaved": "Zuletzt gespeichert: {date}",
  "review.lastStructured": "Zuletzt strukturiert: {date}",
  "review.resume": "Fortsetzen",
  "review.review": "Prüfen",
  "review.delete": "Löschen",
  "review.deleteTitle": "Diesen Entwurf löschen?",
  "review.deleteBody":
    "Dies kann nicht rückgängig gemacht werden. Die gespeicherten Inhalte für {role} werden endgültig gelöscht.",
  "review.cancel": "Abbrechen",
  "review.deleteDraft": "Entwurf löschen",
  "review.notManager": "Nur Konten von Führungskräften können Rolleninhalte veröffentlichen.",
  "review.publishFailed":
    "Beim Veröffentlichen ist etwas schiefgelaufen – Ihre Änderungen sind hier gespeichert. Bitte versuchen Sie es erneut.",
  "review.backToList": "Alle Rollen zur Prüfung",
  "review.introMockup":
    "Dies ist eine Beispielrolle von Onboardie. Bearbeiten Sie sie nach Belieben und veröffentlichen Sie sie – sie wird als Rolle Ihres Unternehmens gespeichert, das Beispiel bleibt unverändert.",
  "review.introLive":
    "Diese Inhalte sehen neue Mitarbeitende derzeit. Klicken Sie auf den Stift eines Abschnitts, um ihn zu bearbeiten, und veröffentlichen Sie dann Ihre Änderungen.",
  "review.introNew":
    "Wir haben Ihr Material in die folgenden Abschnitte gegliedert. Klicken Sie auf den Stift eines Abschnitts, um ihn zu bearbeiten, und veröffentlichen Sie, sobald alles passt.",
  "review.visibility":
    "Mit der Freigabe sehen die neuen Mitarbeitenden Ihres Unternehmens in der Rolle {role} diese Inhalte. Andere Unternehmen sehen sie nie.",
  "review.loadingLive": "Die aktuellen Inhalte dieser Rolle werden geladen …",
  "review.doneEditing": "Bearbeitung von {section} abschließen",
  "review.editSection": "{section} bearbeiten",
  "review.done": "Fertig",
  "review.edit": "Bearbeiten",
  "review.removeLine": "Zeile entfernen",
  "review.addLine": "Zeile hinzufügen",
  "review.emptySection": "Noch keine Inhalte – fügen Sie über „Bearbeiten“ welche hinzu.",
  "review.published": "Veröffentlicht – neue Mitarbeitende sehen diese Inhalte jetzt",
  "review.backToUpload": "Zurück zum Hochladen",
  "review.publishing": "Wird veröffentlicht …",
  "review.approve": "Freigeben & veröffentlichen",
  // Manage Content page
  "manage.subtitle": "Veröffentlichte Rolleninhalte, die neue Mitarbeitende derzeit sehen.",
  "manage.failed":
    "Ihre veröffentlichten Inhalte konnten gerade nicht geladen werden. Bitte versuchen Sie es in Kürze erneut.",
  "manage.yourRoles": "Rollen Ihres Unternehmens",
  "manage.noRoles":
    "Sie haben noch keine Rollen hinzugefügt. Die Beispielrollen unten stammen von Onboardie – laden Sie Ihre erste Rolle hoch, um loszulegen. Was Sie hochladen, sieht nur Ihr eigenes Unternehmen.",
  "manage.lastUpdated": "Zuletzt aktualisiert: {date}",
  "manage.preview": "Aus Sicht neuer Mitarbeitender ansehen",
  "manage.delete": "Löschen",
  "manage.deleteRole": "{role} löschen",
  "manage.deleteTitle": "„{role}“ löschen?",
  "manage.deleteBody": "Neue Mitarbeitende mit dieser Rolle sehen deren Inhalte dann nicht mehr, und der KI-Coach antwortet nicht mehr daraus. Das lässt sich nicht rückgängig machen — Sie können das Dokument später erneut hochladen.",
  "manage.deleteCancel": "Abbrechen",
  "manage.deleteConfirm": "Rolle löschen",
  "manage.deleting": "Wird gelöscht…",
  "manage.deleteFailed": "Die Rolle konnte gerade nicht gelöscht werden — bitte versuchen Sie es erneut.",
  "manage.deleteNotManager": "Nur Führungskräfte können Rollen löschen.",
  "manage.mockups": "Beispielrollen",
  "manage.mockupsHint":
    "Beispielinhalte von Onboardie, für alle Konten sichtbar, damit Sie sehen, wie eine fertige Rolle aussieht. Öffnen Sie eine als Ausgangspunkt – beim Speichern entsteht eine Kopie in Ihrem Unternehmen, das Beispiel bleibt unverändert.",
  "manage.view": "Ansehen",
  // AI setup details
  "ai.detail": "Technische Details für Ihre Administration: {detail}",
  // Role picker
  "rolePicker.choose": "Rolle auswählen …",
  "rolePicker.other": "Meine Rolle ist nicht aufgeführt – selbst eingeben",
  "rolePicker.typePlaceholder": "Berufsbezeichnung eingeben",
  "rolePicker.hint": "Das sind die Rollen, die Ihr Unternehmen veröffentlicht hat. Wählen Sie Ihre aus, um die passenden Onboarding-Inhalte zu sehen.",
  "rolePicker.otherHint": "Diese Rolle wurde noch nicht veröffentlicht. Sie sehen die Inhalte, sobald Ihre Führungskraft eine Rolle mit diesem Namen veröffentlicht.",
  // Sign-up invite code check
  "invite.checking": "Code wird geprüft …",
  "invite.joining": "Sie treten {company} bei.",
  "invite.notFound": "Dieser Code wurde nicht gefunden – bitte prüfen Sie ihn mit Ihrer Führungskraft.",
  // Team overview (Manager Dashboard)
  "team.title": "Ihr Team",
  "team.subtitle": "Alle, die sich in Ihrem Unternehmen registriert haben, und welche veröffentlichte Rolle neue Mitarbeitende sehen.",
  "team.summary": "{people} Personen · {hires} neue Mitarbeitende · {unmatched} ohne passende Inhalte",
  "team.loading": "Ihr Team wird geladen …",
  "team.error": "Ihr Team konnte gerade nicht geladen werden. Bitte versuchen Sie es in Kürze erneut.",
  "team.empty": "Bisher hat sich noch niemand registriert. Geben Sie Ihren Einladungscode oben an neue Mitarbeitende weiter.",
  "team.colPerson": "Person",
  "team.colJobTitle": "Berufsbezeichnung",
  "team.colContent": "Onboarding-Inhalte",
  "team.colProgress": "Fortschritt",
  "team.colJoined": "Registriert",
  "team.manager": "Führungskraft",
  "team.newHire": "Neu im Team",
  "team.matched": "Sieht „{role}“",
  "team.noMatch": "Keine passenden Inhalte",
  "team.noTitle": "Keine Berufsbezeichnung",
  "team.noStart": "Kein Startdatum",
  "team.notStarted": "Beginnt am {date}",
  "team.dayOf": "Tag {day} von 90 · {phase}",
  "team.mismatchHint": "Personen ohne passende Inhalte sehen leere Seiten. Veröffentlichen Sie eine Rolle mit ihrer Berufsbezeichnung oder bitten Sie sie, ihre Rolle in den Einstellungen auszuwählen.",
  "team.notApplicable": "—",
  // Team overview access
  "team.notManager": "Nur Konten von Führungskräften können die Teamübersicht sehen.",
  // Mobile navigation
  "nav.openMenu": "Menü öffnen",
  "nav.menu": "Menü",
  "nav.menuDescription": "Seiten, Sprache und Konto",
};
