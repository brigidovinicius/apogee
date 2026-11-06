'use client';
import {RouteErrorState} from '@/components/ui/route-error-state';
import styles from '@/components/opportunities/collections.module.css';
export default function CollectionsError({reset}:{error:Error & {digest?:string};reset:()=>void}){return <main className={styles.page}><RouteErrorState retry={reset}/></main>;}
