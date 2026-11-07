"use client";

// Campo de formulario accesible: label visible, error junto al campo con
// role=alert, aria-invalid + aria-describedby (M7, antislop-human).

import {
  useId,
  type InputHTMLAttributes,
  type Ref,
  type TextareaHTMLAttributes,
} from "react";

const baseInput =
  "w-full min-h-11 rounded-lg border bg-bg px-3 py-2.5 text-ink placeholder:text-muted/70 border-[#7d8ba3] aria-invalid:border-coral";

export function FieldError({ id, children }: { id: string; children?: string }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-sm font-semibold text-coral">
      {children}
    </p>
  );
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  ayuda?: string;
  ref?: Ref<HTMLInputElement>;
}

export function FormField({ label, error, ayuda, id, ref, ...props }: FieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const errId = `${fieldId}-error`;
  const helpId = `${fieldId}-ayuda`;
  const describedBy = [error ? errId : null, ayuda ? helpId : null]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <div>
      <label htmlFor={fieldId} className="mb-1.5 block font-semibold">
        {label}
        {props.required ? (
          <span className="text-coral" aria-hidden>
            {" "}
            *
          </span>
        ) : null}
      </label>
      <input
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={baseInput}
        {...props}
      />
      <FieldError id={errId}>{error}</FieldError>
      {ayuda ? (
        <p id={helpId} className="mt-1.5 text-sm text-muted">
          {ayuda}
        </p>
      ) : null}
    </div>
  );
}

interface AreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  ayuda?: string;
  ref?: Ref<HTMLTextAreaElement>;
}

export function FormArea({ label, error, ayuda, id, ref, ...props }: AreaProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const errId = `${fieldId}-error`;
  const helpId = `${fieldId}-ayuda`;
  const describedBy = [error ? errId : null, ayuda ? helpId : null]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <div>
      <label htmlFor={fieldId} className="mb-1.5 block font-semibold">
        {label}
        {props.required ? (
          <span className="text-coral" aria-hidden>
            {" "}
            *
          </span>
        ) : null}
      </label>
      <textarea
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`${baseInput} min-h-28 resize-y`}
        {...props}
      />
      <FieldError id={errId}>{error}</FieldError>
      {ayuda ? (
        <p id={helpId} className="mt-1.5 text-sm text-muted">
          {ayuda}
        </p>
      ) : null}
    </div>
  );
}
