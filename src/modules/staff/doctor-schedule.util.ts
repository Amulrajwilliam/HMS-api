/** Default clinic hours when profile has no schedule configured. */
export const DEFAULT_CLINIC_START = '09:00';
export const DEFAULT_CLINIC_END = '17:00';
export const DEFAULT_SLOT_MINUTES = 30;
/** ISO weekday 1=Mon … 7=Sun */
export const DEFAULT_WORKING_DAYS = '1,2,3,4,5';

export type ScheduleSlotDto = {
  startTime: string;
  endTime: string;
  status: 'available' | 'booked';
  appointmentId?: string;
  patientName?: string;
  appointmentType?: string;
  appointmentStatus?: string;
};

function parseTimeToMinutes(t: string): number {
  const parts = String(t).slice(0, 5).split(':').map(Number);
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function isoWeekdayFromDate(dateStr: string): number {
  const d = new Date(`${dateStr}T12:00:00`);
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

export function parseWorkingDays(raw?: string | null): Set<number> {
  const src = (raw ?? DEFAULT_WORKING_DAYS).split(',').map((s) => +s.trim());
  const set = new Set<number>();
  for (const n of src) {
    if (n >= 1 && n <= 7) set.add(n);
  }
  if (!set.size) {
    DEFAULT_WORKING_DAYS.split(',').forEach((s) => set.add(+s));
  }
  return set;
}

export function generateTemplateSlots(
  date: string,
  startTime: string,
  endTime: string,
  slotMinutes: number,
  workingDays: string | null | undefined,
): ScheduleSlotDto[] {
  const weekday = isoWeekdayFromDate(date);
  if (!parseWorkingDays(workingDays).has(weekday)) {
    return [];
  }

  const startM = parseTimeToMinutes(startTime || DEFAULT_CLINIC_START);
  const endM = parseTimeToMinutes(endTime || DEFAULT_CLINIC_END);
  const dur = Math.max(15, Math.min(120, slotMinutes || DEFAULT_SLOT_MINUTES));
  const slots: ScheduleSlotDto[] = [];

  for (let m = startM; m + dur <= endM; m += dur) {
    slots.push({
      startTime: minutesToTime(m),
      endTime: minutesToTime(m + dur),
      status: 'available',
    });
  }
  return slots;
}

type BookedRow = {
  id: string;
  time: string;
  status: string;
  type?: string;
  patient?: { name?: string };
};

export function mergeBookedIntoSlots(
  template: ScheduleSlotDto[],
  booked: BookedRow[],
): ScheduleSlotDto[] {
  const active = booked.filter((b) => !['cancelled', 'no_show'].includes(String(b.status).toLowerCase()));

  return template.map((slot) => {
    const slotStart = parseTimeToMinutes(slot.startTime);
    const match = active.find((b) => {
      const bt = parseTimeToMinutes(String(b.time));
      return bt >= slotStart && bt < slotStart + parseTimeToMinutes(slot.endTime) - slotStart;
    });
    if (!match) return slot;
    return {
      ...slot,
      status: 'booked',
      appointmentId: match.id,
      patientName: match.patient?.name,
      appointmentType: match.type,
      appointmentStatus: match.status,
    };
  });
}
