'use client';
import {useSyncExternalStore} from 'react';
const media='(max-width:1199px)';
const subscribe=(notify:()=>void)=>{const q=window.matchMedia(media);q.addEventListener('change',notify);return()=>q.removeEventListener('change',notify)};
export function useOfficeMobile(){return useSyncExternalStore(subscribe,()=>window.matchMedia(media).matches,()=>false)}
