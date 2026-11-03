export const TIKTOK_GIFT_CATALOG = [
  {
    key: 'rose',
    giftId: 5655,
    name: 'Rose',
    displayName: 'Rosa',
    aliases: ['rose', 'rosa'],
    icon: '🌹',
    coins: 1,
  },
  {
    key: 'tiktok',
    giftId: 5269,
    name: 'TikTok',
    displayName: 'TikTok',
    aliases: ['tiktok', 'tik tok'],
    icon: '🎵',
    coins: 1,
  },
  {
    key: 'ice_cream',
    giftId: 5827,
    name: 'Ice Cream Cone',
    displayName: 'Sorvete',
    aliases: ['ice cream cone', 'ice cream', 'sorvete', 'casquinha'],
    icon: '🍦',
    coins: 1,
  },
  {
    key: 'gg',
    giftId: 6064,
    name: 'GG',
    displayName: 'GG',
    aliases: ['gg'],
    icon: '🎮',
    coins: 1,
  },
  {
    key: 'finger_heart',
    giftId: 5487,
    name: 'Finger Heart',
    displayName: 'Coração de Dedo',
    aliases: ['finger heart', 'coracao de dedo', 'coracao', 'mini coracao'],
    icon: '🫰',
    coins: 5,
  },
  {
    key: 'perfume',
    giftId: 5658,
    name: 'Perfume',
    displayName: 'Perfume',
    aliases: ['perfume'],
    icon: '🧴',
    coins: 20,
  },
  {
    key: 'doughnut',
    giftId: 5879,
    name: 'Doughnut',
    displayName: 'Rosquinha',
    aliases: ['doughnut', 'donut', 'rosquinha'],
    icon: '🍩',
    coins: 30,
  },
  {
    key: 'paper_crane',
    giftId: 5659,
    name: 'Paper Crane',
    displayName: 'Origami / Foguete',
    aliases: ['paper crane', 'origami', 'grou de papel', 'foguete'],
    icon: '🚀',
    coins: 99,
  },
  {
    key: 'cap',
    giftId: 6097,
    name: 'Cap',
    displayName: 'Boné',
    aliases: ['cap', 'bone'],
    icon: '🧢',
    coins: 99,
  },
  {
    key: 'little_crown',
    giftId: 6104,
    name: 'Little Crown',
    displayName: 'Coroa',
    aliases: ['little crown', 'crown', 'coroa', 'pequena coroa'],
    icon: '👑',
    coins: 99,
  },
  {
    key: 'confetti',
    giftId: 5994,
    name: 'Confetti',
    displayName: 'Confete',
    aliases: ['confetti', 'confete', 'papel picado'],
    icon: '🎉',
    coins: 100,
  },
  {
    key: 'sunglasses',
    giftId: 5509,
    name: 'Sunglasses',
    displayName: 'Óculos',
    aliases: ['sunglasses', 'oculos', 'oculos escuros'],
    icon: '🕶️',
    coins: 199,
  },
  {
    key: 'galaxy',
    giftId: 5870,
    name: 'Galaxy',
    displayName: 'Galáxia',
    aliases: ['galaxy', 'galaxia'],
    icon: '🌌',
    coins: 1000,
  },
];

export const DEFAULT_GIFT_POWERS = {
  eliminateWrong: {
    action: 'eliminateWrong',
    label: 'Eliminar Errada',
    shortLabel: '-1 Errada',
    description: 'Elimina uma alternativa incorreta da pergunta atual',
    giftId: 5655,
    giftName: 'Rose',
    displayName: 'Rosa',
    aliases: ['rose', 'rosa'],
    icon: '🌹',
    coins: 1,
    enabled: true,
  },
  showHint: {
    action: 'showHint',
    label: 'Pedir Dica',
    shortLabel: 'Ver Dica',
    description: 'Revela uma dica inteligente na tela para ajudar a acertar',
    giftId: 5487,
    giftName: 'Finger Heart',
    displayName: 'Coração',
    aliases: ['finger heart', 'coracao de dedo', 'coracao'],
    icon: '🫰',
    coins: 5,
    enabled: true,
  },
  revealAnswer: {
    action: 'revealAnswer',
    label: 'Ver Resposta',
    shortLabel: 'Resposta',
    description: 'Revela imediatamente qual é a alternativa correta na tela',
    giftId: 5879,
    giftName: 'Doughnut',
    displayName: 'Rosquinha',
    aliases: ['doughnut', 'donut', 'rosquinha'],
    icon: '🍩',
    coins: 30,
    enabled: true,
  },
  buyPoint: {
    action: 'buyPoint',
    label: 'Comprar Ponto',
    shortLabel: '+1 Ponto',
    description: 'Adiciona ponto(s) direto no seu placar do Ranking Top 5',
    giftId: 6104,
    giftName: 'Little Crown',
    displayName: 'Coroa',
    aliases: ['little crown', 'crown', 'coroa', 'pequena coroa'],
    icon: '👑',
    coins: 99,
    pointsAwarded: 1,
    enabled: true,
  },
  skipQuestion: {
    action: 'skipQuestion',
    label: 'Outra Pergunta',
    shortLabel: 'Pular Quiz',
    description: 'Pula a pergunta atual e gera outra nova com a IA',
    giftId: 5994,
    giftName: 'Confetti',
    displayName: 'Confete',
    aliases: ['confetti', 'confete', 'papel picado'],
    icon: '🎉',
    coins: 100,
    enabled: true,
  },
};

export function normalizeText(str = '') {
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function matchGiftToPower(incomingGift, giftPowers) {
  const incomingId = Number(incomingGift.giftId || 0);
  const incomingNameNorm = normalizeText(incomingGift.giftName || '');

  for (const [powerKey, cfg] of Object.entries(giftPowers || {})) {
    if (!cfg || cfg.enabled === false) continue;

    if (incomingId > 0 && Number(cfg.giftId) > 0 && incomingId === Number(cfg.giftId)) {
      return { powerKey, powerConfig: cfg };
    }

    if (incomingNameNorm) {
      const candidateNames = [
        cfg.giftName,
        cfg.displayName,
        ...(Array.isArray(cfg.aliases) ? cfg.aliases : []),
      ]
        .filter(Boolean)
        .map(normalizeText);

      if (candidateNames.includes(incomingNameNorm)) {
        return { powerKey, powerConfig: cfg };
      }
    }
  }

  return null;
}
