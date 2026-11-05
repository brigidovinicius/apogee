import Link from 'next/link';
import {CollectionMutationForm} from '@/components/opportunities/collection-form';
import {unsubscribeAction} from './actions';
import styles from '@/components/opportunities/collections.module.css';
export const dynamic='force-dynamic';
export const metadata={title:'Cancelar resumos | Apogee',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function UnsubscribePage({params}:{params:Promise<{token:string}>}) {
 const {token}=await params;
 return <main className={styles.page}><h1>Cancelar resumos de coleções</h1><p>Confirme para parar de receber os resumos semanais. As coleções acompanhadas continuam na sua conta.</p>
 <CollectionMutationForm action={unsubscribeAction} label="Confirmar cancelamento"><input type="hidden" name="token" value={/^[a-f0-9]{48}$/.test(token)?token:''}/></CollectionMutationForm>
 <Link href="/membros/colecoes/acompanhadas">Gerenciar minhas coleções</Link></main>;
}
