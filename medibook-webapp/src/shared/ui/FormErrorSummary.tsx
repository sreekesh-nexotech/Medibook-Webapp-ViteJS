import { cn } from '@/shared/lib/cn';
import { Icon } from '@/shared/ui/Icon';

interface FormErrorSummaryProps {
  /** Labelled server messages that belong to no field (`useForm().serverSummary`). */
  messages: readonly string[];
  /** Optional lead-in; defaults to a sentence that fits any save. */
  title?: string;
  className?: string;
}

/**
 * The part of a rejected save that no field can show (UAT-48): request-level
 * errors, headers, and fields the form does not render. Announced to screen
 * readers as an alert; renders nothing while there is nothing to say.
 */
export function FormErrorSummary({
  messages,
  title = 'The server could not save this:',
  className,
}: FormErrorSummaryProps) {
  if (messages.length === 0) return null;
  return (
    <div
      role="alert"
      className={cn('bg-d-100 text-d-700 flex gap-2.5 rounded-md px-3.5 py-3', className)}
    >
      <Icon name="triangle-alert" size={16} className="mt-0.5 flex-none" />
      <div className="text-body flex flex-col gap-1">
        <span className="font-medium">{title}</span>
        <ul className="list-disc pl-4.5">
          {messages.map((message, index) => (
            // Messages can repeat; position keeps keys stable for one render.
            <li key={`${index}-${message}`}>{message}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
