export class CollectionError extends Error {}
export const COLLECTION_COVERS = {aurora:'Aurora',oceano:'Oceano',floresta:'Floresta',orbita:'Órbita'} as const;
export type CollectionCover=keyof typeof COLLECTION_COVERS;
export type CalendarCollection={id:string;name:string;description:string;cover:CollectionCover;visibility:'private'|'unlisted';shareToken:string|null;shareVersion:number;archivedAt:string|null;itemCount:number};
export const COLLECTION_LIMIT=20;
export const COLLECTION_ITEM_LIMIT=200;
export const collectionIdPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const collectionTokenPattern=/^[a-f0-9]{48}$/;
export function collectionInput(input:{name:unknown;description:unknown;cover:unknown}) {
  if(typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>80||/[\u0000-\u001f\u007f]/.test(input.name))throw new CollectionError('Informe um nome de até 80 caracteres.');
  if(typeof input.description!=='string'||input.description.trim().length>500||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(input.description))throw new CollectionError('Use uma descrição de até 500 caracteres.');
  if(typeof input.cover!=='string'||!Object.hasOwn(COLLECTION_COVERS,input.cover))throw new CollectionError('Escolha uma capa disponível.');
  return {name:input.name.trim(),description:input.description.trim(),cover:input.cover as CollectionCover};
}
