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
