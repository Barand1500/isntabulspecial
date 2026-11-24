import {createPortal} from 'react-dom';
import type {ReactNode} from 'react';
export default function AdminModal({children}:{children:ReactNode}){
 return createPortal(<div className="admin-root admin-modal-backdrop">{children}</div>,document.body);
}
