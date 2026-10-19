import {createRoot} from 'react-dom/client';
import {ProfileForm} from '../../components/members/profile-form';
import {PostEditor} from '../../app/admin/posts/post-editor';
import {events,fakeFetch} from './transport.mjs';

// Local bundle only. No real transport is reachable from these review components.
window.fetch = fakeFetch;
Object.defineProperty(window,'__APOGEE_REVIEW__',{value:{events},writable:false});
const host=document.querySelector('[data-interactive-review]');
if(!host) throw Error('Review host missing');
const kind=host.getAttribute('data-interactive-review');
createRoot(host).render(kind==='profileedit'
  ? <ProfileForm name="Pessoa Exemplo" userId="fixture-only" bio="Perfil fictício para revisão visual." image={null}/>
  : <PostEditor post={null}/>);
