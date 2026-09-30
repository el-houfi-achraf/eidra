import { z } from 'zod';
const QuestSchema = z.object({
  id: z.string(),
  type: z.enum(['main', 'side', 'hidden', 'character', 'memory']),
  title: z.string(),
  requires: z.array(z.string()),
  complete: z.array(z.string()),
});
export const questData = [
  {
    id: 'awakening',
    type: 'main',
    title: 'Retrouver un passage vers la cité',
    requires: [],
    complete: ['boss-defeated'],
  },
  {
    id: 'mira',
    type: 'character',
    title: 'Écouter la femme au halo brisé',
    requires: [],
    complete: ['met-mira'],
  },
  {
    id: 'echo',
    type: 'main',
    title: 'Laisser un Écho sur le sceau du contrepoids',
    requires: ['met-mira'],
    complete: ['echo-gate-open'],
  },
  // Act II: the ash rifts, then Ilyra's garden.
  {
    id: 'cinders',
    type: 'main',
    title: 'Traverser les Failles de cendre',
    requires: ['slice-complete'],
    complete: ['defeated:cinder-warden'],
  },
  {
    id: 'ilyra',
    type: 'main',
    title: 'Trouver Ilyra au Jardin du déni',
    requires: ['defeated:cinder-warden'],
    complete: ['defeated:ilyra'],
  },
  {
    id: 'ilyan',
    type: 'memory',
    title: 'Retrouver le fragment d’Ilyan dans les braises',
    requires: ['slice-complete'],
    complete: ['memory-ilyan'],
  },
  {
    id: 'vaela',
    type: 'memory',
    title: 'Retrouver le fragment de Vaela au-dessus de la Faille',
    requires: ['slice-complete'],
    complete: ['memory-vaela'],
  },
  {
    id: 'kael',
    type: 'hidden',
    title: 'Retrouver la voix derrière le mur',
    requires: ['met-mira'],
    complete: ['memory-kael'],
  },
].map((q) => QuestSchema.parse(q));
