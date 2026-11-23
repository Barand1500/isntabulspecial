import type { ComponentType } from 'react';
interface Item{label:string;ariaLabel?:string;link:string}
interface Props{position?:'left'|'right';colors?:string[];items?:Item[];socialItems?:Item[];displaySocials?:boolean;displayItemNumbering?:boolean;className?:string;logoUrl?:string;menuButtonColor?:string;openMenuButtonColor?:string;accentColor?:string;changeMenuColorOnOpen?:boolean;isFixed?:boolean;closeOnClickAway?:boolean;onMenuOpen?:()=>void;onMenuClose?:()=>void}
declare const StaggeredMenu:ComponentType<Props>;
export default StaggeredMenu;
