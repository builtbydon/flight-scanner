// pandora-components-web — shared React UI components for the Pandora fleet.
// All styled with the house design tokens (ui.design-tokens) via Tailwind
// utility classes. Import "pandora-components-web/theme.css" in your app's CSS
// and include this package in your Tailwind content globs.

export { Button } from "./components/Button";
export type { ButtonProps, ButtonVariant, ButtonSize } from "./components/Button";

export { Card } from "./components/Card";
export type { CardProps } from "./components/Card";

export { Badge } from "./components/Badge";
export type { BadgeProps, BadgeTone } from "./components/Badge";

export { Spinner } from "./components/Spinner";
export type { SpinnerProps } from "./components/Spinner";

export { Modal } from "./components/Modal";
export type { ModalProps } from "./components/Modal";

export { ConfirmDialog } from "./components/ConfirmDialog";
export type { ConfirmDialogProps } from "./components/ConfirmDialog";

export { TextField, TextAreaField, SelectField, ToggleField, CollapsibleSection } from "./components/fields";
export type {
  TextFieldProps,
  TextAreaFieldProps,
  SelectFieldProps,
  SelectOption,
  ToggleFieldProps,
  CollapsibleSectionProps,
} from "./components/fields";

export { StatCard } from "./components/StatCard";
export type { StatCardProps, StatTone } from "./components/StatCard";

export { DataTable } from "./components/DataTable";
export type { DataTableProps, Column } from "./components/DataTable";

export { EmptyState } from "./components/EmptyState";
export type { EmptyStateProps } from "./components/EmptyState";

export { PageShell } from "./components/PageShell";
export type { PageShellProps } from "./components/PageShell";

export { ToastProvider, useToast } from "./components/Toast";
export type { ToastProviderProps, ToastKind } from "./components/Toast";

export { Tooltip } from "./components/Tooltip";

export { OverflowMenu } from "./components/OverflowMenu";
export type { OverflowItem } from "./components/OverflowMenu";

export { ContentSplit } from "./components/ContentSplit";

export { DatePicker } from "./components/DatePicker";
export type { DatePickerProps } from "./components/DatePicker";

export { SegmentedControl } from "./components/SegmentedControl";
export type { SegmentOption, SegmentedControlProps } from "./components/SegmentedControl";

export { Autocomplete } from "./components/Autocomplete";
export type { AutocompleteOption, AutocompleteProps } from "./components/Autocomplete";

export { Tabs } from "./components/Tabs";
export type { TabItem, TabsProps } from "./components/Tabs";

export { useIsWideViewport } from "./hooks/useIsWideViewport";

export { useApi } from "./hooks/useApi";
export type { ApiState } from "./hooks/useApi";
