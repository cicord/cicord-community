/**
 * Interface copy (French). `spec.portal.locale` (or the browser language) picks the
 * language; add a file next to this one to support another. Texts that come from the server
 * config (title, description, step titles…) are not here.
 */
export const fr = {
  locale: "fr-FR",
  loading: "Chargement…",
  portalOf: (server: string) => `Le portail de ${server}`,
  login: "Se connecter avec Discord",
  loginShort: "Se connecter",
  logout: "Se déconnecter",
  loggingIn: "Connexion en cours…",
  profile: "Mon profil",
  demoMode: "Démo : données fictives, aucune connexion à Discord",
  skip: "Aller au contenu",
  poweredBy: (server: string) => `Portail de ${server}, propulsé par`,

  nav: {
    label: "Navigation du portail",
    home: "Accueil",
    leaderboard: "Classement",
    tickets: "Tickets",
    profile: "Profil",
    developers: "Développeurs",
    switchServer: "Changer de serveur",
  },

  signIn: {
    simTitle: "Simulateur Discord",
    simText: "Ce runtime tourne avec le simulateur (cicord dev --sim) : connecte-toi en tant que :",
    owner: "propriétaire",
  },

  home: {
    loggedOutTitle: "Connecte-toi pour commencer",
    loggedOut: "Avec ton compte Discord, choisis tes rôles et retrouve ton profil de membre.",
    hello: (name: string) => `Salut ${name} !`,
    about: "À propos",
    links: "Liens",
    onboardingTitle: "Choisir mes rôles",
    onboardingTodo: "Quelques questions pour débloquer tes salons.",
    onboardingDone: "C'est fait. Tu peux changer tes réponses quand tu veux.",
    profileTitle: "Mon profil",
    profileText: "Ton pseudo, tes rôles et ta date d'arrivée.",
    leaderboardTitle: "Classement",
    leaderboardText: "Les membres les plus actifs du serveur.",
    ticketsTitle: "Tickets",
    ticketsText: "Les demandes des membres à traiter.",
    notMember:
      "Ton compte Discord n'est pas encore membre de ce serveur. Rejoins-le, puis reviens ici.",
  },

  onboarding: {
    step: (n: number, total: number) => `Question ${n} sur ${total}`,
    progress: "Progression",
    multiple: "Plusieurs choix possibles",
    single: "Un seul choix",
    optional: "Facultatif",
    required: "Obligatoire",
    back: "Retour",
    next: "Suivant",
    finish: "Valider mes rôles",
    saving: "Enregistrement…",
    pickOne: "Choisis au moins une option pour continuer.",
    previewTitle: "Aperçu de ton profil",
    previewRoles: "Rôles",
    noRoles: "Aucun rôle pour l'instant.",
    doneTitle: "Tes rôles sont à jour",
    added: (n: number) =>
      n === 0 ? "Aucun nouveau rôle." : n === 1 ? "1 nouveau rôle." : `${n} nouveaux rôles.`,
    openDiscord: "Retourner sur Discord",
    edit: "Modifier mes réponses",
    loginTitle: "Connecte-toi pour choisir tes rôles",
    loginText:
      "Le lien envoyé par le bot te connecte automatiquement. Tu peux aussi te connecter avec ton compte Discord.",
    linkFailed:
      "Ce lien a expiré ou a déjà servi. Tape /onboarding sur Discord pour en recevoir un nouveau, ou connecte-toi.",
    unavailable: "L'onboarding n'est pas activé sur ce serveur.",
    forbidden: "Tu dois être membre du serveur Discord pour choisir tes rôles.",
    failed: "Impossible de charger les questions.",
    retry: "Réessayer",
  },

  me: {
    title: "Mon profil",
    since: (date: string) => `Membre depuis le ${date}`,
    roles: "Rôles",
    access: { admin: "Administrateur", moderator: "Modérateur", member: "Membre" } as Record<
      string,
      string
    >,
    editRoles: "Modifier mes rôles",
    loginTitle: "Connecte-toi pour voir ton profil",
    level: (level: number) => `Niveau ${level}`,
    xp: (xp: string) => `${xp} XP`,
    rank: (rank: number) => `${rank}ᵉ du classement`,
  },

  leaderboard: {
    title: "Classement",
    lead: "Les membres les plus actifs, mis à jour en direct par le bot.",
    empty: "Personne n'a encore gagné d'XP. Envoie un message sur Discord pour ouvrir le bal !",
    level: "Niveau",
    xp: "XP",
    member: "Membre",
    you: "toi",
    failed: "Impossible de charger le classement.",
  },

  tickets: {
    title: "Tickets",
    lead: "Les demandes ouvertes par les membres avec /ticket.",
    all: "Tous",
    open: "Ouverts",
    closed: "Fermés",
    filter: "Filtrer les tickets",
    subject: "Sujet",
    author: "Auteur",
    opened: "Ouvert le",
    status: { open: "Ouvert", closed: "Fermé" } as Record<string, string>,
    empty: "Aucun ticket ici.",
    forbidden: "Réservé à l'équipe de modération.",
    failed: "Impossible de charger les tickets.",
    loginTitle: "Connecte-toi pour voir les tickets",
  },

  developers: {
    title: "Développeurs",
    lead: "Tout ce que ce portail utilise, à reproduire avec @cicord/client et @cicord/react dans ton propre site.",
    session: "Session",
    mode: "Mode d'authentification",
    cookie: "cookie (même site)",
    token: "jeton bearer (site intégré)",
    api: "API du runtime",
    user: "Utilisateur",
    role: "Rôle d'accès",
    expires: "Expire",
    signedOut: "Non connecté",
    endpoints: "Endpoints du portail",
    server: "Configuration du serveur",
    plugins: "Routes des plugins",
    noPlugins: "Aucun plugin n'expose de route sur ce serveur.",
    run: "Appeler",
    params: "Cette route a des paramètres : appelle-la depuis ton code.",
    response: "Réponse",
  },

  notFound: {
    title: "Page introuvable",
    text: "Ce lien ne mène nulle part. Retourne à l'accueil du portail.",
    home: "Accueil",
  },

  noServer: {
    title: "Aucun portail ici",
    text: "Ce runtime Cicord ne publie de portail pour aucun serveur. Ajoute `portal:` dans servers/<serveur>.yaml.",
  },
  unknownServer: (key: string) => `Le serveur « ${key} » n'a pas de portail.`,
  apiDown: "Le portail ne répond pas. Réessaie dans un instant.",
};

export type Messages = typeof fr;
