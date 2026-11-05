import {StatePanel} from '@/components/ui/state-panel';
import styles from '@/components/opportunities/collections.module.css';
export default function CollectionsLoading(){return <main className={styles.page}><StatePanel title="Abrindo coleção" description="Estamos verificando os eventos disponíveis." busy/></main>;}
