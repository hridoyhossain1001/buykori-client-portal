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
export { Badge } from './Badge';
export { Input, Textarea } from './Input';
export { Select, type SelectOption } from './Select';
export { Skeleton, SkeletonTable, SkeletonCards } from './Skeleton';
export { EmptyState } from './EmptyState';
export { StatCard } from './StatCard';
export { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from './Table';
