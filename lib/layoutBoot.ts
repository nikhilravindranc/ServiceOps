/** Runs before the first paint (see app/layout.tsx) so the page does not flash in the other layout. */
export const LAYOUT_BOOT_SCRIPT = `try{var l=localStorage.getItem("ui-layout");if(l==="compact"||l==="classic")document.documentElement.dataset.layout=l}catch(e){}`;
