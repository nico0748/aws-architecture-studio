import { useEffect, useId, useRef, useState } from 'react';

/** DADS のフォームコントロールラベル（sm）。子要素に input / select / textarea を 1 つ渡す。 */
export function Field({ label, support, children }: { label: string; support?: string; children: (id: string, describedBy?: string) => React.ReactNode }) {
  const id = useId();
  const supportId = support ? id + '-support' : undefined;
  return (
    <div className="dads-form-control-label field" data-size="sm">
      <label className="dads-form-control-label__label" htmlFor={id}>{label}</label>
      {support && <p id={supportId} className="dads-form-control-label__support-text">{support}</p>}
      {children(id, supportId)}
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function TextInput({ className = '', ...rest }: InputProps) {
  return (
    <span className="dads-input-text">
      <input className={'dads-input-text__input ' + className} data-size="sm" {...rest} />
    </span>
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <span className="dads-textarea">
      <textarea className="dads-textarea__textarea" {...props} />
    </span>
  );
}

export function Select({ children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="dads-select">
      <span className="dads-select__control">
        <select className="dads-select__select" data-size="sm" {...rest}>{children}</select>
        <svg className="dads-select__chevron" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 17L3 8L4 7L12 15L20 7L21 8L12 17Z" fill="currentcolor" />
        </svg>
      </span>
    </span>
  );
}

export function Checkbox({ label, ...rest }: { label: React.ReactNode } & InputProps) {
  return (
    <label className="dads-checkbox" data-size="sm">
      <span className="dads-checkbox__checkbox">
        <input className="dads-checkbox__input" type="checkbox" {...rest} />
      </span>
      <span className="dads-checkbox__label">{label}</span>
    </label>
  );
}

export function Radio({ label, ...rest }: { label: React.ReactNode } & InputProps) {
  return (
    <label className="dads-radio" data-size="sm">
      <span className="dads-radio__radio">
        <input className="dads-radio__input" type="radio" {...rest} />
      </span>
      <span className="dads-radio__label">{label}</span>
    </label>
  );
}

export function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 120 120" aria-hidden="true">
      <path d="M32 95L25 88L53 60L25 32L32 25L60 53L88 25L95 32L67 60L95 88L88 95L60 67L32 95Z" fill="currentcolor" />
    </svg>
  );
}

/** DADS モーダルダイアログ。ネイティブ <dialog> を showModal() で開き、Esc や閉じるボタンで onClose を呼ぶ。 */
export function ModalDialog({ title, onClose, children, actions }: { title: string; onClose: () => void; children: React.ReactNode; actions: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    dialog.addEventListener('cancel', onCancel);
    return () => dialog.removeEventListener('cancel', onCancel);
  }, [onClose]);
  return (
    <dialog
      ref={ref}
      className="dads-modal-dialog app-modal"
      data-scroll="inner"
      aria-labelledby={headingId}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="dads-modal-dialog__dialog">
        <div className="dads-modal-dialog__header">
          <h2 id={headingId} className="dads-modal-dialog__heading" tabIndex={-1} autoFocus>{title}</h2>
          <button className="dads-modal-dialog__close" type="button" onClick={onClose}>
            <CloseIcon className="dads-modal-dialog__close-icon" />
            閉じる
          </button>
        </div>
        <div className="dads-modal-dialog__body">{children}</div>
        <div className="dads-modal-dialog__actions app-modal__actions">{actions}</div>
      </div>
    </dialog>
  );
}

/** DADS メニューリストボックス。開閉ボタンとポップアップの menu-list を組み合わせる。 */
export function MenuListBox({
  label,
  icon,
  align = 'start',
  children,
}: {
  label: React.ReactNode;
  icon?: React.ReactNode;
  align?: 'start' | 'end';
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('click', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className="dads-menu-list-box" ref={ref}>
      <button
        id={id + '-opener'}
        className="dads-menu-list-box__opener"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id + '-menu'}
        data-size="sm"
        data-style="outlined"
        data-text-weight="bold"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
      >
        {icon}
        <span className="opener-label">{label}</span>
        <svg className="dads-menu-list-box__opener-arrow" width="16" height="16" viewBox="0 0 24 24" fill="currentcolor" aria-hidden="true">
          <path d="m20.5 6.6-8 8-8-8L3.1 8l9.4 9.4L21.9 8l-1.4-1.4Z" />
        </svg>
      </button>
      <div className="dads-menu-list-box__popup" data-align={align} hidden={!open}>
        <ul id={id + '-menu'} className="dads-menu-list" role="menu" aria-labelledby={id + '-opener'}>
          {children(() => setOpen(false))}
        </ul>
      </div>
    </div>
  );
}

export function MenuItem({ icon, label, hint, disabled, onSelect }: { icon?: React.ReactNode; label: string; hint?: string; disabled?: boolean; onSelect: () => void }) {
  return (
    <li role="presentation">
      <button className="dads-menu-list__item" type="button" role="menuitem" data-type="box" data-size="regular" disabled={disabled} onClick={onSelect}>
        {icon && <span className="dads-menu-list__front-icon menu-glyph" aria-hidden="true">{icon}</span>}
        <span className="dads-menu-list__label">{label}</span>
        {hint && <span className="menu-hint">{hint}</span>}
      </button>
    </li>
  );
}
