/**
 * Shared UI primitives for the client console (FE-10).
 *
 * Import from the barrel so call sites stay stable if a primitive is later
 * split into its own folder:
 *   import { Card, Badge, StatCard } from '../common';
 *
 * Only the verified primitives are re-exported here. Existing components
 * (JsonViewer, PlatformLogo) keep their direct import paths until they are
 * reviewed as part of the same design-system pass.
 */

export { Button } from './Button';
export { Modal } from './Modal';
export { Card } from './Card';
export { Badge, type BadgeTone } from './Badge';
export { Input, Textarea } from './Input';
export { Select, type SelectOption } from './Select';
export { Skeleton, SkeletonTable, SkeletonCards } from './Skeleton';
export { EmptyState } from './EmptyState';
export { ErrorState } from './ErrorState';
export { StatCard } from './StatCard';
export { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from './Table';
export { Tabs, TabPanel, tabId, tabPanelId, type TabItem } from './Tabs';

/* Page chrome and dialogs ported from the prototype (Phase 2). Panel is
   deliberately absent: the prototype's .p-panel is the same white/bordered
   surface the live Card already provides, so Card is restyled in Phase 3 rather
   than duplicated here. */
export { PageHeader } from './PageHeader';
export { SectionTitle } from './SectionTitle';
export { MetricStrip, type MetricStripItem } from './MetricStrip';
export { Status, statusTone } from './Status';
export { PaginationControls } from './PaginationControls';
export { Drawer } from './Drawer';
export { ConfirmDialog } from './ConfirmDialog';
