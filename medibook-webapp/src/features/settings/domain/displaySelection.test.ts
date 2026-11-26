import { describe, expect, it } from 'vitest';

import type { DisplayDevice } from '@/features/settings/domain/entities/settings.entities';
import {
  doctorsForDepartment,
  selectionChanges,
  selectionOf,
  selectionSummary,
  toggleDoctor,
  withDepartment,
} from '@/features/settings/domain/displaySelection';

const DEPARTMENTS = [
  { id: 'gm', name: 'General Medicine' },
  { id: 'card', name: 'Cardiology' },
];
const DOCTORS = [
  { id: 'd1', name: 'Dr Rao', departmentId: 'card' },
  { id: 'd2', name: 'Dr Iyer', departmentId: 'card' },
  { id: 'd3', name: 'Dr Menon', departmentId: 'card' },
  { id: 'd4', name: 'Dr Das', departmentId: 'gm' },
];

function device(overrides: Partial<DisplayDevice> = {}): DisplayDevice {
  return {
    id: 'dev',
    name: 'Hall',
    isActive: true,
    selectedDepartmentId: null,
    selectedDoctorIds: [],
    selectedCounterIds: [],
    lastSeenAt: null,
    version: 1,
    ...overrides,
  };
}

describe('doctorsForDepartment', () => {
  it('lists only that department, or everyone with no department', () => {
    expect(doctorsForDepartment(DOCTORS, 'gm').map((d) => d.id)).toEqual(['d4']);
    expect(doctorsForDepartment(DOCTORS, null)).toHaveLength(4);
  });
});

describe('withDepartment', () => {
  it('drops picked doctors that are outside the new department', () => {
    const next = withDepartment({ departmentId: 'card', doctorIds: ['d1', 'd2'] }, 'gm', DOCTORS);
    expect(next).toEqual({ departmentId: 'gm', doctorIds: [] });
    expect(
      withDepartment({ departmentId: null, doctorIds: ['d1', 'd4'] }, 'card', DOCTORS),
    ).toEqual({ departmentId: 'card', doctorIds: ['d1'] });
  });

  it('keeps the doctors when going back to all departments', () => {
    expect(withDepartment({ departmentId: 'card', doctorIds: ['d1'] }, null, DOCTORS)).toEqual({
      departmentId: null,
      doctorIds: ['d1'],
    });
  });
});

describe('toggleDoctor', () => {
  it('ticks and unticks', () => {
    const on = toggleDoctor({ departmentId: 'card', doctorIds: ['d1'] }, 'd2');
    expect(on.doctorIds).toEqual(['d1', 'd2']);
    expect(toggleDoctor(on, 'd1').doctorIds).toEqual(['d2']);
  });
});

describe('selectionChanges', () => {
  it('sends nothing when only the name changes', () => {
    const d = device({ selectedDepartmentId: 'card', selectedDoctorIds: ['d1', 'd2'] });
    expect(selectionChanges(d, { departmentId: 'card', doctorIds: ['d2', 'd1'] })).toEqual({});
  });

  it('sends the doctors alone when the department is the same', () => {
    const d = device({ selectedDepartmentId: 'card', selectedDoctorIds: ['d1'] });
    expect(selectionChanges(d, { departmentId: 'card', doctorIds: [] })).toEqual({
      selectedDoctorIds: [],
    });
  });

  it('sends the department with its doctors when the department changes', () => {
    const d = device({ selectedDepartmentId: 'card', selectedDoctorIds: ['d1'] });
    expect(selectionChanges(d, { departmentId: 'gm', doctorIds: [] })).toEqual({
      selectedDepartmentId: 'gm',
      selectedDoctorIds: [],
    });
    expect(selectionChanges(d, { departmentId: null, doctorIds: ['d1'] })).toEqual({
      selectedDepartmentId: null,
      selectedDoctorIds: ['d1'],
    });
  });

  it('reads a device back as its selection', () => {
    expect(selectionOf(device({ selectedDepartmentId: 'gm', selectedDoctorIds: ['d4'] }))).toEqual({
      departmentId: 'gm',
      doctorIds: ['d4'],
    });
  });
});

describe('selectionSummary', () => {
  it('names the department and up to two doctors', () => {
    expect(selectionSummary({ departmentId: null, doctorIds: [] }, DEPARTMENTS, DOCTORS)).toBe(
      'All departments',
    );
    expect(selectionSummary({ departmentId: 'card', doctorIds: [] }, DEPARTMENTS, DOCTORS)).toBe(
      'Cardiology',
    );
    expect(
      selectionSummary(
        { departmentId: 'card', doctorIds: ['d1', 'd2', 'd3'] },
        DEPARTMENTS,
        DOCTORS,
      ),
    ).toBe('Cardiology · Dr Rao, Dr Iyer +1 more');
  });

  it('never shows an id for a department or doctor that is gone', () => {
    expect(
      selectionSummary({ departmentId: 'old', doctorIds: ['gone', 'd4'] }, DEPARTMENTS, DOCTORS),
    ).toBe('Removed department · Dr Das');
  });
});
