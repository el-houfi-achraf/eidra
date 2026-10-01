import { z } from 'zod';
const DialogueSchema = z.object({
  speaker: z.string(),
  lines: z.array(z.string()).min(1),
  flag: z.string(),
});
export const dialogues = {
  mira: DialogueSchema.parse({
    speaker: 'MIRA',
    flag: 'met-mira',
    lines: [
      'Tu marches comme quelqu’un que j’ai connu.',
      'Il laissait toujours cette porte ouverte. Pour que je retrouve le chemin.',
      'Ici, les murs ont oublié de tomber. Écoute-les : ils se souviennent encore.',
      'Le pont, plus loin, s’est effacé. Ce qu’on voulait oublier, on le descendait dans le puits.',
      'Si tu veux qu’il revienne, c’est en bas qu’il faut chercher.',
    ],
  }),
  miraReturn: DialogueSchema.parse({
    speaker: 'MIRA',
    flag: 'mira-return',
    lines: [
      'Cette lumière… Aren la dessinait du bout des doigts.',
      'Garde-la. Même si tu ne sais pas encore à qui elle appartient.',
    ],
  }),
  kael: DialogueSchema.parse({
    speaker: 'FRAGMENT · KAEL',
    flag: 'memory-kael',
    lines: [
      '« On m’a ordonné de fermer la porte. Il y avait encore des voix derrière. »',
      'Une main qui n’est pas la vôtre tremble. Puis elle s’ouvre.',
    ],
  }),
  seris: DialogueSchema.parse({
    speaker: 'FRAGMENT · SERIS',
    flag: 'memory-seris',
    lines: [
      '« Rien ne doit être éternel. Pas même ce que nous avons construit. »',
      'Sous la poussière, les machines attendent une permission de s’arrêter.',
    ],
  }),
  // Act I — fragments hidden in the depths and the lofts of the laboratory.
  deren: DialogueSchema.parse({
    speaker: 'FRAGMENT · DEREN',
    flag: 'memory-deren',
    lines: [
      '« J’ai classé chaque nom. Puis on m’a demandé d’en effacer un. Un seul. »',
      'Une plume s’arrête au-dessus d’une page. L’encre sèche avant qu’elle ne se décide.',
    ],
  }),
  noa: DialogueSchema.parse({
    speaker: 'FRAGMENT · NOA',
    flag: 'memory-noa',
    lines: [
      '« Je montais ici pour regarder la ville respirer. Un soir, elle a retenu son souffle. »',
      'Le vent passe encore par la lucarne. Il porte une chanson que plus personne ne chante.',
    ],
  }),
  aren: DialogueSchema.parse({
    speaker: 'FRAGMENT · AREN',
    flag: 'memory-aren',
    lines: [
      '« Mira, si tu trouves ceci, ne m’attends pas. Laisse la porte ouverte quand même. »',
      'Un dessin d’enfant gravé dans la pierre : deux silhouettes et une porte. L’une d’elles a été grattée.',
    ],
  }),
  sael: DialogueSchema.parse({
    speaker: 'SAEL VEYR · TRANSMISSION',
    flag: 'heard-sael',
    lines: [
      'Prototype sept. Si vous entendez ceci, le laboratoire vous reconnaît.',
      'Le gardien obéit toujours. Rendez-lui le silence.',
    ],
  }),
  aftermath: DialogueSchema.parse({
    speaker: 'MIRA',
    flag: 'slice-complete',
    lines: [
      'Il pouvait enfin désobéir.',
      'Au-delà de cette porte, la cendre garde encore nos pas.',
      'Si tu retrouves mon frère… dis-lui que j’ai laissé la porte ouverte.',
    ],
  }),
  // Act II — Les Failles de cendre.
  nhalis: DialogueSchema.parse({
    speaker: 'SAEL VEYR · TRANSMISSION',
    flag: 'heard-nhalis',
    lines: [
      'Prototype sept, vous avez passé la porte. Nhalis brûle encore sous la cendre.',
      'Au fond des Failles, quelqu’un refuse toujours de regarder ce qui est arrivé. Ilyra.',
      'Ne la laissez pas vous fermer les yeux.',
    ],
  }),
  ilyan: DialogueSchema.parse({
    speaker: 'FRAGMENT · ILYAN',
    flag: 'memory-ilyan',
    lines: [
      '« Tant que les forges brûlent, personne ne demande ce qu’elles consument. »',
      'Une chaleur ancienne dans une paume de céramique. Elle ne vous brûle pas.',
    ],
  }),
  vaela: DialogueSchema.parse({
    speaker: 'FRAGMENT · VAELA',
    flag: 'memory-vaela',
    lines: [
      '« J’ai sauté par-dessus la faille pour qu’il me voie partir. Il a détourné les yeux. »',
      'Le vide sous vos pieds garde la forme d’un pas qui n’est jamais revenu.',
    ],
  }),
  ilyra: DialogueSchema.parse({
    speaker: 'ILYRA',
    flag: 'heard-ilyra',
    lines: [
      'Ne regarde pas. Tant que personne ne regarde, rien n’est arrivé.',
      'Ils sont tous là, dans le jardin. Ils dorment. Ils vont bien.',
      'Ferme les yeux, prototype. Je vais te montrer comme c’est doux.',
    ],
  }),
  epilogue: DialogueSchema.parse({
    speaker: 'MIRA',
    flag: 'act2-complete',
    lines: [
      'Elle a regardé. Enfin.',
      'Les cendres se sont tues. Derrière le jardin, le verre commence à chanter.',
      'Garde tes souvenirs près de toi, Eidra. Les Jardins de verre n’oublient rien.',
    ],
  }),
};
export type DialogueId = keyof typeof dialogues;
export const fundamentalMemories = [
  'kael',
  'seris',
  'ilyan',
  'vaela',
  'deren',
  'noa',
  'aren',
] as const;
