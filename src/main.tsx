import React, {lazy,Suspense} from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
const Site=lazy(()=>import('./App'));
const Admin=lazy(()=>import('./admin/AdminApp'));
const isAdmin=/^\/admin(?:\/|$)/.test(location.pathname);
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><Suspense fallback={<div style={{minHeight:'100dvh',display:'grid',placeItems:'center',background:'#f7f7f2'}}><img src="/images/brand-mark.png" alt="İstanbul Spesial" width="48" height="48"/></div>}>{isAdmin?<Admin/>:<Site/>}</Suspense></React.StrictMode>);
