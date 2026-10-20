import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type QueryDocumentSnapshot,
} from "@react-native-firebase/firestore";
import { db } from "./firebase";
import type { RideRequest } from "../interfaces/ride";
import type { UserProfile } from "../interfaces/user";

/**
 * Read-only data for the in-app Admin section. Everything here is readable by
 * any signed-in user under the current rules (the section is gated in the UI
 * by appRoles), so no rules changes are needed.
 *
 * Volume note: since the v1.3.7 fresh start the rides collection is small, so
 * "completed rides this month" is fetched as documents and bucketed on the
 * device. Riders are counted with a server-side count (one read regardless of
 * size). If ride volume grows, swap the month fetch for count/sum aggregations
 * without changing the callers.
 */

export interface AdminOverview {
  /** Registered clients, excluding sandbox/test accounts. */
  riders: number;
  ridesThisWeek: number;
  ridesThisMonth: number;
  /** Km credited to clients this month (actual distance when a trip ended
   *  early, booked distance otherwise — same rule as completeRide). */
  kmThisMonth: number;
  /** Most recent non-test rides, newest first. */
  recent: RideRequest[];
}

/** Km a completed ride credits — mirrors completeRide in Cloud Functions. */
export const rideKm = (r: RideRequest): number =>
  Number(r.actualDistanceKm ?? r.distance) || 0;

/** Monday 00:00 local time of the current week. */
export const startOfWeek = (now = new Date()): Date => {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sun … 6 = Sat
  const diffToMonday = (day + 6) % 7;
  d.setDate(d.getDate() - diffToMonday);
  return d;
};

/** 1st of the current month, 00:00 local time. */
export const startOfMonth = (now = new Date()): Date =>
  new Date(now.getFullYear(), now.getMonth(), 1);

const withIds = (
  docs: { id: string; data: () => Record<string, unknown> }[],
): RideRequest[] =>
  docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RideRequest, "id">) }));

// ─── Sandbox exclusion ──────────────────────────────────────────────────────
//
// Nothing in the Admin section may include sandbox data. A ride is sandbox
// when it carries isTest (set at booking when either party is a test account)
// OR when its client or driver is a test account — the second check catches
// rides that pre-date the flag. Filtering happens on device rather than in
// the query: a "!= true" filter would also drop rides missing the field.

let testIdsCache: { ids: Set<string>; at: number } | null = null;

/** User IDs flagged isTestAccount, cached for a minute per load burst. */
export const fetchTestAccountIds = async (): Promise<Set<string>> => {
  if (testIdsCache && Date.now() - testIdsCache.at < 60_000)
    return testIdsCache.ids;
  const snap = await getDocs(
    query(collection(db, "users"), where("isTestAccount", "==", true)),
  );
  const ids = new Set(snap.docs.map((d) => d.id));
  testIdsCache = { ids, at: Date.now() };
  return ids;
};

export const isSandboxRide = (r: RideRequest, testIds: Set<string>): boolean =>
  r.isTest === true ||
  (!!r.clientId && testIds.has(r.clientId)) ||
  (!!r.driverId && testIds.has(r.driverId));

/** What the rider was charged (or will be): the client-facing figure. */
export const rideCost = (r: RideRequest): number => {
  if (r.status === "cancelled") return Number(r.cancellationFee) || 0;
  return Number(r.totalClientCharge ?? r.estimatedPrice) || 0;
};

export const fetchAdminOverview = async (): Promise<AdminOverview> => {
  const rides = collection(db, "rides");
  const users = collection(db, "users");
  const now = new Date();
  const weekStart = startOfWeek(now).getTime();
  const monthStartIso = startOfMonth(now).toISOString();

  const [testIds, clientsSnap, testClientsSnap, monthSnap, recentSnap] =
    await Promise.all([
      fetchTestAccountIds(),
      getCountFromServer(query(users, where("role", "==", "client"))),
      getCountFromServer(
        query(
          users,
          where("role", "==", "client"),
          where("isTestAccount", "==", true),
        ),
      ),
      // completedAt is set by the completeRide function on every completion, so
      // every completed ride has it. Needs the (status, completedAt) index.
      getDocs(
        query(
          rides,
          where("status", "==", "completed"),
          where("completedAt", ">=", monthStartIso),
        ),
      ),
      // Extra so we still have 3 after dropping sandbox rides.
      getDocs(query(rides, orderBy("createdAt", "desc"), limit(12))),
    ]);

  const month = withIds(monthSnap.docs).filter(
    (r) => !isSandboxRide(r, testIds),
  );
  const week = month.filter(
    (r) => new Date(r.completedAt ?? "").getTime() >= weekStart,
  );

  return {
    riders: Math.max(
      0,
      clientsSnap.data().count - testClientsSnap.data().count,
    ),
    ridesThisWeek: week.length,
    ridesThisMonth: month.length,
    kmThisMonth: month.reduce((sum, r) => sum + rideKm(r), 0),
    recent: withIds(recentSnap.docs)
      .filter((r) => !isSandboxRide(r, testIds))
      .slice(0, 3),
  };
};

// ─── All rides (paged) ──────────────────────────────────────────────────────

export interface RidesPage {
  rides: RideRequest[];
  /** Pass back to fetch the next page; null when there are no more. */
  cursor: QueryDocumentSnapshot | null;
}

const RIDES_PAGE = 25;

/** Newest rides first, 25 per page, sandbox rides removed. */
export const fetchRecentRides = async (
  after: QueryDocumentSnapshot | null = null,
): Promise<RidesPage> => {
  const [testIds, snap] = await Promise.all([
    fetchTestAccountIds(),
    getDocs(
      query(
        collection(db, "rides"),
        orderBy("createdAt", "desc"),
        ...(after ? [startAfter(after)] : []),
        limit(RIDES_PAGE),
      ),
    ),
  ]);
  return {
    rides: withIds(snap.docs).filter((r) => !isSandboxRide(r, testIds)),
    cursor:
      snap.docs.length === RIDES_PAGE ? snap.docs[snap.docs.length - 1] : null,
  };
};

// ─── Rides summary ──────────────────────────────────────────────────────────

export type SummaryPeriod = "week" | "month" | "all";

export interface SummaryBar {
  label: string;
  value: number;
}

export interface RidesSummary {
  period: SummaryPeriod;
  /** Completed rides in the period. */
  rides: number;
  /** Km credited in the period (same rule as completeRide). */
  km: number;
  /** Distinct clients who completed a ride in the period. */
  riders: number;
  completed: number;
  cancelled: number;
  /** Average km per completed ride; 0 when there are none. */
  avgKm: number;
  /** Weekday with the most completed rides, e.g. "Friday"; null when none. */
  busiestDay: string | null;
  chartTitle: string;
  chartHint: string;
  bars: SummaryBar[];
}

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** When a completed ride counts: completion time, falling back to pickup. */
export const completedTime = (r: RideRequest): number =>
  new Date(
    r.completedAt ?? r.tripCompletedAt ?? r.scheduledTime ?? "",
  ).getTime();

/** Start of the period — Monday for "week", the 1st for "month", and the 1st
 *  of the month five months back for "all" (six calendar months). */
export const periodStart = (period: SummaryPeriod, now = new Date()): Date =>
  period === "week"
    ? startOfWeek(now)
    : period === "month"
      ? startOfMonth(now)
      : new Date(now.getFullYear(), now.getMonth() - 5, 1);

export interface PeriodChart {
  bars: SummaryBar[];
  chartTitle: string;
  chartHint: string;
}

/**
 * Buckets items into the chart for a period: per day (Mon–Sun) for the
 * week, per week for the month, per month for the six-month view. `weight`
 * is what each item adds to its bar — 1 to count rides, or a dollar amount.
 * `noun` heads the chart title ("Rides per day", "Earnings per week").
 */
export const bucketByPeriod = <T>(
  period: SummaryPeriod,
  items: T[],
  timeOf: (item: T) => number,
  weight: (item: T) => number,
  noun: string,
  now = new Date(),
): PeriodChart => {
  if (period === "week") {
    const start = startOfWeek(now).getTime();
    const sums = new Array<number>(7).fill(0);
    items.forEach((it) => {
      const idx = Math.floor((timeOf(it) - start) / 86400000);
      if (idx >= 0 && idx < 7) sums[idx] += weight(it);
    });
    return {
      bars: DAY_SHORT.map((label, i) => ({ label, value: sums[i] })),
      chartTitle: `${noun} per day`,
      chartHint: "Mon – Sun",
    };
  }
  if (period === "month") {
    const start = startOfMonth(now);
    const daysInMonth = new Date(
      start.getFullYear(),
      start.getMonth() + 1,
      0,
    ).getDate();
    const weeks = Math.ceil(daysInMonth / 7);
    const sums = new Array<number>(weeks).fill(0);
    items.forEach((it) => {
      const t = timeOf(it);
      if (Number.isNaN(t)) return;
      const idx = Math.floor((new Date(t).getDate() - 1) / 7);
      if (idx >= 0 && idx < weeks) sums[idx] += weight(it);
    });
    return {
      bars: sums.map((value, i) => ({ label: `Wk ${i + 1}`, value })),
      chartTitle: `${noun} per week`,
      chartHint: start.toLocaleDateString(undefined, { month: "long" }),
    };
  }
  // Last six calendar months, oldest first.
  const months: { key: string; label: string; value: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString(undefined, { month: "short" }),
      value: 0,
    });
  }
  items.forEach((it) => {
    const t = timeOf(it);
    if (Number.isNaN(t)) return;
    const d = new Date(t);
    const m = months.find(
      (x) => x.key === `${d.getFullYear()}-${d.getMonth()}`,
    );
    if (m) m.value += weight(it);
  });
  return {
    bars: months.map(({ label, value }) => ({ label, value })),
    chartTitle: `${noun} per month`,
    chartHint: "Last 6 months",
  };
};

/** Buckets completed rides into the chart for the period. Exported so it can
 *  be exercised with sample data. */
export const buildSummary = (
  period: SummaryPeriod,
  completed: RideRequest[],
  cancelledCount: number,
  now = new Date(),
): RidesSummary => {
  const km = completed.reduce((s, r) => s + rideKm(r), 0);
  const riders = new Set(completed.map((r) => r.clientId).filter(Boolean)).size;

  // Busiest weekday
  const byWeekday = new Array<number>(7).fill(0);
  completed.forEach((r) => {
    const t = completedTime(r);
    if (!Number.isNaN(t)) byWeekday[new Date(t).getDay()] += 1;
  });
  const maxDay = Math.max(...byWeekday);
  const busiestDay = maxDay > 0 ? WEEKDAYS[byWeekday.indexOf(maxDay)] : null;

  const { bars, chartTitle, chartHint } = bucketByPeriod(
    period,
    completed,
    completedTime,
    () => 1,
    "Rides",
    now,
  );

  return {
    period,
    rides: completed.length,
    km,
    riders,
    completed: completed.length,
    cancelled: cancelledCount,
    avgKm: completed.length ? km / completed.length : 0,
    busiestDay,
    chartTitle,
    chartHint,
    bars,
  };
};

/**
 * Completed rides (and a cancelled count) for the period. Completed rides are
 * fetched as documents and bucketed on device — small post-reset volume; the
 * "all" period is bounded to the last six months. Sandbox rides excluded.
 */
export const fetchRidesSummary = async (
  period: SummaryPeriod,
): Promise<RidesSummary> => {
  const rides = collection(db, "rides");
  const now = new Date();
  const startIso = periodStart(period, now).toISOString();

  const [completedSnap, cancelledSnap] = await Promise.all([
    // (status, completedAt) index
    getDocs(
      query(
        rides,
        where("status", "==", "completed"),
        where("completedAt", ">=", startIso),
      ),
    ),
    // Cancelled rides don't all carry cancelledAt, so bucket them by the
    // pickup time they were booked for — served by the (status, scheduledTime)
    // index that already exists.
    getDocs(
      query(
        rides,
        where("status", "==", "cancelled"),
        where("scheduledTime", ">=", startIso),
      ),
    ),
  ]);

  const testIds = await fetchTestAccountIds();
  const completed = withIds(completedSnap.docs).filter(
    (r) => !isSandboxRide(r, testIds),
  );
  const cancelled = withIds(cancelledSnap.docs).filter(
    (r) => !isSandboxRide(r, testIds),
  );

  return buildSummary(period, completed, cancelled.length, now);
};

// ─── Clients ────────────────────────────────────────────────────────────────

const toProfile = (id: string, data: Record<string, unknown>): UserProfile => ({
  ...(data as Omit<UserProfile, "uid">),
  uid: id,
});

const displayName = (p: UserProfile): string =>
  `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim();

/** Every registered client, test accounts excluded, A–Z by name. */
export const fetchClients = async (): Promise<UserProfile[]> => {
  const snap = await getDocs(
    query(collection(db, "users"), where("role", "==", "client")),
  );
  return snap.docs
    .map((d) => toProfile(d.id, d.data()))
    .filter((p) => p.isTestAccount !== true)
    .sort((a, b) =>
      displayName(a).localeCompare(displayName(b), undefined, {
        sensitivity: "base",
      }),
    );
};

export interface AdminClientDetail {
  profile: UserProfile;
  /** Completed rides, lifetime (server-side count). */
  completedRides: number;
  /** Most recent completed rides, newest first (up to 5). */
  recent: RideRequest[];
}

/** One client with their ride count and most recent completed rides.
 *  Resolves to null when the user doesn't exist (deleted account). */
export const fetchClientDetail = async (
  uid: string,
): Promise<AdminClientDetail | null> => {
  const rides = collection(db, "rides");
  const completedFor = [
    where("clientId", "==", uid),
    where("status", "==", "completed"),
  ];

  const [testIds, userSnap, countSnap, recentSnap] = await Promise.all([
    fetchTestAccountIds(),
    getDoc(doc(db, "users", uid)),
    getCountFromServer(query(rides, ...completedFor)),
    // Served by the existing (clientId, status, createdAt desc) index. A few
    // extra so a ride with a test driver can be dropped and still leave 5.
    getDocs(
      query(rides, ...completedFor, orderBy("createdAt", "desc"), limit(8)),
    ),
  ]);

  if (!userSnap.exists()) return null;

  return {
    profile: toProfile(userSnap.id, userSnap.data()),
    completedRides: countSnap.data().count,
    recent: withIds(recentSnap.docs)
      .filter((r) => !isSandboxRide(r, testIds))
      .slice(0, 5),
  };
};

// ─── Drivers ────────────────────────────────────────────────────────────────

// ─── One ride ───────────────────────────────────────────────────────────────

/** A single ride by id, or null when it doesn't exist. */
export const fetchRide = async (id: string): Promise<RideRequest | null> => {
  const snap = await getDoc(doc(db, "rides", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<RideRequest, "id">) };
};

/** Every registered driver, test accounts excluded, A–Z by name. */
export const fetchDrivers = async (): Promise<UserProfile[]> => {
  const snap = await getDocs(
    query(collection(db, "users"), where("role", "==", "driver")),
  );
  return snap.docs
    .map((d) => toProfile(d.id, d.data()))
    .filter((p) => p.isTestAccount !== true)
    .sort((a, b) =>
      displayName(a).localeCompare(displayName(b), undefined, {
        sensitivity: "base",
      }),
    );
};

export interface AdminDriverDetail {
  profile: UserProfile;
  /** Every completed + cancelled ride for the driver (sandbox excluded),
   *  newest first — the same set the driver's own Earnings page uses, so the
   *  two views can never disagree. */
  rides: RideRequest[];
}

/** One driver with their full ride set. Null when the account is gone. */
export const fetchDriverDetail = async (
  uid: string,
): Promise<AdminDriverDetail | null> => {
  const [testIds, userSnap, ridesSnap] = await Promise.all([
    fetchTestAccountIds(),
    getDoc(doc(db, "users", uid)),
    // Served by the existing (driverId, status, createdAt) index.
    getDocs(
      query(
        collection(db, "rides"),
        where("driverId", "==", uid),
        where("status", "in", ["completed", "cancelled"]),
        orderBy("createdAt", "desc"),
      ),
    ),
  ]);

  if (!userSnap.exists()) return null;

  return {
    profile: toProfile(userSnap.id, userSnap.data()),
    rides: withIds(ridesSnap.docs).filter((r) => !isSandboxRide(r, testIds)),
  };
};
