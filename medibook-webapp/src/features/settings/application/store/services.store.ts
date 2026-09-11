import { create } from 'zustand';

import { money } from '@/shared/lib/format';
import { toast } from '@/shared/ui/toast/toast.store';

import { recordAudit } from '@/features/audit/application/store/audit.store';

import { normaliseCouponCode } from './services.logic';
import { SEED_COUPONS, SEED_SERVICES, SEED_TAXES } from './services.fixtures';
import type { Coupon, HospitalService, TaxRate } from './services.types';

/**
 * Services & pricing store (audit HA-04) — the service catalogue, the tax
 * rates the receipt prints and the coupons the desk may apply. Every mutation
 * writes an audit-trail entry, because a price change is exactly the sort of
 * thing a hospital admin later has to account for.
 *
 * Consumers: `selectServices` / `selectActiveTaxes` price a booking (pair them
 * with `priceWithTaxes` in `services.logic.ts`), `selectRedeemableCoupons`
 * lists the codes a desk may legitimately apply today.
 */

/** Service / tax / coupon payload — a missing id means "create". */
export type ServiceDraft = Omit<HospitalService, 'id'> & { readonly id?: string };
export type TaxDraft = Omit<TaxRate, 'id'> & { readonly id?: string };
export type CouponDraft = Omit<Coupon, 'id' | 'used'> & {
  readonly id?: string;
  readonly used?: number;
};

function mintId(prefix: string, taken: readonly string[]): string {
  let n = taken.length + 1;
  while (taken.includes(`${prefix}${n}`)) n += 1;
  return `${prefix}${n}`;
}

interface ServicesState {
  services: readonly HospitalService[];
  taxes: readonly TaxRate[];
  coupons: readonly Coupon[];
}

interface ServicesActions {
  /** Upsert a service. Returns the id. */
  saveService: (draft: ServiceDraft) => string;
  deleteService: (id: string) => void;
  /** Activate / retire a service without deleting its price history. */
  toggleService: (id: string) => void;
  /** Upsert a tax rate. Returns the id. */
  saveTax: (draft: TaxDraft) => string;
  deleteTax: (id: string) => void;
  toggleTax: (id: string) => void;
  /** Upsert a coupon (code is normalised to upper case). Returns the id. */
  saveCoupon: (draft: CouponDraft) => string;
  deleteCoupon: (id: string) => void;
  toggleCoupon: (id: string) => void;
}

export type ServicesStore = ServicesState & ServicesActions;

/** What the selectors below read — the store, or any snapshot of it. */
export interface ServicesSnapshot {
  readonly services: readonly HospitalService[];
  readonly taxes: readonly TaxRate[];
  readonly coupons: readonly Coupon[];
}

export const useServicesStore = create<ServicesStore>()((set, get) => ({
  services: SEED_SERVICES,
  taxes: SEED_TAXES,
  coupons: SEED_COUPONS,

  saveService: (draft) => {
    const existing = draft.id ? get().services.find((s) => s.id === draft.id) : undefined;
    const id =
      draft.id ??
      mintId(
        'svc-',
        get().services.map((s) => s.id),
      );
    set((s) => {
      const record: HospitalService = { ...draft, id };
      return {
        services: existing
          ? s.services.map((x) => (x.id === id ? record : x))
          : [...s.services, record],
      };
    });
    recordAudit({
      action: existing ? 'Update' : 'Create',
      entity: 'Service',
      entityId: id,
      summary: existing
        ? `Service updated — ${draft.name}`
        : `Service added to the catalogue — ${draft.name}`,
      before: existing ? `${existing.name} · ${money(existing.price)}` : null,
      after: `${draft.name} · ${money(draft.price)} · ${draft.durationMinutes} min`,
      sev: existing && existing.price !== draft.price ? 'Warning' : 'Info',
    });
    toast(existing ? 'Service saved' : 'Service added', 'success');
    return id;
  },

  deleteService: (id) => {
    const service = get().services.find((s) => s.id === id);
    if (!service) return;
    set((s) => ({
      services: s.services.filter((x) => x.id !== id),
      // A coupon must never point at a service that no longer exists.
      coupons: s.coupons.map((c) =>
        c.serviceIds.includes(id) ? { ...c, serviceIds: c.serviceIds.filter((x) => x !== id) } : c,
      ),
    }));
    recordAudit({
      action: 'Delete',
      entity: 'Service',
      entityId: id,
      summary: `Service removed — ${service.name}`,
      before: `${service.name} · ${money(service.price)}`,
      after: null,
      sev: 'Critical',
    });
    toast('Service removed', 'info');
  },

  toggleService: (id) => {
    const service = get().services.find((s) => s.id === id);
    if (!service) return;
    const nowActive = !service.active;
    set((s) => ({
      services: s.services.map((x) => (x.id === id ? { ...x, active: nowActive } : x)),
    }));
    recordAudit({
      action: 'Update',
      entity: 'Service',
      entityId: id,
      summary: `Service ${nowActive ? 'activated' : 'retired'} — ${service.name}`,
      before: service.active ? 'Active' : 'Inactive',
      after: nowActive ? 'Active' : 'Inactive',
      sev: 'Info',
    });
  },

  saveTax: (draft) => {
    const existing = draft.id ? get().taxes.find((t) => t.id === draft.id) : undefined;
    const id =
      draft.id ??
      mintId(
        'tax-',
        get().taxes.map((t) => t.id),
      );
    set((s) => {
      const record: TaxRate = { ...draft, id };
      return {
        taxes: existing ? s.taxes.map((x) => (x.id === id ? record : x)) : [...s.taxes, record],
      };
    });
    recordAudit({
      action: existing ? 'Update' : 'Create',
      entity: 'Tax',
      entityId: id,
      summary: existing ? `Tax rate updated — ${draft.name}` : `Tax rate added — ${draft.name}`,
      before: existing ? `${existing.percent}% ${existing.mode.toLowerCase()}` : null,
      after: `${draft.percent}% ${draft.mode.toLowerCase()}`,
      sev: 'Warning',
    });
    toast(existing ? 'Tax rate saved' : 'Tax rate added', 'success');
    return id;
  },

  deleteTax: (id) => {
    const tax = get().taxes.find((t) => t.id === id);
    if (!tax) return;
    set((s) => ({ taxes: s.taxes.filter((x) => x.id !== id) }));
    recordAudit({
      action: 'Delete',
      entity: 'Tax',
      entityId: id,
      summary: `Tax rate removed — ${tax.name}`,
      before: `${tax.percent}% ${tax.mode.toLowerCase()}`,
      after: null,
      sev: 'Critical',
    });
    toast('Tax rate removed', 'info');
  },

  toggleTax: (id) => {
    const tax = get().taxes.find((t) => t.id === id);
    if (!tax) return;
    const nowActive = !tax.active;
    set((s) => ({ taxes: s.taxes.map((x) => (x.id === id ? { ...x, active: nowActive } : x)) }));
    recordAudit({
      action: 'Update',
      entity: 'Tax',
      entityId: id,
      summary: `Tax rate ${nowActive ? 'applied' : 'switched off'} — ${tax.name} ${tax.percent}%`,
      before: tax.active ? 'Applied' : 'Off',
      after: nowActive ? 'Applied' : 'Off',
      sev: 'Warning',
    });
  },

  saveCoupon: (draft) => {
    const existing = draft.id ? get().coupons.find((c) => c.id === draft.id) : undefined;
    const id =
      draft.id ??
      mintId(
        'cpn-',
        get().coupons.map((c) => c.id),
      );
    const code = normaliseCouponCode(draft.code);
    set((s) => {
      const record: Coupon = { ...draft, id, code, used: draft.used ?? existing?.used ?? 0 };
      return {
        coupons: existing
          ? s.coupons.map((x) => (x.id === id ? record : x))
          : [...s.coupons, record],
      };
    });
    const valueCopy =
      draft.type === 'Percent' ? `${draft.value}% off` : `${money(draft.value)} off`;
    recordAudit({
      action: existing ? 'Update' : 'Create',
      entity: 'Coupon',
      entityId: id,
      summary: existing ? `Coupon updated — ${code}` : `Coupon created — ${code}`,
      before: existing
        ? `${existing.code} · ${existing.type === 'Percent' ? `${existing.value}%` : money(existing.value)}`
        : null,
      after: `${code} · ${valueCopy} · ${draft.from} → ${draft.to}`,
      sev: 'Warning',
    });
    toast(existing ? `Coupon ${code} saved` : `Coupon ${code} created`, 'success');
    return id;
  },

  deleteCoupon: (id) => {
    const coupon = get().coupons.find((c) => c.id === id);
    if (!coupon) return;
    set((s) => ({ coupons: s.coupons.filter((x) => x.id !== id) }));
    recordAudit({
      action: 'Delete',
      entity: 'Coupon',
      entityId: id,
      summary: `Coupon deleted — ${coupon.code}`,
      before: `${coupon.code} · used ${coupon.used} times`,
      after: null,
      sev: 'Warning',
    });
    toast(`Coupon ${coupon.code} deleted`, 'info');
  },

  toggleCoupon: (id) => {
    const coupon = get().coupons.find((c) => c.id === id);
    if (!coupon) return;
    const nowActive = !coupon.active;
    set((s) => ({
      coupons: s.coupons.map((x) => (x.id === id ? { ...x, active: nowActive } : x)),
    }));
    recordAudit({
      action: 'Update',
      entity: 'Coupon',
      entityId: id,
      summary: `Coupon ${nowActive ? 'resumed' : 'paused'} — ${coupon.code}`,
      before: coupon.active ? 'Active' : 'Paused',
      after: nowActive ? 'Active' : 'Paused',
      sev: 'Info',
    });
  },
}));

/* ------------------------------------------------------------- selectors */

export function selectServices(s: ServicesSnapshot): readonly HospitalService[] {
  return s.services;
}

/** Only the services a patient may actually book. */
export function selectBookableServices(s: ServicesSnapshot): readonly HospitalService[] {
  return s.services.filter((x) => x.active);
}

export function selectTaxes(s: ServicesSnapshot): readonly TaxRate[] {
  return s.taxes;
}

/** The tax lines a receipt must print today — pair with `priceWithTaxes`. */
export function selectActiveTaxes(s: ServicesSnapshot): readonly TaxRate[] {
  return s.taxes.filter((t) => t.active);
}

export function selectCoupons(s: ServicesSnapshot): readonly Coupon[] {
  return s.coupons;
}

/** Coupons that are switched on — availability by date is `couponStateOn`. */
export function selectRedeemableCoupons(s: ServicesSnapshot): readonly Coupon[] {
  return s.coupons.filter((c) => c.active);
}

/** Department names that own at least one service. */
export function selectServiceDepartments(s: ServicesSnapshot): readonly string[] {
  return [...new Set(s.services.map((x) => x.dept))].sort();
}
