// Shared UI for the redesigned screens. Import from '@/components/ui'.
//
// Replacing the 73 Alert.alert calls (plan section 05b), as each screen is
// restyled:
//   - A decision with consequences -> <ConfirmSheet>, whose button says
//     exactly what happens ("Cancel booking"), never "OK".
//   - Feedback after an action -> useToast().show(), gone in ~3 seconds.
//   - A form error -> <FieldError> under the field it's about.
//   - A failed request -> <ErrorState> with Try again, in place of the content.
//   - Photo and camera permission requests stay the phone's own prompt.
export { AmbientBackground } from './AmbientBackground';
export { AppText, type AppTextProps, type ColorToken } from './AppText';
export { Button, type ButtonVariant } from './Button';
export { ConfirmSheet } from './ConfirmSheet';
export { EmptyState } from './EmptyState';
export { ErrorState } from './ErrorState';
export { FieldError } from './FieldError';
export { Figure } from './Figure';
export { FLOATING_BAR_CLEARANCE, FloatingActionBar } from './FloatingActionBar';
export { GlassCard } from './GlassCard';
export { HeroCard } from './HeroCard';
export { IconButton } from './IconButton';
export { Money } from './Money';
export { PaymentSchedule, type ScheduleStep, type ScheduleStepState } from './PaymentSchedule';
export { SegmentedControl, type SegmentOption } from './SegmentedControl';
export { Skeleton, SkeletonText } from './Skeleton';
export { StatusPill } from './StatusPill';
export { ToastProvider, useToast, type ToastTone } from './Toast';
