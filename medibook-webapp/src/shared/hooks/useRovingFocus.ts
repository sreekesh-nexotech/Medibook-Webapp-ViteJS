import { useRef, type KeyboardEvent } from 'react';

/**
 * Arrow-key movement for a row of options that act as one control (tabs, a
 * segmented toggle): only the selected option is in the Tab order, and
 * Left/Right (Home/End) move to and select the neighbour (A11Y-01).
 */
export function useRovingFocus<T extends string>(
  options: readonly T[],
  value: T,
  onChange: (option: T) => void,
) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (index: number): void => {
    const option = options[index];
    if (option === undefined) return;
    onChange(option);
    refs.current[index]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const last = options.length - 1;
    const next =
      e.key === 'ArrowRight'
        ? index === last
          ? 0
          : index + 1
        : e.key === 'ArrowLeft'
          ? index === 0
            ? last
            : index - 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    select(next);
  };

  /** Props for the option at `index`. */
  const optionProps = (option: T, index: number) => ({
    ref: (el: HTMLButtonElement | null) => {
      refs.current[index] = el;
    },
    tabIndex: option === value ? 0 : -1,
    onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => onKeyDown(e, index),
    onClick: () => onChange(option),
  });

  return { optionProps };
}
