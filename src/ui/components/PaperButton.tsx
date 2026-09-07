import type { ButtonHTMLAttributes, ReactNode } from 'react';
export function PaperButton({children,variant='paper',className='',...props}:ButtonHTMLAttributes<HTMLButtonElement>&{children:ReactNode;variant?:'paper'|'ink'|'danger'|'quiet'}){return <button {...props} className={`paper-button paper-button-${variant} ${className}`}>{children}</button>;}
