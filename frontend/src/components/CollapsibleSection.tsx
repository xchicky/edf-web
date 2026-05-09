import { useState, type ReactNode } from 'react';
import styles from './CollapsibleSection.module.css';

interface CollapsibleSectionProps {
  title: string;
  defaultCollapsed?: boolean;
  children: ReactNode;
}

export function CollapsibleSection({
  title,
  defaultCollapsed = true,
  children,
}: CollapsibleSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div className={styles.section}>
      <button
        className={styles.header}
        onClick={() => setCollapsed(!collapsed)}
        aria-expanded={!collapsed}
      >
        <span className={styles.title}>{title}</span>
        <span className={styles.arrow}>{collapsed ? '▸' : '▾'}</span>
      </button>
      {!collapsed && <div className={styles.content}>{children}</div>}
    </div>
  );
}
