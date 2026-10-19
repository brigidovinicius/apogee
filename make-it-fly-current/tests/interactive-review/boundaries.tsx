import type { ReactNode } from 'react';
import { actor, blocked } from './transport.mjs';
export default function Link({href,children,...props}:{href:string;children:ReactNode;prefetch?:boolean}) {
  return <a href={href} {...props}>{children}</a>;
}
export function useRouter() { return { refresh() {} }; }
export function usePathname() { return window.location.pathname; }
export const redirect = blocked;
export const revalidatePath = () => {};
export const headers = async () => new Headers();
export const requireMember = async () => actor;
export const getCurrentMember = async () => actor;
export const requireAdmin = async () => actor;
export const clientIp = async () => 'local-review';
export const getAuth = blocked;
export const consumeRateLimit = blocked;
export const updateProfile = blocked;
export const getAdminPost = async () => null;
export const savePost = blocked;
export const createTopic = blocked, createReply = blocked, editOwnPost = blocked, deleteOwnPost = blocked, completeUsername = blocked;

export const completeGoogleUsername = blocked, getCategory = blocked, getTopic = blocked, listPosts = blocked;
